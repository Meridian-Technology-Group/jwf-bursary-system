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
import { scheduleRowDates } from "@/lib/bursary-accounts/schedule-dates";

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
  /**
   * Epic 21 #3 — the year's application the VIEWER can open (linked, else
   * matched by academic year), for the link to that year's assessment. Null
   * when there is none, or when RLS hides it from this viewer (D-4).
   */
  applicationId: string | null;
  /**
   * Epic 21 R2 — the family's own deadline (that year's application's
   * `submissionDeadlineAt` override) when it falls on another day than
   * `requiredBy`; null otherwise. ISO string.
   */
  familyDeadline: string | null;
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

  // Epic 21 #3 — only applications this viewer can read (RLS), keyed by id
  // and by the academic year's start (rows are "2026-27", rounds "2026/27").
  const visibleApps = await tx.application.findMany({
    where: { bursaryAccountId },
    select: {
      id: true,
      submissionDeadlineAt: true,
      round: { select: { academicYear: true } },
    },
  });
  const appById = new Map(visibleApps.map((a) => [a.id, a]));
  const appByStartYear = new Map(
    visibleApps.map((a) => [parseAcademicYearStart(a.round.academicYear), a])
  );

  return entries.map((e) => {
    const app =
      (e.applicationId ? appById.get(e.applicationId) : undefined) ??
      appByStartYear.get(parseAcademicYearStart(e.academicYear)) ??
      null;
    const dates = scheduleRowDates({
      availableOn: e.availableOn,
      requiredBy: e.requiredBy,
      application: app,
    });
    return {
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
      applicationId: app?.id ?? null,
      familyDeadline: dates.hasOwnDeadline && dates.submitBy ? dates.submitBy.toISOString() : null,
    };
  });
}

/**
 * Epic 22 P5 — every ACTIVE account the parent leads, each with its
 * PORTAL-VISIBLE schedule rows (`showOnPortal`), for My Application(s)
 * Schedule. Replaces gap F2's single-account loader, which showed a family
 * with several children only one calendar.
 *
 * Runs under the CALLER's RLS context: the `bursary_schedule_entries_select`
 * policy scopes an applicant to their own accounts' rows, and the
 * `showOnPortal` filter is applied in SQL so hidden years never leave the
 * database. Only accounts with at least one visible row are returned.
 */
export async function getPortalScheduleAccountsForUser(tx: Tx, userId: string) {
  const accounts = await tx.bursaryAccount.findMany({
    where: { leadApplicantId: userId, status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      childName: true,
      school: true,
      entryYearGroup: true,
      firstAssessmentYear: true,
      scheduleEntries: {
        where: { showOnPortal: true },
        orderBy: { scheduleYear: "asc" },
        select: {
          scheduleYear: true,
          academicYear: true,
          status: true,
          availableOn: true,
          requiredBy: true,
          receivedOn: true,
          applicationId: true,
        },
      },
    },
  });
  return accounts.filter((a) => a.scheduleEntries.length > 0);
}

/**
 * Does the signed-in parent have an ACTIVE account with ≥1 portal-visible
 * schedule row? Drives the "My Application(s) Schedule" nav item (gap F2).
 * Epic 22 P5: any of the family's accounts counts — the page now shows all of
 * them, so the single-account tie-break this used to need is gone.
 */
export async function hasPortalSchedule(tx: Tx, userId: string): Promise<boolean> {
  const count = await tx.bursaryScheduleEntry.count({
    where: {
      showOnPortal: true,
      bursaryAccount: { leadApplicantId: userId, status: "ACTIVE" },
    },
  });
  return count > 0;
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
        // Epic 21 #5: the show-on-portal tick governs this as it does the
        // family's schedule page (`getPortalScheduleAccountsForUser`).
        where: { showOnPortal: true },
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
