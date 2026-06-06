/**
 * Epic 10 — account close-when-complete + schedule status mirroring.
 *
 * "[The account becomes] closed when the full schedule of assessments and
 * applications has been completed." When every schedule row reaches a terminal
 * state (COMPLETE), the account flips ACTIVE → CLOSED with `closedAt = now`,
 * which in turn revokes the parent's portal access (the access guard reads the
 * account status — see lib/bursary-accounts/access.ts).
 *
 * This is the ONLY automatic writer of CLOSED. Admin manual-close is a separate
 * server action. Closing is idempotent (a CLOSED account stays CLOSED).
 */

import type { Tx } from "@/lib/db/prisma";
import type { ScheduleEntryStatus } from "@prisma/client";

/**
 * Pure: an account is complete iff it has at least one schedule entry and EVERY
 * entry is terminal (COMPLETE). An account with no schedule (legacy, or pre-
 * generation) is NOT complete — it is never auto-closed on emptiness.
 */
export function isScheduleComplete(
  entryStatuses: ScheduleEntryStatus[]
): boolean {
  if (entryStatuses.length === 0) return false;
  return entryStatuses.every((s) => s === "COMPLETE");
}

export interface CloseResult {
  /** True when this call transitioned the account ACTIVE → CLOSED. */
  closed: boolean;
}

/**
 * Close the account if its schedule is fully complete. Reads the schedule and,
 * when complete and currently ACTIVE, sets CLOSED + closedAt. Idempotent and
 * safe to call after any schedule-status change.
 */
export async function closeAccountIfComplete(
  tx: Tx,
  bursaryAccountId: string,
  now: Date = new Date()
): Promise<CloseResult> {
  const account = await tx.bursaryAccount.findUnique({
    where: { id: bursaryAccountId },
    select: {
      status: true,
      scheduleEntries: { select: { status: true } },
    },
  });

  if (!account || account.status === "CLOSED") return { closed: false };

  const complete = isScheduleComplete(
    account.scheduleEntries.map((e) => e.status)
  );
  if (!complete) return { closed: false };

  await tx.bursaryAccount.update({
    where: { id: bursaryAccountId },
    data: { status: "CLOSED", closedAt: now },
  });
  return { closed: true };
}

/**
 * Mirror a submitted/assessed application onto its schedule entry. Called when a
 * year's application is submitted (→ RECEIVED) and when its assessment completes
 * (→ COMPLETE). Matching is by `academicYear` within the account's schedule;
 * never rewrites an already-COMPLETE row backwards.
 *
 * Returns the updated entry id (or null when no matching schedule row exists —
 * e.g. a manually-created application outside the generated grid).
 */
export async function mirrorApplicationToSchedule(
  tx: Tx,
  params: {
    bursaryAccountId: string;
    academicYear: string;
    applicationId: string;
    roundId: string;
    status: "RECEIVED" | "COMPLETE";
    receivedOn?: Date | null;
  }
): Promise<string | null> {
  const entry = await tx.bursaryScheduleEntry.findFirst({
    where: {
      bursaryAccountId: params.bursaryAccountId,
      academicYear: params.academicYear,
    },
    select: { id: true, status: true },
  });
  if (!entry) return null;

  // Never move a COMPLETE row back to RECEIVED.
  if (entry.status === "COMPLETE" && params.status === "RECEIVED") {
    return entry.id;
  }

  await tx.bursaryScheduleEntry.update({
    where: { id: entry.id },
    data: {
      status: params.status,
      applicationId: params.applicationId,
      roundId: params.roundId,
      receivedOn:
        params.receivedOn !== undefined ? params.receivedOn : undefined,
    },
  });
  return entry.id;
}
