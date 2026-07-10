"use server";

/**
 * WP-12: Recommendation Server Actions
 *
 * Handles all mutations for the recommendation form:
 * - Save recommendation data (upsert)
 * - Set application outcome (QUALIFIES / DOES_NOT_QUALIFY)
 *
 * All actions create audit log entries and revalidate the recommendation path.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { upsertRecommendation } from "@/lib/db/queries/recommendations";
import type { UpsertRecommendationInput } from "@/lib/db/queries/recommendations";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  setApplicationOutcome,
  type AwardDecision,
} from "@/lib/applications/set-outcome-core";
import type { AwardFigures } from "@/lib/applications/account-promotion";
import {
  computeGapAmount,
  gapReasonSelectionValid,
} from "@/lib/assessment/recommendation-v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveRecommendationData
  extends Omit<UpsertRecommendationInput, "roundId" | "bursaryAccountId"> {
  reasonCodeIds?: string[];
  /**
   * CALC-16 — the assessor-entered scholarship % (0–100). Lives on
   * `Assessment.scholarshipPct`, not the Recommendation row, so it is written
   * back to the assessment (same transaction) rather than passed through to
   * `upsertRecommendation`. Undefined/null ⇒ no write (v1 saves never send
   * this field and must not touch the assessment's scholarship %).
   */
  scholarshipPct?: number | null;
}

// ─── Save Recommendation ──────────────────────────────────────────────────────

/**
 * Upserts the recommendation for the application's assessment.
 * Resolves the assessmentId and roundId from the application record.
 */
export async function saveRecommendationAction(
  applicationId: string,
  data: SaveRecommendationData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        // Resolve the application and its assessment (incl. the v2 snapshot's
        // recommended payable fees — the authoritative gap baseline).
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            roundId: true,
            bursaryAccountId: true,
            assessment: {
              select: { id: true, recommendedPayableFees: true },
            },
          },
        });

        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        if (!application.assessment) {
          return {
            success: false as const,
            error: "No assessment found. Complete the assessment first.",
          };
        }

        const assessmentId = application.assessment.id;

        // CALC-08 — AUTHORITATIVE award/gap figures. The client's
        // `recommendedPayableFees`/`gapAmount` are never trusted: when a
        // confirmed figure is being saved (a v2 save), the recommended figure
        // is re-read from the assessment's persisted snapshot, the gap is
        // recomputed from it, and the gap-reason rule is validated against
        // THAT gap. A v1 save (no confirmed figure) persists neither.
        let saveData: SaveRecommendationData;
        if (data.confirmedPayableFees != null) {
          // CALC-15 — a null snapshot must NEVER be treated as an implicit £0
          // recommended figure: that silently computes a gap against a number
          // the engine never produced (exactly what happened when a stale
          // save left a COMPLETED v2 assessment with null snapshot columns).
          // Reject outright and tell the assessor to reopen and re-save.
          if (application.assessment.recommendedPayableFees == null) {
            return {
              success: false as const,
              error:
                "This assessment's calculation snapshot is incomplete (recommended payable fees is missing). Reopen the assessment and re-save it before recording a recommendation.",
            };
          }
          const snapshotRecommended = Number(
            application.assessment.recommendedPayableFees
          );
          const serverGap = computeGapAmount(
            data.confirmedPayableFees,
            snapshotRecommended
          );
          if (!gapReasonSelectionValid(serverGap, data.gapReasonIds ?? [])) {
            return {
              success: false as const,
              error:
                "Select at least one reason for the gap between the recommended and confirmed payable fees.",
            };
          }
          saveData = {
            ...data,
            recommendedPayableFees: snapshotRecommended,
            gapAmount: serverGap,
          };
        } else {
          // No confirmed figure ⇒ nothing to gap-track; drop any client-sent
          // v2 gap figures rather than persisting unverified values.
          saveData = {
            ...data,
            recommendedPayableFees: undefined,
            gapAmount: undefined,
          };
        }

        // CALC-16 — persist the entered scholarship % onto the Assessment row
        // it actually lives on. Without this the v2 form's Scholarship (%)
        // input reads back as 0 on reload (only the derived £ value was ever
        // saved, on the Recommendation), and re-saving would zero it out.
        if (data.scholarshipPct != null) {
          await tx.assessment.update({
            where: { id: assessmentId },
            data: { scholarshipPct: data.scholarshipPct },
          });
        }

        await upsertRecommendation(tx, assessmentId, {
          ...saveData,
          roundId: application.roundId,
          bursaryAccountId: application.bursaryAccountId,
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.RECOMMENDATION_SAVE,
          entityType: AUDIT_ENTITY_TYPES.Recommendation,
          entityId: assessmentId,
          context: `Recommendation saved for application ${applicationId}`,
          metadata: {
            applicationId,
            assessmentId,
            fieldsUpdated: Object.keys(data),
          },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

    revalidatePath(`/applications/${applicationId}/recommendation`);

    return { success: true };
  } catch (err) {
    console.error("[saveRecommendationAction]", err);
    return { success: false, error: "Failed to save recommendation." };
  }
}

// ─── Set Application Outcome ──────────────────────────────────────────────────

/**
 * Records the 3-value award decision (Epic 08): AWARDED, QUALIFIES_NOT_AWARDED,
 * or DOES_NOT_QUALIFY (Decline). Sends the matching outcome email and, on
 * AWARDED, promotes to the rolling ACTIVE bursary account (idempotent) and
 * records the scholarship award (£). Thin wrapper around the shared core in
 * `@/lib/applications/set-outcome-core`. Revalidates the recommendation +
 * application-detail paths.
 */
export async function setApplicationAwardAction(
  applicationId: string,
  outcome: AwardDecision,
  awards?: AwardFigures
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await setApplicationOutcome(applicationId, outcome, awards);
  if (result.success) {
    revalidatePath(`/applications/${applicationId}/recommendation`);
    revalidatePath(`/applications/${applicationId}`);
  }
  return result;
}
