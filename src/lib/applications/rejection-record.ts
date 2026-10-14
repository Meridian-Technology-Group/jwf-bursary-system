/**
 * Epic 22 P3 (CR-002 Phase 5 #5) — the record Reject and restart leaves behind.
 *
 * `rejectAndRestartApplication` hard-deletes the rejected application, so this
 * module writes the short `application_rejections` row the family's schedule
 * reads (Submitted → Rejected → the new attempt), and puts that year's schedule
 * row back to SCHEDULED for the new attempt (D-18). Both run inside the
 * action's transaction, under the service-role context.
 */

import type { ScheduleEntryStatus } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { scheduleYearLabels } from "@/lib/bursary-accounts/lifecycle";

// ─── Schedule row (D-18) ──────────────────────────────────────────────────────

export interface ScheduleRowForRestart {
  status: ScheduleEntryStatus;
  applicationId: string | null;
}

export interface ScheduleRowRestartUpdate {
  status: "SCHEDULED";
  receivedOn: null;
  applicationId: string;
}

/**
 * Pure. Before this, Reject and restart left the year's row RECEIVED with the
 * old submission date and the DELETED application's id (the column has no FK)
 * until the new form was submitted. Reset it — but only when it pointed at the
 * rejected application, and never a COMPLETE row.
 */
export function scheduleRowAfterRestart(
  row: ScheduleRowForRestart,
  rejectedApplicationId: string,
  newApplicationId: string
): ScheduleRowRestartUpdate | null {
  if (row.status === "COMPLETE") return null;
  if (row.applicationId !== rejectedApplicationId) return null;
  return { status: "SCHEDULED", receivedOn: null, applicationId: newApplicationId };
}

// ─── Write path ───────────────────────────────────────────────────────────────

export interface RecordRejectionParams {
  rejectedApplicationId: string;
  newApplicationId: string;
  roundId: string;
  academicYear: string;
  leadApplicantId: string;
  bursaryAccountId: string | null;
  childName: string;
  reference: string;
  submittedAt: Date | null;
  rejectedById: string;
  fromPhase: string;
}

export interface RecordRejectionResult {
  rejectionId: string;
  /** The schedule row reset for the new attempt, if any. */
  scheduleEntryId: string | null;
}

/**
 * Writes the rejection row and resets the year's schedule row. Never touches
 * `bursary_accounts` (the GT loader's rollback guard keys on its updated_at).
 */
export async function recordRejection(
  tx: Tx,
  params: RecordRejectionParams
): Promise<RecordRejectionResult> {
  const rejection = await tx.applicationRejection.create({
    data: {
      roundId: params.roundId,
      academicYear: params.academicYear,
      leadApplicantId: params.leadApplicantId,
      bursaryAccountId: params.bursaryAccountId,
      childName: params.childName,
      reference: params.reference,
      submittedAt: params.submittedAt,
      rejectedById: params.rejectedById,
      replacementApplicationId: params.newApplicationId,
      fromPhase: params.fromPhase,
    },
    select: { id: true },
  });

  let scheduleEntryId: string | null = null;
  if (params.bursaryAccountId) {
    const entry = await tx.bursaryScheduleEntry.findFirst({
      where: {
        bursaryAccountId: params.bursaryAccountId,
        academicYear: { in: scheduleYearLabels(params.academicYear) },
      },
      select: { id: true, status: true, applicationId: true },
    });
    const update = entry
      ? scheduleRowAfterRestart(entry, params.rejectedApplicationId, params.newApplicationId)
      : null;
    if (entry && update) {
      await tx.bursaryScheduleEntry.update({ where: { id: entry.id }, data: update });
      scheduleEntryId = entry.id;
    }
  }

  return { rejectionId: rejection.id, scheduleEntryId };
}

// ─── Read path (P5) ───────────────────────────────────────────────────────────

/**
 * The rejections for a set of accounts, oldest first. Run it under the
 * parent's own RLS context on the portal (they read only their own rows) or
 * the admin context elsewhere.
 */
export async function getRejectionsForAccounts(tx: Tx, accountIds: readonly string[]) {
  if (accountIds.length === 0) return [];
  return tx.applicationRejection.findMany({
    where: { bursaryAccountId: { in: [...accountIds] } },
    orderBy: { rejectedAt: "asc" },
    select: {
      id: true,
      bursaryAccountId: true,
      academicYear: true,
      submittedAt: true,
      rejectedAt: true,
      replacementApplicationId: true,
    },
  });
}
