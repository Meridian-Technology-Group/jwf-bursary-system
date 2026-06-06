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
