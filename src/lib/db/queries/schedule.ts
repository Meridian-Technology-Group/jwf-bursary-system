/**
 * Epic 10 — read model for the admin forward-schedule grid.
 *
 * Loads a bursary account's schedule entries (the illustration's Year 1..N
 * grid) ordered by schedule year, serialised to plain JSON-safe shapes so no
 * Prisma Date/Decimal object crosses the server→client boundary.
 */

import type { Tx } from "@/lib/db/prisma";
import type { ScheduleEntryStatus, ScheduleEntryType } from "@prisma/client";
import { parseAcademicYearStart } from "@/lib/assessment/fee-year";

/** A schedule-grid row, serialised for the client component. */
export interface ScheduleEntryRow {
  id: string;
  scheduleYear: number;
  academicYear: string;
  type: ScheduleEntryType;
  status: ScheduleEntryStatus;
  manuallyCreated: boolean;
  /** ISO date strings (or null) — formatted client-side. */
  availableOn: string | null;
  requiredBy: string | null;
  receivedOn: string | null;
  showOnPortal: boolean;
  hasRound: boolean;
  hasApplication: boolean;
}

/**
 * Returns the forward schedule for a bursary account, oldest year first. Runs
 * under the caller's RLS context (staff see all; an applicant sees their own
 * account's rows, but the grid is staff-only UI).
 */
export async function getScheduleForAccount(
  tx: Tx,
  bursaryAccountId: string
): Promise<ScheduleEntryRow[]> {
  const entries = await tx.bursaryScheduleEntry.findMany({
    where: { bursaryAccountId },
    orderBy: { scheduleYear: "asc" },
    select: {
      id: true,
      scheduleYear: true,
      academicYear: true,
      type: true,
      status: true,
      manuallyCreated: true,
      availableOn: true,
      requiredBy: true,
      receivedOn: true,
      showOnPortal: true,
      roundId: true,
      applicationId: true,
    },
  });

  return entries.map((e) => ({
    id: e.id,
    scheduleYear: e.scheduleYear,
    academicYear: e.academicYear,
    type: e.type,
    status: e.status,
    manuallyCreated: e.manuallyCreated,
    availableOn: e.availableOn ? e.availableOn.toISOString() : null,
    requiredBy: e.requiredBy ? e.requiredBy.toISOString() : null,
    receivedOn: e.receivedOn ? e.receivedOn.toISOString() : null,
    showOnPortal: e.showOnPortal,
    hasRound: e.roundId != null,
    hasApplication: e.applicationId != null,
  }));
}

/**
 * Gap F2 — the minimal account + portal-visible schedule a parent may see.
 *
 * Returned to the read-only portal calendar (`(portal)/schedule`). It carries
 * ONLY what the calendar needs to draw the Year 6 → Year 13 span:
 *   - the account's `entryYearGroup` + `firstAssessmentYear` (anchor the span),
 *   - the academic year + 1-based `scheduleYear` of each `showOnPortal` entry.
 *
 * It deliberately carries NO prior application data — no application ids, no
 * round links, no assessment/financial fields. The calendar is informational
 * reassurance only.
 */
export interface PortalScheduleData {
  bursaryAccountId: string;
  entryYearGroup: import("@prisma/client").EntryYearGroup | null;
  firstAssessmentYear: string;
  /** ONLY the entries flagged `showOnPortal` — already filtered server-side. */
  visibleEntries: { scheduleYear: number; academicYear: string }[];
}

/**
 * Loads the signed-in family's ACTIVE account and its PORTAL-VISIBLE schedule
 * entries (where `showOnPortal` is true). Returns `null` when the user has no
 * ACTIVE account (the calendar is then not shown).
 *
 * Runs under the CALLER's RLS context: the `bursary_schedule_entries_select`
 * policy already scopes an applicant to their own account's rows, so this is
 * the parent reading their own data — never another family's. The `showOnPortal`
 * filter is applied in SQL so hidden (far-future / admin-withheld) rows never
 * leave the database.
 */
export async function getPortalScheduleForUser(
  tx: Tx,
  userId: string
): Promise<PortalScheduleData | null> {
  // SINGLE-ACCOUNT ASSUMPTION: a lead applicant with more than one ACTIVE
  // account (e.g. separate accounts per sibling) currently sees only ONE
  // calendar — the deterministically-resolved account below. Rendering one
  // calendar per account is out of scope for gap F2; `hasPortalSchedule` MUST
  // resolve the SAME account (it delegates here) so the nav gate and this page
  // loader never disagree about which account is "the user's schedule".
  const account = await tx.bursaryAccount.findFirst({
    where: { leadApplicantId: userId, status: "ACTIVE" },
    // Deterministic single-account selection. `createdAt` is the primary key of
    // the ordering; `id` is a stable tiebreak so two accounts created in the
    // same instant still resolve to one fixed account across both queries.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      entryYearGroup: true,
      firstAssessmentYear: true,
      scheduleEntries: {
        where: { showOnPortal: true },
        orderBy: { scheduleYear: "asc" },
        select: { scheduleYear: true, academicYear: true },
      },
    },
  });

  if (!account) return null;

  return {
    bursaryAccountId: account.id,
    entryYearGroup: account.entryYearGroup,
    firstAssessmentYear: account.firstAssessmentYear,
    visibleEntries: account.scheduleEntries.map((e) => ({
      scheduleYear: e.scheduleYear,
      academicYear: e.academicYear,
    })),
  };
}

/**
 * Gap F2 — does the signed-in user have an ACTIVE account with ≥1 portal-visible
 * schedule entry? Drives the conditional "Assessment Schedule" nav item: the
 * calendar link is shown ONLY to ACTIVE families that actually have a schedule.
 *
 * Defined as "the account `getPortalScheduleForUser` would load has ≥1
 * portal-visible entry" — it delegates to that loader rather than running its
 * own account-resolution query. This guarantees the nav item is shown IFF the
 * page would render a non-empty calendar for the SAME account: with more than
 * one ACTIVE account (siblings) a count across all accounts could otherwise be
 * positive while the loader picks a different, empty account (nav shown, blank
 * page). See the single-account assumption in `getPortalScheduleForUser`.
 */
export async function hasPortalSchedule(
  tx: Tx,
  userId: string
): Promise<boolean> {
  const data = await getPortalScheduleForUser(tx, userId);
  return data != null && data.visibleEntries.length > 0;
}

/**
 * Epic 14 D3 (CG-02) — the returning parent's Bursary Application Schedule:
 * every ACTIVE account the profile leads, each with its FULL entry span plus
 * the per-entry round dates and any matching application.
 *
 * MUST run under ADMIN context, scoped by the explicit `leadApplicantId`
 * filter: the row needs `round_windows` (staff-only RLS select policy) and
 * cross-round application matching, both of which the applicant role cannot
 * read. Only derived, parent-safe fields leave this function — dates, states
 * and the application id used for the CONTINUE deep link. Same precedent as
 * the dashboard's invitation lookup / paused-state probe.
 */
export interface ScheduleHomeAccountData {
  accountId: string;
  childName: string;
  school: import("@prisma/client").School;
  entryYearGroup: import("@prisma/client").EntryYearGroup | null;
  entries: import("@/lib/bursary-accounts/schedule-home").ScheduleHomeEntryInput[];
}

export async function getScheduleHomeForUser(
  tx: Tx,
  userId: string
): Promise<ScheduleHomeAccountData[]> {
  const accounts = await tx.bursaryAccount.findMany({
    where: { leadApplicantId: userId, status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      childName: true,
      school: true,
      entryYearGroup: true,
      scheduleEntries: {
        orderBy: { scheduleYear: "asc" },
        select: {
          scheduleYear: true,
          academicYear: true,
          availableOn: true,
          requiredBy: true,
          status: true,
          roundId: true,
          applicationId: true,
        },
      },
    },
  });
  if (accounts.length === 0) return [];

  const roundIds = Array.from(
    new Set(
      accounts.flatMap((a) =>
        a.scheduleEntries.map((e) => e.roundId).filter((id): id is string => !!id)
      )
    )
  );
  const rounds = roundIds.length
    ? await tx.round.findMany({
        where: { id: { in: roundIds } },
        select: {
          id: true,
          openDate: true,
          closeDate: true,
          decisionDate: true,
          defaultSubmissionDeadlineNew: true,
          defaultSubmissionDeadlineRolling: true,
          windows: {
            select: {
              scenario: true,
              opensOn: true,
              submitBy: true,
              defaultTaxYear: true,
            },
          },
        },
      })
    : [];
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  const apps = await tx.application.findMany({
    where: { leadApplicantId: userId },
    select: {
      id: true,
      formStatus: true,
      applicationType: true,
      submissionDeadlineAt: true,
      bursaryAccountId: true,
      childName: true,
      round: { select: { academicYear: true } },
    },
  });
  const appById = new Map(apps.map((a) => [a.id, a]));

  return accounts.map((account) => ({
    accountId: account.id,
    childName: account.childName,
    school: account.school,
    entryYearGroup: account.entryYearGroup,
    entries: account.scheduleEntries.map((e) => {
      // Application match: the entry's own back-link wins; otherwise match by
      // academic year on this account's applications (Epic 10 links lazily,
      // so back-links are often absent). Unlinked applications
      // (bursaryAccountId null — the original NEW app) match by child name.
      const entryStart = parseAcademicYearStart(e.academicYear);
      const app =
        (e.applicationId ? appById.get(e.applicationId) : undefined) ??
        apps.find(
          (a) =>
            parseAcademicYearStart(a.round?.academicYear) === entryStart &&
            entryStart != null &&
            (a.bursaryAccountId === account.id ||
              (a.bursaryAccountId == null &&
                a.childName.trim().toLowerCase() ===
                  account.childName.trim().toLowerCase()))
        );
      const round = e.roundId ? roundById.get(e.roundId) : undefined;
      return {
        scheduleYear: e.scheduleYear,
        academicYear: e.academicYear,
        availableOn: e.availableOn,
        requiredBy: e.requiredBy,
        status: e.status,
        round: round
          ? {
              openDate: round.openDate,
              closeDate: round.closeDate,
              decisionDate: round.decisionDate,
              defaultSubmissionDeadlineNew: round.defaultSubmissionDeadlineNew,
              defaultSubmissionDeadlineRolling:
                round.defaultSubmissionDeadlineRolling,
              windows: round.windows,
            }
          : null,
        application: app
          ? {
              id: app.id,
              formStatus: app.formStatus,
              applicationType: app.applicationType,
              submissionDeadlineAt: app.submissionDeadlineAt,
            }
          : null,
      };
    }),
  }));
}
