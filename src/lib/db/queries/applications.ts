/**
 * Application database queries for the admin queue and detail views.
 */

import { withAdminContext, type Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  reviewPhaseWhere,
  undecidedWhere,
  type ReviewPhase,
} from "@/lib/applications/queue-filter";
import { londonStartOfDayUtc, londonEndOfDayUtc } from "@/lib/datetime";
import type {
  School,
  Application,
  Round,
  ApplicationSection,
  ApplicationSectionType,
  ApplicationContributorRole,
  ApplicationContributorStatus,
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AssessmentOutcome,
  BursaryAccountStatus,
  Document,
  Assessment,
  Profile,
  Prisma,
} from "@prisma/client";

// ─── List Applications ────────────────────────────────────────────────────────

/**
 * Coarse second-parent state for the queue indicator (dual-parent, PR 5):
 *   - "NONE"      — no second parent invited (single-parent application).
 *   - "SUBMITTED" — second parent has submitted their details.
 *   - "OVERRIDE"  — assessor chose to proceed without the second parent.
 *   - "AWAITING"  — invited but not yet submitted, no override.
 *
 * Kept deliberately simple (no per-invite freshness): the application detail
 * page surfaces the precise status (Invited / In progress / Submitted).
 */
export type SecondParentIndicator =
  | "NONE"
  | "SUBMITTED"
  | "OVERRIDE"
  | "AWAITING";

export interface ApplicationListItem {
  id: string;
  reference: string;
  school: School;
  formStatus: ApplicationFormStatus;
  applicationType: ApplicationType;
  /** Real assessment lifecycle status, null when no assessment exists yet. */
  assessmentStatus: AssessmentStatus | null;
  /** Final outcome (3-value), null until set. */
  outcome: AssessmentOutcome | null;
  entryYear: number | null;
  submittedAt: Date | null;
  /** Per-application submission deadline override (Epic 03); null = inherit. */
  submissionDeadlineAt: Date | null;
  isReassessment: boolean;
  assignedToId: string | null;
  /**
   * Carries `closeDate` + `defaultSubmissionDeadline` (Item 12) alongside the
   * round identity fields so callers can compute the effective deadline via
   * `effectiveSubmissionDeadline()` (src/lib/rounds/submission-deadline.ts)
   * without a second query.
   */
  round: Pick<Round, "id" | "academicYear" | "closeDate" | "defaultSubmissionDeadline">;
  secondParent: SecondParentIndicator;
  /**
   * The rolling BursaryAccount this application is linked to, or null when none
   * exists yet (a NEW application only gains an account on AWARD). Drives the
   * queue's "Withdraw account" action availability.
   */
  bursaryAccountId: string | null;
  /** Status of the linked account (null when there is no account). */
  bursaryAccountStatus: BursaryAccountStatus | null;
}

export interface ListApplicationsFilters {
  roundId?: string;
  /**
   * Review-phase filter (Epic 01 PR-6a) — the 7-value vocabulary projected from
   * the lifecycle columns. Replaces the old fused `status` filter; translated to
   * a lifecycle-column `where` via `reviewPhaseWhere`.
   */
  reviewPhases?: ReviewPhase[];
  school?: School;
  search?: string;
  assignedToId?: string;
  /**
   * Restrict to an explicit set of application ids (drill-in from the Round
   * Cockpit watchlist — keeps the queue identical to the lane's count). An
   * EMPTY array intentionally returns zero rows, not "all".
   */
  ids?: string[];
  /**
   * Restrict to applications linked to an explicit set of BursaryAccount ids
   * (re-assessment-eligible drill-in from the queue). An EMPTY array
   * intentionally returns zero rows, not "all".
   */
  bursaryAccountIds?: string[];
  /**
   * Undecided filter: applications with no final assessment outcome yet. A plain
   * lifecycle filter, not a watchlist rule.
   */
  undecided?: boolean;
  /**
   * Received-date range filter (Item 7.1) — inclusive UTC instant bounds on
   * `submittedAt`. Callers convert a Europe/London calendar-date input via
   * `londonStartOfDayUtc`/`londonEndOfDayUtc` (src/lib/datetime.ts) before
   * passing it here so a boundary day is fully included regardless of
   * GMT/BST. An application with no `submittedAt` (not yet submitted) is
   * excluded automatically whenever either bound is set — Prisma/SQL never
   * matches a `gte`/`lte` comparison against NULL.
   */
  submittedFrom?: Date;
  submittedTo?: Date;
  /**
   * Submission-by (deadline) range filter (Item 7.2) — plain `YYYY-MM-DD`
   * calendar-date strings (NOT pre-converted instants, unlike
   * `submittedFrom`/`submittedTo` above — see `effectiveDeadlineRangeWhere`
   * for why the three-tier effective-deadline chain needs two different
   * conversions of the same bound). Matches each application's EFFECTIVE
   * deadline (override ?? round default ?? round close date — Item 12/D-1),
   * the same chain `effectiveSubmissionDeadline()` computes.
   */
  deadlineFrom?: string;
  deadlineTo?: string;
}

/**
 * Builds the Prisma where-fragment for the received-date range filter (Item
 * 7.1), mirroring the story's inclusive from/to semantics:
 *   - neither bound set  → `undefined` (no filter)
 *   - only `from`        → `submittedAt >= from` (open upper bound)
 *   - only `to`          → `submittedAt <= to` (open lower bound)
 *   - both               → `submittedAt` between `from` and `to` inclusive
 * A row with a null `submittedAt` never satisfies a `gte`/`lte` comparison, so
 * unsubmitted applications are excluded automatically whenever a bound is
 * active — no explicit `not: null` needed.
 */
export function submittedDateRangeWhere(
  from: Date | undefined,
  to: Date | undefined
): Prisma.ApplicationWhereInput | undefined {
  if (!from && !to) return undefined;
  return {
    submittedAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  };
}

/**
 * Builds the Prisma where-fragment for the submission-by (deadline) range
 * filter (Item 7.2), matching the SAME three-tier chain
 * `effectiveSubmissionDeadline()` computes (src/lib/rounds/submission-deadline.ts,
 * Item 12/D-1): `application.submissionDeadlineAt` (override) ?? round's
 * `defaultSubmissionDeadline` ?? round's `closeDate`. Only the first tier that
 * is SET applies for a given row — a round default, if present, is checked
 * INSTEAD OF closeDate, never in addition (matches the helper's precedence).
 *
 * `from`/`to` are plain `YYYY-MM-DD` calendar-date strings. The three tiers
 * need two different conversions of the same bound:
 *
 *   - Override tier (`submissionDeadlineAt`, a `timestamptz` — an explicit
 *     instant an admin chose, verbatim, possibly with a time-of-day):
 *     compared against the UTC INSTANT bounds of the London calendar day
 *     (`londonStartOfDayUtc`/`londonEndOfDayUtc`), exactly like the
 *     received-date filter (7.1) compares `submittedAt`. An instant `X`
 *     falls in `[from, to]` iff `X`'s LONDON CALENDAR DATE is within
 *     `[from, to]` — which is exactly what testing `X` against those two
 *     instant bounds does, regardless of the server runtime's own timezone.
 *   - Round-default / close-date tiers (`@db.Date` columns — pure calendar
 *     dates with no time-of-day at all): compared DIRECTLY against `from`/`to`
 *     as calendar-date values (UTC-midnight `Date`s, exactly how Prisma always
 *     represents a `@db.Date` field), with NO end-of-day shift. This
 *     sidesteps the end-of-day-instant arithmetic entirely for these two
 *     tiers — "does this deadline DATE fall within `[from, to]`" is a plain
 *     date-vs-date comparison, and it provably agrees with whatever instant
 *     `effectiveSubmissionDeadline()`'s `endOfDay()` shift produces for
 *     display: shifting a date to its last millisecond never changes WHICH
 *     calendar date it belongs to, so filtering on the date is equivalent to
 *     filtering on the (shifted) instant, without needing to replicate the
 *     shift's timezone assumptions here.
 *
 * A row with neither an override, nor a round default, nor (impossible in
 * practice — `closeDate` is required) a close date is excluded automatically
 * whenever a bound is active, via the same null gte/lte semantics as 7.1.
 */
export function effectiveDeadlineRangeWhere(
  from: string | undefined,
  to: string | undefined
): Prisma.ApplicationWhereInput | undefined {
  if (!from && !to) return undefined;

  const instantFrom = from ? londonStartOfDayUtc(from) : undefined;
  const instantTo = to ? londonEndOfDayUtc(to) : undefined;
  // Calendar-date literals for the two `@db.Date` tiers — UTC midnight, the
  // same representation Prisma uses for `@db.Date` fields (no time-of-day).
  const dateFrom = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const dateTo = to ? new Date(`${to}T00:00:00.000Z`) : undefined;

  const overrideInRange: Prisma.ApplicationWhereInput = {
    submissionDeadlineAt: {
      ...(instantFrom ? { gte: instantFrom } : {}),
      ...(instantTo ? { lte: instantTo } : {}),
    },
  };

  // Only reached when there's no override (D-1 precedence: override wins).
  const roundDefaultInRange: Prisma.ApplicationWhereInput = {
    submissionDeadlineAt: null,
    round: {
      defaultSubmissionDeadline: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    },
  };

  // Only reached when there's no override AND no round default — a round
  // with a default set never falls through to closeDate, even if the
  // default itself is out of range (matches the helper's strict precedence).
  const closeDateInRange: Prisma.ApplicationWhereInput = {
    submissionDeadlineAt: null,
    round: {
      defaultSubmissionDeadline: null,
      closeDate: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    },
  };

  return { OR: [overrideInRange, roundDefaultInRange, closeDateInRange] };
}

/**
 * Returns a list of applications matching the given filters.
 * Names are excluded by default — use getApplicationNames() separately.
 */
export async function listApplications(
  tx: Tx,
  filters: ListApplicationsFilters = {}
): Promise<ApplicationListItem[]> {
  const where: Prisma.ApplicationWhereInput = {};
  // Lifecycle-column fragments (review-phase / undecided) are combined under AND
  // so their internal OR/relation clauses never clobber each other (Epic 01 PR-6a).
  const and: Prisma.ApplicationWhereInput[] = [];

  if (filters.roundId) {
    where.roundId = filters.roundId;
  }

  const phaseWhere = reviewPhaseWhere(filters.reviewPhases);
  if (phaseWhere) {
    and.push(phaseWhere);
  }

  if (filters.school) {
    where.school = filters.school;
  }

  if (filters.search) {
    where.reference = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.ids !== undefined) {
    // An empty array must return zero rows (not "all"), so set the `in`
    // constraint unconditionally — Prisma `{ in: [] }` matches nothing.
    where.id = { in: filters.ids };
  }

  if (filters.bursaryAccountIds !== undefined) {
    // Same empty-array semantics as `ids`: an empty set matches nothing.
    where.bursaryAccountId = { in: filters.bursaryAccountIds };
  }

  if (filters.undecided) {
    and.push(undecidedWhere());
  }

  const submittedWhere = submittedDateRangeWhere(
    filters.submittedFrom,
    filters.submittedTo
  );
  if (submittedWhere) {
    and.push(submittedWhere);
  }

  const deadlineWhere = effectiveDeadlineRangeWhere(
    filters.deadlineFrom,
    filters.deadlineTo
  );
  if (deadlineWhere) {
    and.push(deadlineWhere);
  }

  if (and.length > 0) {
    where.AND = and;
  }

  const applications = await tx.application.findMany({
    where,
    select: {
      id: true,
      reference: true,
      school: true,
      formStatus: true,
      applicationType: true,
      entryYear: true,
      submittedAt: true,
      submissionDeadlineAt: true,
      isReassessment: true,
      assignedToId: true,
      bursaryAccountId: true,
      round: {
        select: {
          id: true,
          academicYear: true,
          closeDate: true,
          defaultSubmissionDeadline: true,
        },
      },
      bursaryAccount: {
        select: { status: true },
      },
      // Only the SECONDARY contributor (at most one) drives the indicator.
      contributors: {
        where: { role: "SECONDARY" },
        select: { status: true },
      },
      assessment: {
        select: {
          secondaryParentOverride: true,
          status: true,
          outcome: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return applications.map((a) => {
    const { contributors, assessment, bursaryAccount, ...rest } = a;
    const secondary = contributors[0];
    let secondParent: SecondParentIndicator = "NONE";
    if (secondary) {
      if (secondary.status === "SUBMITTED") {
        secondParent = "SUBMITTED";
      } else if (assessment?.secondaryParentOverride) {
        secondParent = "OVERRIDE";
      } else {
        secondParent = "AWAITING";
      }
    }
    return {
      ...rest,
      assessmentStatus: assessment?.status ?? null,
      outcome: assessment?.outcome ?? null,
      secondParent,
      bursaryAccountStatus: bursaryAccount?.status ?? null,
    };
  });
}

// ─── Application Names ────────────────────────────────────────────────────────

export interface ApplicationNameResult {
  id: string;
  childName: string;
  leadApplicant: Pick<Profile, "id" | "firstName" | "lastName" | "email">;
}

/**
 * Returns child names and lead applicant names for the given application IDs.
 * Keep this in a separate query — call only when names have been explicitly revealed.
 */
export async function getApplicationNames(
  tx: Tx,
  applicationIds: string[]
): Promise<ApplicationNameResult[]> {
  const applications = await tx.application.findMany({
    where: { id: { in: applicationIds } },
    select: {
      id: true,
      childName: true,
      leadApplicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return applications;
}

// ─── Application Detail ───────────────────────────────────────────────────────

/**
 * Default application detail shape — DOES NOT include `childName` or any
 * applicant name fields. Per finding 2.18 / NM-01..05, the SSR payload for
 * the application-detail pages must not carry names unless they have been
 * explicitly revealed via the audit-logged path (`getApplicationNamesForReveal`).
 */
export type ApplicationWithDetails = Omit<
  Application,
  // `status` (the deprecated fused enum) is intentionally NOT selected (Epic 01
  // PR-6a) — the detail view derives the review phase from the lifecycle columns.
  "childName" | "status"
> & {
  round: Round;
  sections: ApplicationSection[];
  documents: Document[];
  assessment: Assessment | null;
  leadApplicant: Pick<Profile, "id">;
};

/**
 * Returns the full application with all related data for the detail view —
 * EXCLUDING applicant names (childName, firstName, lastName, email). Use
 * `getApplicationNamesForReveal()` to fetch names on the explicit reveal path.
 */
export async function getApplicationWithDetails(
  tx: Tx,
  applicationId: string
): Promise<ApplicationWithDetails | null> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      roundId: true,
      bursaryAccountId: true,
      leadApplicantId: true,
      school: true,
      // childName: intentionally omitted — see getApplicationNamesForReveal.
      childDob: true,
      entryYear: true,
      entryYearGroup: true,
      isReassessment: true,
      isInternal: true,
      assignedToId: true,
      formStatus: true,
      applicationType: true,
      custodyArrangement: true,
      archivedAt: true,
      submittedAt: true,
      submissionDeadlineAt: true,
      createdAt: true,
      updatedAt: true,
      round: true,
      sections: {
        orderBy: { section: "asc" },
      },
      documents: {
        orderBy: { uploadedAt: "asc" },
      },
      assessment: true,
      leadApplicant: {
        select: { id: true },
      },
    },
  });

  return application as ApplicationWithDetails | null;
}

// ─── Application Names (audit-logged reveal) ──────────────────────────────────

export interface ApplicationNamesForReveal {
  childName: string;
  leadApplicant: Pick<Profile, "id" | "firstName" | "lastName" | "email">;
}

/**
 * Fetches the applicant + child names for a single application and writes a
 * NAME_REVEAL audit log entry. Call this only from server pages/actions that
 * legitimately need to render names (e.g. the recommendation reveal step or
 * the Applicant Data review tab). The Assessment tab MUST NOT call this.
 *
 * Mirrors the pattern in /api/applications/names/route.ts.
 */
export async function getApplicationNamesForReveal(
  tx: Tx,
  applicationId: string,
  userId: string
): Promise<ApplicationNamesForReveal | null> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      childName: true,
      leadApplicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!application) return null;

  await createAuditLog(tx, {
    userId,
    action: AUDIT_ACTIONS.NAME_REVEAL,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    context: "Application detail name reveal",
    metadata: { applicationId },
  });

  return application;
}

// ─── Round list (for filter dropdown) ────────────────────────────────────────

export async function listRounds(
  tx: Tx
): Promise<Pick<Round, "id" | "academicYear" | "status">[]> {
  return tx.round.findMany({
    select: { id: true, academicYear: true, status: true },
    orderBy: { openDate: "desc" },
  });
}

// ─── Portal applicant queries ─────────────────────────────────────────────────

export interface SectionStatusResult {
  section: ApplicationSectionType;
  isComplete: boolean;
  updatedAt: Date;
}

/**
 * Returns the applicant's current active (not-yet-submitted) draft application,
 * or null if none exists.
 *
 * Use this for the editable apply flow, which only operates on the draft.
 * For the dashboard's "current application whatever its status" need, use
 * getCurrentApplicationForUser instead.
 *
 * PR-6a: "draft" is `form_status` ≠ SUBMITTED (the lifecycle equivalent of the
 * old fused PRE_SUBMISSION), not the deprecated fused `applications.status`.
 */
export async function getApplicationForUser(tx: Tx, userId: string) {
  return tx.application.findFirst({
    where: {
      leadApplicantId: userId,
      formStatus: { not: "SUBMITTED" },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      round: {
        select: { academicYear: true, status: true },
      },
    },
  });
}

/**
 * Returns the applicant's most recent application of any status (most
 * recently updated), or null if none exists. Unlike getApplicationForUser
 * this does not filter to PRE_SUBMISSION, so a submitted/under-review/
 * decided application is still returned — which the dashboard needs so it
 * reflects the real state instead of falling back to onboarding.
 */
export async function getCurrentApplicationForUser(tx: Tx, userId: string) {
  return tx.application.findFirst({
    where: {
      leadApplicantId: userId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      round: {
        select: { academicYear: true, status: true },
      },
      // PR-6a: the portal "awaiting documents" CTA reads the assessment
      // lifecycle (PAUSED) instead of the deprecated fused applications.status.
      assessment: {
        select: { status: true },
      },
    },
  });
}

/**
 * Narrow nav-state read for the persistent portal rail (PR-9).
 *
 * Runs on EVERY portal page (it backs the root `(portal)/layout.tsx`), so it is
 * deliberately the smallest possible read: just the lifecycle bits the nav needs
 * to badge Documents (paused → outstanding document request) and to point the
 * "My Application" item at the right target (wizard while drafting, `/status`
 * after submit). NO round read (Decision 5 — the round label stays out of the
 * global nav), NO section/gap computation, NO full-application include.
 *
 * Returns null when the user has no application yet (invited-not-started, or no
 * invitation) — the nav then falls back to its static defaults.
 */
export interface PortalNavState {
  /** Drives the adaptive "My Application" target (SUBMITTED → /status). */
  formStatus: ApplicationFormStatus;
}

export async function getPortalNavState(
  tx: Tx,
  userId: string
): Promise<PortalNavState | null> {
  const app = await tx.application.findFirst({
    where: { leadApplicantId: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      formStatus: true,
    },
  });
  if (!app) return null;
  return {
    formStatus: app.formStatus,
  };
}

/** The minimal paused signal the applicant portal is allowed to surface. */
export interface ApplicationPausedState {
  /** True when an assessor has paused review pending documents. */
  isPaused: boolean;
  /** The document deadline the assessor set, when paused. */
  pausedUntil: Date | null;
}

/**
 * Reads ONLY the paused bit + deadline for a user's current application, under
 * SERVICE-ROLE (admin) context.
 *
 * Why admin context: applicants cannot SELECT the `assessments` row under RLS
 * (`assessments_select` is admin/viewer/assigned-assessor only — "applicants
 * must NOT see assessment data"). Reading `application.assessment.status` under
 * the applicant's own context therefore always returns null, which silently
 * disabled the missing-documents CTA (the assessment is invisible). We read just
 * these two scalars server-side so the portal can surface "a document request is
 * outstanding, due by X" WITHOUT ever exposing assessment financials, scoring,
 * notes or in-progress outcome to the applicant.
 *
 * Resolves "the user's current application" the same way `getPortalNavState` /
 * `getCurrentApplicationForUser` do (most-recently-updated), so the signal
 * always matches the application the rest of the portal is showing.
 */
export async function getApplicationPausedStateForUser(
  userId: string
): Promise<ApplicationPausedState> {
  return withAdminContext(async (tx) => {
    const app = await tx.application.findFirst({
      where: { leadApplicantId: userId },
      orderBy: { updatedAt: "desc" },
      select: { assessment: { select: { status: true, pausedUntil: true } } },
    });
    return {
      isPaused: app?.assessment?.status === "PAUSED",
      pausedUntil: app?.assessment?.pausedUntil ?? null,
    };
  });
}

/**
 * Reads ONLY the paused bit + deadline for a specific application, under
 * service-role context. Used by pages that already resolved the application id
 * under the applicant's context (ownership established) and now need the paused
 * signal the applicant's RLS cannot read. See `getApplicationPausedStateForUser`
 * for the disclosure rationale.
 */
export async function getApplicationPausedState(
  applicationId: string
): Promise<ApplicationPausedState> {
  return withAdminContext(async (tx) => {
    const assessment = await tx.assessment.findUnique({
      where: { applicationId },
      select: { status: true, pausedUntil: true },
    });
    return {
      isPaused: assessment?.status === "PAUSED",
      pausedUntil: assessment?.pausedUntil ?? null,
    };
  });
}

/**
 * Returns completion status for all sections of an application OWNED BY a
 * specific contributor.
 *
 * Sections are scoped by owner (dual-parent foundation, PR 4a): for the lead
 * applicant this is their PRIMARY contributor, so the result is identical to
 * the pre-dual-parent behaviour (every existing section is owned by the
 * PRIMARY). A future SECONDARY contributor (PR 4b) sees only its own copies.
 */
export async function getSectionStatusList(
  tx: Tx,
  applicationId: string,
  ownerContributorId: string
): Promise<SectionStatusResult[]> {
  const rows = await tx.applicationSection.findMany({
    where: { applicationId, ownerContributorId },
    select: { section: true, isComplete: true, updatedAt: true },
  });

  return rows.map((row) => ({
    section: row.section,
    isComplete: row.isComplete,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Upserts a single ApplicationSection row owned by a specific contributor.
 *
 * Targets the contributor-scoped unique (applicationId, section,
 * ownerContributorId). For the lead applicant `ownerContributorId` is their
 * PRIMARY contributor — behaviour is identical to before (one row per section).
 *
 * `assessorProvenance` is an optional staff edit-on-behalf provenance map,
 * computed by the caller (e.g. which fields a staff member changed and when).
 * When omitted the stored provenance is left untouched.
 */
export async function upsertSection(
  tx: Tx,
  applicationId: string,
  section: ApplicationSectionType,
  data: unknown,
  isComplete: boolean,
  ownerContributorId: string,
  assessorProvenance?: Prisma.InputJsonValue
) {
  const jsonData = data as Prisma.InputJsonValue;
  const provenance =
    assessorProvenance !== undefined ? { assessorProvenance } : undefined;
  return tx.applicationSection.upsert({
    where: {
      applicationId_section_ownerContributorId: {
        applicationId,
        section,
        ownerContributorId,
      },
    },
    update: {
      data: jsonData,
      isComplete,
      ...provenance,
    },
    create: {
      applicationId,
      section,
      ownerContributorId,
      data: jsonData,
      isComplete,
      ...provenance,
    },
  });
}

/**
 * Loads a single section's data for an application, scoped to the owning
 * contributor. Returns null if that contributor has not saved this section yet.
 */
export async function getSectionData(
  tx: Tx,
  applicationId: string,
  section: ApplicationSectionType,
  ownerContributorId: string
) {
  return tx.applicationSection.findUnique({
    where: {
      applicationId_section_ownerContributorId: {
        applicationId,
        section,
        ownerContributorId,
      },
    },
    select: { data: true, isComplete: true, updatedAt: true },
  });
}

/**
 * Serialisable document metadata for the client (no storagePath / uploadedBy).
 */
export interface DocumentMeta {
  id: string;
  slot: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Returns all documents for an application as a map keyed by document ID.
 */
export async function getDocumentsForApplication(
  tx: Tx,
  applicationId: string
): Promise<Record<string, DocumentMeta>> {
  const rows = await tx.document.findMany({
    where: { applicationId },
    select: { id: true, slot: true, filename: true, fileSize: true, uploadedAt: true },
  });

  const map: Record<string, DocumentMeta> = {};
  for (const row of rows) {
    map[row.id] = {
      id: row.id,
      slot: row.slot,
      filename: row.filename,
      fileSize: row.fileSize,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
  return map;
}

/**
 * Serialisable, ORDERED list of an application's documents — the first-class
 * `/documents` portal area (PR-8). Sibling to `getDocumentsForApplication`
 * (the keyed-map variant above): same `DocumentMeta` shape, but returns an
 * array ordered for display (slot ascending, then newest-first within a slot)
 * so the page can group by humanised slot without re-sorting client-side.
 *
 * Contributor scoping (dual-parent, data-leak guard): when `ownerContributorId`
 * is supplied the query filters on `uploadedByContributorId` so the lead
 * applicant (their PRIMARY contributor) NEVER sees the secondary parent's
 * uploads — exactly as the review page scopes its document include
 * (`apply/review/page.tsx:396-399`: `documents: { where: { uploadedByContributorId } }`)
 * and as the signed-URL route enforces per-document
 * (`api/documents/[id]/url/route.ts:87-103`). This filter is defence-in-depth
 * ON TOP of RLS — callers MUST still run it under `withUserContext`, never
 * admin context. Omit `ownerContributorId` only for a caller that legitimately
 * wants every contributor's documents (e.g. an admin view under RLS).
 */
export async function getAllDocumentsForApplication(
  tx: Tx,
  applicationId: string,
  ownerContributorId?: string
): Promise<DocumentMeta[]> {
  const rows = await tx.document.findMany({
    where: {
      applicationId,
      ...(ownerContributorId
        ? { uploadedByContributorId: ownerContributorId }
        : {}),
    },
    select: { id: true, slot: true, filename: true, fileSize: true, uploadedAt: true },
    orderBy: [{ slot: "asc" }, { uploadedAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    slot: row.slot,
    filename: row.filename,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt.toISOString(),
  }));
}
