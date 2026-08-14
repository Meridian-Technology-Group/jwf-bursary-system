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
 *
 * Epic 13 / C1 adds the one sanctioned inverse, `reopenAccountForAssessmentYear`
 * — used when an assessor reopens a COMPLETED assessment, so the account stops
 * claiming that year is finished. See its docstring for why un-closing is a
 * documented exception to the set-once `closedAt` rule rather than a licence to
 * toggle account state generally.
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

export interface ReopenResult {
  /** True when this call moved the year's schedule entry COMPLETE → RECEIVED. */
  scheduleEntryReopened: boolean;
  /** True when this call transitioned the account CLOSED → ACTIVE. */
  accountReopened: boolean;
}

/**
 * Undo the close-on-complete effects of one assessment year — the exact inverse
 * of the `mirrorApplicationToSchedule({ status: "COMPLETE" })` +
 * `closeAccountIfComplete` pair that `completeAssessmentAction` runs.
 *
 * Called ONLY from the assessment reopen path (Epic 13 / C1, D13-2). When an
 * assessor reopens a COMPLETED assessment, the account must stop claiming that
 * year is finished: the year's schedule entry goes COMPLETE → RECEIVED and, if
 * that completion is what auto-closed the account, the account goes CLOSED →
 * ACTIVE (restoring the parent's portal access, which is keyed off the account
 * status — see lib/bursary-accounts/access.ts).
 *
 * ⚠️ DELIBERATE EXCEPTION to the set-once `closedAt` rule. Both
 * `BursaryAccount.closedAt` and the `Application.closedAt` it mirrors are
 * documented as written exactly once, and every OTHER path honours that: an
 * account close is a historical fact, not a toggle. This function is the single
 * sanctioned reversal, and it is narrow enough to stay safe:
 *   - It only ever reverses an AUTOMATIC close. `closeAccountIfComplete` is the
 *     only automatic writer of CLOSED; an ADMIN manual close is a separate
 *     action and a separate decision, so we refuse to reverse a close that
 *     cannot have come from this year's completion (see the guard below).
 *   - Its caller is gated on "no outcome set", so nothing downstream of an
 *     award decision has been communicated or promoted yet.
 *   - It clears `closedAt` rather than back-dating it: the account is genuinely
 *     no longer closed, so leaving a stale timestamp would be the lie.
 * Anything wanting to un-close an account for another reason needs its own
 * decision — do not generalise this.
 *
 * Idempotent: a schedule entry that is not COMPLETE and an account that is not
 * CLOSED are both left untouched. No-op (all false) when the account has no
 * schedule entry for that year.
 */
export async function reopenAccountForAssessmentYear(
  tx: Tx,
  params: { bursaryAccountId: string; academicYear: string }
): Promise<ReopenResult> {
  const result: ReopenResult = {
    scheduleEntryReopened: false,
    accountReopened: false,
  };

  const entry = await tx.bursaryScheduleEntry.findFirst({
    where: {
      bursaryAccountId: params.bursaryAccountId,
      academicYear: params.academicYear,
    },
    select: { id: true, status: true },
  });

  if (entry && entry.status === "COMPLETE") {
    await tx.bursaryScheduleEntry.update({
      where: { id: entry.id },
      data: { status: "RECEIVED" },
    });
    result.scheduleEntryReopened = true;
  }

  // Only reverse a close that this year's completion could have caused. If the
  // year had no COMPLETE entry to reverse, the account's CLOSED state came from
  // somewhere else (a manual admin close, another year) — leave it alone.
  if (!result.scheduleEntryReopened) return result;

  const account = await tx.bursaryAccount.findUnique({
    where: { id: params.bursaryAccountId },
    select: { status: true },
  });
  if (account?.status === "CLOSED") {
    await tx.bursaryAccount.update({
      where: { id: params.bursaryAccountId },
      data: { status: "ACTIVE", closedAt: null },
    });
    result.accountReopened = true;
  }

  return result;
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
