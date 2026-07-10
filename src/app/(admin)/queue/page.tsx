/**
 * Application Queue — admin page.
 *
 * Server component. Requires ASSESSOR or VIEWER role.
 * Fetches the full application list and passes it to the client-side
 * ApplicationTable component for filtering/sorting.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  listApplications,
  listRounds,
  getApplicationNames,
  type ListApplicationsFilters,
} from "@/lib/db/queries/applications";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { getRoundWatchlist } from "@/lib/db/queries/round-watchlist";
import { getActiveRound } from "@/lib/db/queries/reports";
import { getActiveBursaryHolders } from "@/lib/db/queries/invitations";
import { RoundStatus } from "@prisma/client";
import { listAssessors } from "@/lib/db/queries/profiles";
import type { WatchlistRuleId } from "@/lib/db/queries/round-watchlist";
import { ApplicationTable } from "@/components/admin/application-table";
import { InternalRequestDialog } from "@/components/admin/internal-request-dialog";
import { School } from "@prisma/client";
import {
  ALL_REVIEW_PHASES,
  type ReviewPhase,
} from "@/lib/applications/queue-filter";
import { deriveReviewPhase } from "@/lib/applications/status";
import { REVIEW_PHASE_LABEL } from "@/lib/applications/review-phase-labels";
import { effectiveSubmissionDeadline } from "@/lib/rounds/submission-deadline";
import {
  londonStartOfDayUtc,
  londonEndOfDayUtc,
  formatLondonDateString,
} from "@/lib/datetime";

export const metadata = {
  title: "Applications",
};

// ─── Search-param parsing helpers ──────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isTruthyFlag(value: string | string[] | undefined): boolean {
  return firstValue(value) === "1";
}

// The status URL param carries a review-phase value (Epic 01 PR-6a) — the same
// 7-value vocabulary the old fused enum used, so existing drill-in links
// (`?status=SUBMITTED`, `?status=PAUSED`) keep working.
const REVIEW_PHASES = new Set<string>(ALL_REVIEW_PHASES);
const SCHOOLS = new Set<string>(Object.values(School));

function parseStatus(
  value: string | string[] | undefined
): ReviewPhase | undefined {
  const raw = firstValue(value);
  return raw && REVIEW_PHASES.has(raw) ? (raw as ReviewPhase) : undefined;
}

function parseSchool(
  value: string | string[] | undefined
): School | undefined {
  const raw = firstValue(value);
  return raw && SCHOOLS.has(raw) ? (raw as School) : undefined;
}

// Received-date range (Item 7.1). A plain `YYYY-MM-DD` calendar-date string —
// the client always produces this (from a `<input type="date">`), but the URL
// is user-editable, so malformed values are ignored rather than crashing.
const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | string[] | undefined): string | undefined {
  const raw = firstValue(value);
  return raw && DATE_PARAM_PATTERN.test(raw) ? raw : undefined;
}

/**
 * Serialises the current search params back to a query string. Passed to the
 * client table so the received-date filter (7.1) can preserve every other
 * active param when it navigates, without a client-side `useSearchParams()`
 * call (which would require wrapping the table in a Suspense boundary).
 */
function buildQueryString(params: SearchParams): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      usp.append(key, v);
    }
  }
  return usp.toString();
}

// Each derived flag maps to exactly one watchlist rule whose deduped `appIds`
// define the drill-in set (keeps the queue identical to the lane's count).
const DERIVED_RULE_BY_FLAG: Record<string, WatchlistRuleId> = {
  docsMissing: "SUBMITTED_MISSING_DOCS",
  stale: "ASSESSMENT_STALLED",
  awaitingOutcome: "RECOMMENDATION_AWAITING_OUTCOME",
};

export default async function QueuePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const profile = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const params: SearchParams = searchParams ? await searchParams : {};

  // Simple, column-backed filters.
  const roundId = firstValue(params.roundId);
  const status = parseStatus(params.status);
  const school = parseSchool(params.school);
  const undecided = isTruthyFlag(params.undecided);

  // Received-date range (Item 7.1). Parsed as Europe/London calendar dates;
  // an inverted range from a hand-edited URL is silently ignored (not
  // applied) rather than erroring — the filter bar's own client-side
  // validation is what stops a valid session from ever producing one.
  const submittedFromParam = parseDateParam(params.submittedFrom);
  const submittedToParam = parseDateParam(params.submittedTo);
  const submittedRangeValid =
    !submittedFromParam ||
    !submittedToParam ||
    submittedFromParam <= submittedToParam;

  // Submission-by (deadline) range (Item 7.2) — same parsing/validation
  // approach as the received-date range above.
  const deadlineFromParam = parseDateParam(params.deadlineFrom);
  const deadlineToParam = parseDateParam(params.deadlineTo);
  const deadlineRangeValid =
    !deadlineFromParam || !deadlineToParam || deadlineFromParam <= deadlineToParam;

  // Re-assessment-eligible drill-in: ADMIN-only. Shows the prior-round winning
  // applications linked to bursary holders who are eligible to be invited into
  // the open round (cross-round is intended).
  const reassessEligible =
    profile.role === Role.ADMIN && isTruthyFlag(params.reassessEligible);

  // Derived, round-scoped flags (resolved against the stage-B watchlist).
  const activeDerivedFlags = Object.keys(DERIVED_RULE_BY_FLAG).filter((flag) =>
    isTruthyFlag(params[flag])
  );

  const applicationFilters: ListApplicationsFilters =
    profile.role === Role.ASSESSOR ? { assignedToId: profile.id } : {};

  if (roundId) applicationFilters.roundId = roundId;
  if (status) applicationFilters.reviewPhases = [status];
  if (school) applicationFilters.school = school;
  if (undecided) applicationFilters.undecided = true;
  if (submittedRangeValid && submittedFromParam) {
    applicationFilters.submittedFrom = londonStartOfDayUtc(submittedFromParam);
  }
  if (submittedRangeValid && submittedToParam) {
    applicationFilters.submittedTo = londonEndOfDayUtc(submittedToParam);
  }
  if (deadlineRangeValid && deadlineFromParam) {
    applicationFilters.deadlineFrom = deadlineFromParam;
  }
  if (deadlineRangeValid && deadlineToParam) {
    applicationFilters.deadlineTo = deadlineToParam;
  }

  const { applications, names, rounds, assessors, reassessRoundYear } =
    await withUserContext(
    profile.id,
    profile.role as RlsRole,
    async (tx) => {
      // Re-assessment-eligible filter: resolve the target OPEN round, then scope
      // the queue to the applications linked to its eligible bursary holders. No
      // open round → show nothing (empty bursaryAccountIds set).
      //
      // Epic 03 (concurrent rounds): when the queue is scoped to a specific
      // round (`roundId`), resolve re-assessment eligibility against THAT round
      // — not "the" open round (there may be several). Only fall back to the
      // default active round when the queue is not round-scoped.
      let reassessRoundYear: string | null = null;
      if (reassessEligible) {
        const round = roundId
          ? await tx.round.findUnique({
              where: { id: roundId },
              select: { id: true, academicYear: true, status: true },
            })
          : await getActiveRound(tx);
        if (round && round.status === RoundStatus.OPEN) {
          reassessRoundYear = round.academicYear;
          const holders = await getActiveBursaryHolders(tx, round.id);
          applicationFilters.bursaryAccountIds = holders.map((h) => h.id);
        } else {
          applicationFilters.bursaryAccountIds = [];
        }
      }

      // Resolve derived flags against the watchlist so the queue shows EXACTLY
      // the applications the lane counted. Only meaningful when a round is
      // scoped (the watchlist is per-round).
      if (activeDerivedFlags.length > 0 && roundId) {
        const watchlist = await getRoundWatchlist(tx, roundId);
        // Intersect across flags (normally only one arrives).
        let ids: string[] | null = null;
        for (const flag of activeDerivedFlags) {
          const ruleId = DERIVED_RULE_BY_FLAG[flag];
          const rule = watchlist?.rules.find((r) => r.id === ruleId);
          const ruleIds = rule?.applicationIds ?? [];
          ids =
            ids === null
              ? ruleIds
              : ids.filter((id) => ruleIds.includes(id));
        }
        applicationFilters.ids = ids ?? [];
      } else if (activeDerivedFlags.length > 0) {
        // Derived flag without a round → nothing to scope against; show none.
        applicationFilters.ids = [];
      }

      // Assessor list only needed for the ADMIN bulk-assign dropdown.
      const [applications, rounds, assessors] = await Promise.all([
        listApplications(tx, applicationFilters),
        listRounds(tx),
        profile.role === Role.ADMIN ? listAssessors(tx) : Promise.resolve([]),
      ]);

      // Lead applicant name + email are shown as first-class columns (they are
      // no longer behind a per-session reveal toggle). Fetch them for exactly
      // the applications the viewer can see and write ONE audit entry per page
      // load so the GDPR name-disclosure trail is preserved.
      const nameRows =
        applications.length > 0
          ? await getApplicationNames(
              tx,
              applications.map((a) => a.id)
            )
          : [];
      if (nameRows.length > 0) {
        await createAuditLog(tx, {
          userId: profile.id,
          action: AUDIT_ACTIONS.NAME_REVEAL,
          entityType: AUDIT_ENTITY_TYPES.Application,
          context: "Applications list — lead applicant names shown",
          metadata: {
            applicationIds: nameRows.map((n) => n.id),
            count: nameRows.length,
          },
        });
      }
      const names = nameRows.map((n) => ({
        id: n.id,
        leadApplicantName:
          [n.leadApplicant.firstName, n.leadApplicant.lastName]
            .filter(Boolean)
            .join(" ") || n.leadApplicant.email,
        leadApplicantEmail: n.leadApplicant.email,
      }));

      // Status column (Item 1.1): derive each row's review phase server-side
      // via the same `deriveReviewPhase` the detail page uses, so the list and
      // detail page always agree. Computed here (not in the query layer) since
      // it's a presentational concern of this one list, not of every
      // `listApplications` caller.
      //
      // Deadline column (Item 1.2): same treatment, via the ONE shared
      // `effectiveSubmissionDeadline()` helper (Epic 03 / Item 12/D-1) — do
      // not re-derive the override/round-default/close-date chain here.
      const applicationsWithPhase = applications.map((app) => ({
        ...app,
        reviewPhase: deriveReviewPhase({
          formStatus: app.formStatus,
          assessmentStatus: app.assessmentStatus,
          outcome: app.outcome,
        }),
        effectiveDeadline: effectiveSubmissionDeadline(
          { submissionDeadlineAt: app.submissionDeadlineAt },
          app.round
        ).deadline,
      }));

      return {
        applications: applicationsWithPhase,
        names,
        rounds,
        assessors,
        reassessRoundYear,
      };
    }
  );

  // Seed values for the client table UI (simple filters only). The `?status=`
  // drill-in still filters server-side and is surfaced by the `activeFilter`
  // banner below; the client-side status MULTI-select (1.3) is independent
  // client-only state, not seeded from this param.
  const initialRound = roundId;
  const initialSchool = school;
  // Only seed the date inputs with a range that was actually applied — an
  // invalid (from > to) hand-edited URL shows blank inputs rather than a
  // filter that silently isn't in effect.
  const initialSubmittedFrom = submittedRangeValid ? submittedFromParam : undefined;
  const initialSubmittedTo = submittedRangeValid ? submittedToParam : undefined;
  const initialDeadlineFrom = deadlineRangeValid ? deadlineFromParam : undefined;
  const initialDeadlineTo = deadlineRangeValid ? deadlineToParam : undefined;

  // Plain-English descriptor of the active filter for the dismissible banner.
  // The re-assessment-eligible drill-in owns the banner when active (it is the
  // dominant, cross-round descriptor).
  const activeFilter = reassessEligible
    ? {
        label:
          "Re-assessment eligible" +
          (reassessRoundYear
            ? ` · → ${reassessRoundYear}`
            : " · no open round"),
        clearHref: "/queue",
      }
    : describeActiveFilter({
        roundId,
        status,
        school,
        undecided,
        activeDerivedFlags,
        rounds,
        submittedFrom: initialSubmittedFrom,
        submittedTo: initialSubmittedTo,
        deadlineFrom: initialDeadlineFrom,
        deadlineTo: initialDeadlineTo,
      });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Applications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and assess submitted bursary applications.
          </p>
        </div>
        <InternalRequestDialog rounds={rounds} />
      </div>

      {/* Data table */}
      <ApplicationTable
        applications={applications}
        names={names}
        rounds={rounds}
        assessors={assessors}
        userRole={profile.role}
        initialRound={initialRound}
        initialSchool={initialSchool}
        initialSubmittedFrom={initialSubmittedFrom}
        initialSubmittedTo={initialSubmittedTo}
        initialDeadlineFrom={initialDeadlineFrom}
        initialDeadlineTo={initialDeadlineTo}
        currentQueryString={buildQueryString(params)}
        activeFilter={activeFilter}
        reassessEligibleActive={reassessEligible}
        reassessTargetRound={reassessRoundYear}
      />
    </div>
  );
}

// ─── Active-filter description ──────────────────────────────────────────────────

const DERIVED_LABELS: Record<string, string> = {
  docsMissing: "Submitted applications missing required documents",
  stale: "Assessments with no activity for over 5 days",
  awaitingOutcome: "Awaiting outcome",
};

const SCHOOL_LABELS: Record<School, string> = {
  TRINITY: "Trinity",
  WHITGIFT: "Whitgift",
};

function describeActiveFilter({
  roundId,
  status,
  school,
  undecided,
  activeDerivedFlags,
  rounds,
  submittedFrom,
  submittedTo,
  deadlineFrom,
  deadlineTo,
}: {
  roundId: string | undefined;
  status: ReviewPhase | undefined;
  school: School | undefined;
  undecided: boolean;
  activeDerivedFlags: string[];
  rounds: { id: string; academicYear: string }[];
  /** Received-date range (Item 7.1), as the applied `YYYY-MM-DD` strings. */
  submittedFrom?: string;
  submittedTo?: string;
  /** Submission-by (deadline) range (Item 7.2), as the applied `YYYY-MM-DD` strings. */
  deadlineFrom?: string;
  deadlineTo?: string;
}): { label: string; clearHref: string } | undefined {
  const parts: string[] = [];

  const roundLabel = roundId
    ? rounds.find((r) => r.id === roundId)?.academicYear
    : undefined;
  if (roundLabel) parts.push(`Round ${roundLabel}`);

  // A derived flag is the dominant descriptor when present.
  if (activeDerivedFlags.length > 0) {
    for (const flag of activeDerivedFlags) {
      if (DERIVED_LABELS[flag]) parts.push(DERIVED_LABELS[flag]);
    }
  } else {
    if (undecided) parts.push("Undecided");
    if (status) parts.push(REVIEW_PHASE_LABEL[status]);
  }

  if (school) parts.push(SCHOOL_LABELS[school]);

  if (submittedFrom || submittedTo) {
    const fromLabel = submittedFrom
      ? formatLondonDateString(submittedFrom)
      : "the start";
    const toLabel = submittedTo ? formatLondonDateString(submittedTo) : "now";
    parts.push(`Received ${fromLabel} – ${toLabel}`);
  }

  if (deadlineFrom || deadlineTo) {
    const fromLabel = deadlineFrom
      ? formatLondonDateString(deadlineFrom)
      : "the start";
    const toLabel = deadlineTo ? formatLondonDateString(deadlineTo) : "now";
    parts.push(`Submission-by ${fromLabel} – ${toLabel}`);
  }

  if (parts.length === 0) return undefined;

  return { label: parts.join(" · "), clearHref: "/queue" };
}
