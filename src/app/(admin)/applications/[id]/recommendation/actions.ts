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
import { gapReasonSelectionValid } from "@/lib/assessment/recommendation-v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveRecommendationData
  extends Omit<UpsertRecommendationInput, "roundId" | "bursaryAccountId"> {
  reasonCodeIds?: string[];
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

    // CALC-08 — authoritative gap-reason rule (mirrors the client's submit
    // gating): a material recommended→confirmed gap requires ≥1 gap reason.
    // For v1 saves `gapAmount` is undefined, so this always passes.
    if (!gapReasonSelectionValid(data.gapAmount, data.gapReasonIds ?? [])) {
      return {
        success: false,
        error:
          "Select at least one reason for the gap between the recommended and confirmed payable fees.",
      };
    }

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        // Resolve the application and its assessment
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            roundId: true,
            bursaryAccountId: true,
            assessment: { select: { id: true } },
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

        await upsertRecommendation(tx, assessmentId, {
          ...data,
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
