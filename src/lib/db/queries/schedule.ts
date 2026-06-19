/**
 * Epic 10 — read model for the admin forward-schedule grid.
 *
 * Loads a bursary account's schedule entries (the illustration's Year 1..N
 * grid) ordered by schedule year, serialised to plain JSON-safe shapes so no
 * Prisma Date/Decimal object crosses the server→client boundary.
 */

import type { Tx } from "@/lib/db/prisma";
import type { ScheduleEntryStatus, ScheduleEntryType } from "@prisma/client";

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
  const account = await tx.bursaryAccount.findFirst({
    where: { leadApplicantId: userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
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
 * A lightweight count, kept separate from the full read so the portal layout's
 * nav decision is one cheap query rather than fetching every row.
 */
export async function hasPortalSchedule(
  tx: Tx,
  userId: string
): Promise<boolean> {
  const count = await tx.bursaryScheduleEntry.count({
    where: {
      showOnPortal: true,
      bursaryAccount: { leadApplicantId: userId, status: "ACTIVE" },
    },
  });
  return count > 0;
}
