"use server";

/**
 * Epic 18b — the mid-September ritual: "Could I have then a functionality to
 * select all my rolling-over complete assessments to be marked as 'LOCKED'"
 * (Charlotte, 6 Sep 2026).
 *
 * `bulkLockRolledOverAction` locks every rolling-over assessment currently
 * stored as complete as a ROLLED_OVER award, in one go. Per-assessment it
 * carries the award fund forward from the account's most recent previous
 * award (fallback JWF — flagged to her as the default rule), and delegates
 * the lock itself to `setPostAssessmentFinalState`, so every gate the single
 * lock applies (legal transition, the v2 re-confirmation gate, fund/school
 * validation) applies here too — a row that fails a gate is reported and
 * skipped, never forced. Mirrors `bulkCloseApplicationsAction`'s
 * skip-and-report shape.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withAdminContext } from "@/lib/db/prisma";
import { setPostAssessmentFinalState } from "@/lib/applications/post-assessment-core";
import type { AwardFundType } from "@prisma/client";

const BULK_LOCK_MAX = 500;

export interface BulkLockResult {
  locked: number;
  skipped: Array<{ reference: string; error: string }>;
}

export async function bulkLockRolledOverAction(): Promise<
  { success: true; result: BulkLockResult } | { success: false; error: string }
> {
  try {
    // ADMIN-only: this is her end-of-cycle ritual, not an assessor action.
    await requireRole([Role.ADMIN]);

    // Plan pass: every rolling-over assessment stored as complete, with the
    // fund its account's most recent previous award used (her carry-forward).
    const plan = await withAdminContext(async (tx) => {
      const targets = await tx.assessment.findMany({
        where: {
          status: "COMPLETED",
          application: { applicationType: "ROLLING_OVER", formStatus: "SUBMITTED" },
        },
        select: {
          applicationId: true,
          application: {
            select: { reference: true, roundId: true, bursaryAccountId: true },
          },
        },
        orderBy: { completedAt: "asc" },
        take: BULK_LOCK_MAX,
      });

      const rows: Array<{
        applicationId: string;
        reference: string;
        fund: AwardFundType;
      }> = [];
      for (const t of targets) {
        let fund: AwardFundType = "JWF";
        if (t.application.bursaryAccountId) {
          const previous = await tx.assessment.findFirst({
            where: {
              awardFundType: { not: null },
              application: {
                bursaryAccountId: t.application.bursaryAccountId,
                roundId: { not: t.application.roundId },
              },
            },
            orderBy: { completedAt: "desc" },
            select: { awardFundType: true },
          });
          if (previous?.awardFundType) fund = previous.awardFundType;
        }
        rows.push({
          applicationId: t.applicationId,
          reference: t.application.reference,
          fund,
        });
      }
      return rows;
    });

    if (plan.length === 0) {
      return {
        success: false,
        error: "No rolling-over assessments are stored as complete.",
      };
    }

    // Lock pass: one core call (its own transaction and audit row) per
    // assessment, so a failure skips that row without poisoning the batch.
    const result: BulkLockResult = { locked: 0, skipped: [] };
    for (const row of plan) {
      const outcome = await setPostAssessmentFinalState(row.applicationId, "ROLLED_OVER", {
        awardFundType: row.fund,
      });
      if (outcome.success) {
        result.locked += 1;
      } else {
        result.skipped.push({ reference: row.reference, error: outcome.error });
      }
    }

    revalidatePath("/assessments");
    return { success: true, result };
  } catch (err) {
    console.error("[bulkLockRolledOverAction]", err);
    return { success: false, error: "Failed to bulk-lock rolled-over assessments." };
  }
}
