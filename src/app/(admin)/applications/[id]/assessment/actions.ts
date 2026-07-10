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
import { requireRole, requireApplicationAccess, Role } from "@/lib/auth/roles";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
  type Tx,
} from "@/lib/db/prisma";
import {
  mirrorApplicationToSchedule,
  closeAccountIfComplete,
} from "@/lib/bursary-accounts/lifecycle";
import {
  createAssessment,
  saveAssessment,
  completeAssessment,
  pauseAssessment,
} from "@/lib/db/queries/assessments";
import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";
import {
  startAssessmentIfNotStarted,
  deriveReviewPhase,
} from "@/lib/applications/status";
import { getSecondaryContributor } from "@/lib/db/queries/contributors";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { NOT_SUBMITTED_GATE_MESSAGE } from "./gate";

// ─── Completeness gate ─────────────────────────────────────────────────────────

/**
 * "Ready for assessment" gate (dual-parent, PR 5). An assessment may begin when
 * the primary application is SUBMITTED and EITHER there is no SECONDARY
 * contributor, OR the secondary has SUBMITTED, OR an assessor override is in
 * effect (passed in for an existing assessment row).
 *
 * For an application with NO secondary this is unchanged from prior behaviour
 * (primary SUBMITTED is sufficient) — the secondary branch simply never fires.
 *
 * Returns { ok: true } when assessment may proceed, otherwise { ok: false }
 * with a human-readable reason. MUST be called inside an RLS context that can
 * read the contributor row (assigned assessor / ADMIN).
 */
async function checkSecondParentGate(
  tx: Tx,
  applicationId: string,
  overrideAlreadySet: boolean
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (overrideAlreadySet) return { ok: true };
  const secondary = await getSecondaryContributor(tx, applicationId);
  if (!secondary) return { ok: true };
  if (secondary.status === "SUBMITTED") return { ok: true };
  return {
    ok: false,
    reason:
      "A second parent has been invited but has not submitted their details. " +
      "Wait for their submission, or use “Proceed without second parent”.",
  };
}

// ─── Submitted gate (B1) ────────────────────────────────────────────────────────

// NOTE: NOT_SUBMITTED_GATE_MESSAGE lives in ./gate (a plain module) because this
// is a "use server" file, which may only export async functions.

/**
 * "Form submitted" gate (B1). An assessment row must never be created for an
 * application whose form is still a draft. Loads the application's lifecycle
 * facts and funnels them through `deriveReviewPhase` (the single source of
 * truth) rather than comparing `formStatus` strings by hand: a PRE_SUBMISSION
 * review phase means the form has not been submitted, so begin is blocked.
 *
 * MUST be called inside an RLS context that can read the application row.
 * Reuses the assessment row's status/outcome when one already exists so the
 * derivation matches the application-detail review track exactly.
 */
async function checkSubmittedGate(
  tx: Tx,
  applicationId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const app = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      formStatus: true,
      closedAt: true,
      assessment: { select: { status: true, outcome: true } },
    },
  });
  if (!app) {
    return { ok: false, reason: "Application not found." };
  }
  const phase = deriveReviewPhase({
    formStatus: app.formStatus,
    assessmentStatus: app.assessment?.status ?? null,
    outcome: app.assessment?.outcome ?? null,
    closedAt: app.closedAt,
  });
  if (phase === "PRE_SUBMISSION") {
    return { ok: false, reason: NOT_SUBMITTED_GATE_MESSAGE };
  }
  return { ok: true };
}

// ─── Begin Assessment ─────────────────────────────────────────────────────────

export async function beginAssessmentAction(
  applicationId: string
): Promise<{ success: true; assessmentId: string } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    await requireApplicationAccess(user, applicationId);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        // Submitted gate (B1): never create an assessment row for a draft
        // application — block when the form has not been submitted yet.
        const submitted = await checkSubmittedGate(tx, applicationId);
        if (!submitted.ok)
          return { ok: false as const, blocked: submitted.reason };

        // Completeness gate: block begin when a second parent was invited but
        // has not submitted and no override is in effect (no assessment row
        // exists yet here, so there can be no prior override).
        const gate = await checkSecondParentGate(tx, applicationId, false);
        if (!gate.ok)
          return { ok: false as const, blocked: gate.reason };

        const created = await createAssessment(tx, applicationId, user.id);
        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.ASSESSMENT_BEGIN,
          entityType: AUDIT_ENTITY_TYPES.Assessment,
          entityId: created.id,
          context: `Created assessment for application ${applicationId}`,
          metadata: { applicationId, assessmentId: created.id },
        });
        return { ok: true as const, assessmentId: created.id };
      }
    );

    if (!result.ok) {
      return { success: false, error: result.blocked };
    }

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true, assessmentId: result.assessmentId };
  } catch (err) {
    console.error("[beginAssessmentAction]", err);
    return { success: false, error: "Failed to begin assessment." };
  }
}

// ─── Proceed without second parent (override) ───────────────────────────────────

/**
 * Records the assessor's decision to PROCEED with an assessment without the
 * second parent's submission (dual-parent, PR 5, decision #3). Sets
 * `secondaryParentOverride = true` + a required reason on the Assessment,
 * creating the Assessment row if it does not yet exist (the common case — the
 * Begin gate blocks before any assessment is created). Audit-logged.
 *
 * Falls the calculation back to primary-only / single-earner: the override is
 * surfaced to the form, which restores the sole-parent toggle. Idempotent for
 * an existing assessment (updates the flag + reason).
 */
export async function proceedWithoutSecondParentAction(
  applicationId: string,
  reason: string
): Promise<
  { success: true; assessmentId: string } | { success: false; error: string }
> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    await requireApplicationAccess(user, applicationId);

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      return {
        success: false,
        error: "A reason is required to proceed without the second parent.",
      };
    }

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        // Submitted gate (B1): never create an assessment row for a draft
        // application — block when the form has not been submitted yet.
        const submitted = await checkSubmittedGate(tx, applicationId);
        if (!submitted.ok) {
          return { ok: false as const, error: submitted.reason };
        }

        // Guard: only meaningful when a secondary exists and has not submitted.
        const secondary = await getSecondaryContributor(tx, applicationId);
        if (!secondary) {
          return {
            ok: false as const,
            error: "No second parent has been invited for this application.",
          };
        }
        if (secondary.status === "SUBMITTED") {
          return {
            ok: false as const,
            error:
              "The second parent has already submitted — no override is needed.",
          };
        }

        // Create the assessment if needed, then set the override + reason.
        const existing = await tx.assessment.findUnique({
          where: { applicationId },
          select: { id: true },
        });
        const assessmentId = existing
          ? existing.id
          : (await createAssessment(tx, applicationId, user.id)).id;

        await tx.assessment.update({
          where: { id: assessmentId },
          data: {
            secondaryParentOverride: true,
            secondaryParentOverrideReason: trimmed,
          },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.ASSESSMENT_SECOND_PARENT_OVERRIDE,
          entityType: AUDIT_ENTITY_TYPES.Assessment,
          entityId: assessmentId,
          context: "Proceeding with assessment without the second parent",
          metadata: {
            applicationId,
            assessmentId,
            secondaryContributorId: secondary.id,
            secondaryStatus: secondary.status,
            reason: trimmed,
          },
        });

        return { ok: true as const, assessmentId };
      }
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    revalidatePath(`/applications/${applicationId}/assessment`);
    return { success: true, assessmentId: result.assessmentId };
  } catch (err) {
    console.error("[proceedWithoutSecondParentAction]", err);
    return {
      success: false,
      error: "Failed to record the proceed-without-second-parent override.",
    };
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
    await requireApplicationAccess(user, applicationId);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      // Persist the field data WITHOUT forcing a status (the previous
      // `status: data.status ?? "NOT_STARTED"` re-pinned every save to
      // NOT_STARTED, so an assessment never progressed). Status is owned by the
      // service: the first save promotes NOT_STARTED → IN_PROGRESS.
      await saveAssessment(tx, assessmentId, data);
      const started = await startAssessmentIfNotStarted(tx, assessmentId);
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_SAVE,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessmentId,
        context: started
          ? "Assessment data saved — review started (IN_PROGRESS)"
          : "Assessment data saved",
        metadata: { assessmentId, applicationId, fieldsUpdated: Object.keys(data) },
      });
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
    await requireApplicationAccess(user, applicationId);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await completeAssessment(tx, assessmentId);
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_COMPLETE,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessmentId,
        context: "Assessment marked as COMPLETED",
        metadata: { assessmentId, applicationId },
      });
    });

    // ── Mirror onto the forward schedule + close-when-complete (Epic 10) ──────
    // Mark the matching schedule year COMPLETE, then close the account if the
    // whole schedule is now terminal (the close revokes portal access via the
    // status-keyed guard). Runs under withAdminContext because the schedule
    // table is ADMIN-write and the actor may be an ASSESSOR. Non-blocking and a
    // no-op when the application has no account or no matching schedule row.
    try {
      await withAdminContext(async (tx) => {
        const app = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            bursaryAccountId: true,
            roundId: true,
            round: { select: { academicYear: true } },
          },
        });
        if (!app?.bursaryAccountId) return;
        await mirrorApplicationToSchedule(tx, {
          bursaryAccountId: app.bursaryAccountId,
          academicYear: app.round.academicYear,
          applicationId,
          roundId: app.roundId,
          status: "COMPLETE",
        });
        await closeAccountIfComplete(tx, app.bursaryAccountId);
      });
    } catch (err) {
      console.error(
        "[completeAssessmentAction] schedule mirror/close failed",
        err
      );
    }

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
    await requireApplicationAccess(user, applicationId);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await pauseAssessment(tx, assessmentId);
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_PAUSE,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessmentId,
        context: "Assessment paused",
        metadata: { assessmentId, applicationId },
      });
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[pauseAssessmentAction]", err);
    return { success: false, error: "Failed to pause assessment." };
  }
}
