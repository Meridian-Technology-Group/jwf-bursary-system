"use server";

/**
 * WP-10: Assessment Server Actions
 *
 * Handles all mutations for the assessment form:
 * - Begin (create) a new assessment
 * - Save assessment data (partial update)
 * - Complete an assessment
 * - Pause an assessment
 *
 * All actions create audit log entries and revalidate the assessment path.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import {
  createAssessment,
  saveAssessment,
  completeAssessment,
  pauseAssessment,
} from "@/lib/db/queries/assessments";
import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";
import { createAuditLog } from "@/lib/audit/log";

// ─── Begin Assessment ─────────────────────────────────────────────────────────

export async function beginAssessmentAction(
  applicationId: string
): Promise<{ success: true; assessmentId: string } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const assessment = await createAssessment(applicationId, user.id);

    await createAuditLog({
      userId: user.id,
      action: "assessment.begin",
      entityType: "Assessment",
      entityId: assessment.id,
      context: `Created assessment for application ${applicationId}`,
      metadata: { applicationId, assessmentId: assessment.id },
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true, assessmentId: assessment.id };
  } catch (err) {
    console.error("[beginAssessmentAction]", err);
    return { success: false, error: "Failed to begin assessment." };
  }
}

// ─── Save Assessment ──────────────────────────────────────────────────────────

export async function saveAssessmentAction(
  assessmentId: string,
  applicationId: string,
  data: AssessmentSaveInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    await saveAssessment(assessmentId, {
      ...data,
      status: data.status ?? "NOT_STARTED",
    });

    await createAuditLog({
      userId: user.id,
      action: "assessment.save",
      entityType: "Assessment",
      entityId: assessmentId,
      context: "Assessment data saved",
      metadata: { assessmentId, applicationId, fieldsUpdated: Object.keys(data) },
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[saveAssessmentAction]", err);
    return { success: false, error: "Failed to save assessment." };
  }
}

// ─── Complete Assessment ───────────────────────────────────────────────────────

export async function completeAssessmentAction(
  assessmentId: string,
  applicationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    await completeAssessment(assessmentId);

    await createAuditLog({
      userId: user.id,
      action: "assessment.complete",
      entityType: "Assessment",
      entityId: assessmentId,
      context: "Assessment marked as COMPLETED",
      metadata: { assessmentId, applicationId },
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[completeAssessmentAction]", err);
    return { success: false, error: "Failed to complete assessment." };
  }
}

// ─── Pause Assessment ──────────────────────────────────────────────────────────

export async function pauseAssessmentAction(
  assessmentId: string,
  applicationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    await pauseAssessment(assessmentId);

    await createAuditLog({
      userId: user.id,
      action: "assessment.pause",
      entityType: "Assessment",
      entityId: assessmentId,
      context: "Assessment paused",
      metadata: { assessmentId, applicationId },
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[pauseAssessmentAction]", err);
    return { success: false, error: "Failed to pause assessment." };
  }
}
