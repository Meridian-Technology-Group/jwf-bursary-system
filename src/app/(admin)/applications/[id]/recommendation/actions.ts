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
import { prisma } from "@/lib/db/prisma";
import { upsertRecommendation } from "@/lib/db/queries/recommendations";
import type { UpsertRecommendationInput } from "@/lib/db/queries/recommendations";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { EmailTemplateType } from "@prisma/client";

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

    // Resolve the application and its assessment
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        roundId: true,
        bursaryAccountId: true,
        assessment: { select: { id: true } },
      },
    });

    if (!application) {
      return { success: false, error: "Application not found." };
    }

    if (!application.assessment) {
      return {
        success: false,
        error: "No assessment found. Complete the assessment first.",
      };
    }

    const assessmentId = application.assessment.id;

    await upsertRecommendation(assessmentId, {
      ...data,
      roundId: application.roundId,
      bursaryAccountId: application.bursaryAccountId,
    });

    await createAuditLog({
      userId: user.id,
      action: "recommendation.save",
      entityType: "Recommendation",
      entityId: assessmentId,
      context: `Recommendation saved for application ${applicationId}`,
      metadata: {
        applicationId,
        assessmentId,
        fieldsUpdated: Object.keys(data),
      },
    });

    revalidatePath(`/applications/${applicationId}/recommendation`);

    return { success: true };
  } catch (err) {
    console.error("[saveRecommendationAction]", err);
    return { success: false, error: "Failed to save recommendation." };
  }
}

// ─── Set Application Outcome ──────────────────────────────────────────────────

/**
 * Sets the application status to QUALIFIES or DOES_NOT_QUALIFY.
 * Sends the appropriate outcome email to the lead applicant.
 */
export async function setApplicationOutcomeAction(
  applicationId: string,
  outcome: "QUALIFIES" | "DOES_NOT_QUALIFY"
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // Load the application with lead applicant details
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        reference: true,
        status: true,
        leadApplicant: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        round: {
          select: { academicYear: true },
        },
      },
    });

    if (!application) {
      return { success: false, error: "Application not found." };
    }

    // Guard: do not re-set an already-terminal status
    if (
      application.status === "QUALIFIES" ||
      application.status === "DOES_NOT_QUALIFY"
    ) {
      return {
        success: false,
        error: "Application outcome has already been set.",
      };
    }

    // Update the application status
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: outcome },
    });

    // Send outcome email to the lead applicant
    const templateType =
      outcome === "QUALIFIES"
        ? EmailTemplateType.OUTCOME_QUALIFIES
        : EmailTemplateType.OUTCOME_DNQ;

    await sendEmail(application.leadApplicant.email, templateType, {
      first_name: application.leadApplicant.firstName ?? "",
      last_name: application.leadApplicant.lastName ?? "",
      reference: application.reference,
      academic_year: application.round.academicYear,
    });

    await createAuditLog({
      userId: user.id,
      action: "application.outcome.set",
      entityType: "Application",
      entityId: applicationId,
      context: `Application outcome set to ${outcome}`,
      metadata: {
        applicationId,
        outcome,
        previousStatus: application.status,
        emailSentTo: application.leadApplicant.email,
      },
    });

    revalidatePath(`/applications/${applicationId}/recommendation`);
    revalidatePath(`/applications/${applicationId}`);

    return { success: true };
  } catch (err) {
    console.error("[setApplicationOutcomeAction]", err);
    return { success: false, error: "Failed to set application outcome." };
  }
}
