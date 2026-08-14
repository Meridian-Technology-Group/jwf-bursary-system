"use server";

/**
 * WP-10: Assessment Server Actions
 *
 * Handles all mutations for the assessment form:
 * - Begin (create) a new assessment
 * - Save assessment data (partial update)
 * - Complete an assessment
 * - Pause an assessment
 * - Reopen a completed assessment (Epic 13 / C1 — the one way back out of
 *   COMPLETED, gated on no outcome having been set)
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
  reopenAccountForAssessmentYear,
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
  reopenAssessmentRow,
  deriveReviewPhase,
  AssessmentSnapshotMissingError,
} from "@/lib/applications/status";
import { getSecondaryContributor } from "@/lib/db/queries/contributors";
import { manualAdjustmentSchema } from "@/lib/schemas/assessment-v2";
import { MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE } from "@/lib/assessment/v2/manual-adjustment";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  NOT_SUBMITTED_GATE_MESSAGE,
  ASSESSMENT_COMPLETED_LOCK_MESSAGE,
  REOPEN_NOT_COMPLETED_MESSAGE,
  REOPEN_OUTCOME_SET_MESSAGE,
  REOPEN_APPLICATION_CLOSED_MESSAGE,
  REOPEN_NOT_ASSIGNED_MESSAGE,
} from "./gate";

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

// ─── Manual income adjustment (Epic 13 / C2, D13-3) ───────────────────────────

/**
 * Resolves the EFFECTIVE manual-adjustment amount/reason for a partial save
 * payload — submitted value where the field is present, stored value
 * otherwise — and runs it through `manualAdjustmentSchema` (the same Zod
 * schema the assessor form uses). Module-local, not exported: this file is
 * `"use server"`, so only async functions may be exported.
 */
function validateManualAdjustmentSave(
  data: AssessmentSaveInput,
  stored: { manualAdjustment: unknown; manualAdjustmentReason: string | null }
): { ok: true } | { ok: false; error: string } {
  const amount =
    data.manualAdjustment !== undefined
      ? data.manualAdjustment
      : stored.manualAdjustment != null
        ? Number(stored.manualAdjustment)
        : 0;
  const reason =
    data.manualAdjustmentReason !== undefined
      ? data.manualAdjustmentReason
      : stored.manualAdjustmentReason;

  const parsed = manualAdjustmentSchema.safeParse({
    manualAdjustment: amount,
    manualAdjustmentReason: reason,
  });
  if (parsed.success) return { ok: true };

  return {
    ok: false,
    error:
      parsed.error.issues[0]?.message ??
      MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
  };
}

// ─── Save Assessment ──────────────────────────────────────────────────────────

/**
 * Saves assessment field data.
 *
 * SERVER-SIDE COMPLETED LOCK (Epic 13 / C1). A completed assessment is
 * read-only, and until C1 that was enforced ONLY in the browser
 * (`assessment-form-v2.tsx`'s `isReadOnly`). Any caller that skipped the
 * component — a stale tab whose form mounted before the assessment was
 * completed, a replayed request, a direct server-action invocation — could
 * still overwrite a completed assessment's snapshot, silently changing the
 * numbers a recommendation had already been built on. The guard below makes the
 * lock real; the client-side read-only mode stays as the courtesy that keeps
 * assessors from typing into a form that will refuse them.
 *
 * The way back is REOPEN (`reopenAssessmentAction`), not a bypass.
 */
export async function saveAssessmentAction(
  assessmentId: string,
  applicationId: string,
  data: AssessmentSaveInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    await requireApplicationAccess(user, applicationId);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const current = await tx.assessment.findUnique({
          where: { id: assessmentId },
          select: {
            status: true,
            manualAdjustment: true,
            manualAdjustmentReason: true,
          },
        });
        if (!current) {
          return { ok: false as const, error: "Assessment not found." };
        }
        // The lock. Note this is status-only: an assessment carrying an outcome
        // is necessarily COMPLETED, so that case is covered too.
        if (current.status === "COMPLETED") {
          return {
            ok: false as const,
            error: ASSESSMENT_COMPLETED_LOCK_MESSAGE,
          };
        }

        // Epic 13 / C2 — the manual income-adjustment line's mandatory reason,
        // enforced SERVER-SIDE. The browser refuses first as a courtesy; this
        // is the rule. `data` is a partial save payload, so the effective
        // amount/reason is the submitted value where present and the stored
        // value otherwise — otherwise a payload that moves the amount without
        // touching the reason (or clears the reason without touching the
        // amount) could sneak an unexplained income change past the check.
        const manualCheck = validateManualAdjustmentSave(data, current);
        if (!manualCheck.ok) {
          return { ok: false as const, error: manualCheck.error };
        }

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
          metadata: {
            assessmentId,
            applicationId,
            fieldsUpdated: Object.keys(data),
          },
        });
        return { ok: true as const };
      }
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }

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
    // CALC-15 — surface the specific "snapshot missing" reason (rather than
    // the generic message below) so the assessor knows to re-save, not just
    // retry blindly. Should be unreachable via the normal UI (the form now
    // save-gates Complete client-side) — this is the server-side backstop.
    if (err instanceof AssessmentSnapshotMissingError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Failed to complete assessment." };
  }
}

// ─── Reopen Assessment ─────────────────────────────────────────────────────────

/**
 * Reopens a COMPLETED assessment for correction: COMPLETED → IN_PROGRESS
 * (Epic 13 / C1, decision D13-2 — CF-10/CF-01).
 *
 * WHY THIS EXISTS. "Mark complete" used to be a one-way door: the assessment
 * form locks, and an assessor who completes a still-wrong assessment has no way
 * back. UAT hit exactly that. D13-2 opens the door — but only until a decision
 * has been made.
 *
 * THE GATE. Reopening is allowed only while NO outcome is set (and the
 * application is not closed). Once an outcome exists, the applicant has been
 * emailed, a bursary account may have been promoted, and the assessment is the
 * evidence behind a communicated decision — changing it then is an
 * outcome-reversal problem, not an editing problem, and this action refuses.
 * (`canSetOutcome` guards the other direction: a reopened assessment is
 * IN_PROGRESS, so no outcome can be set until it is completed again.)
 *
 * WHAT IT DOES, all in one user-context transaction:
 *   1. Authorises: ADMIN, or the assessor ASSIGNED to the application. Assigned
 *      is defined exactly as `requireApplicationAccess` defines it
 *      (`application.assignedToId`) so there is one definition of "this
 *      assessor's application", not two that can drift.
 *   2. Reverts the status via the central status service (data is preserved —
 *      reopen is not discard) and clears `completedAt`.
 *   3. Marks the existing recommendation STALE by clearing its confirmed
 *      payable fees + gap. There is no `stale` column and C1 ships no
 *      migration, so the absence of a confirmed figure IS the stale signal —
 *      and it is the right one: `confirmedPayableFees` is the assessor's
 *      sign-off on a number derived from the assessment that has just been
 *      reopened. `setApplicationOutcome` refuses to decide on a v2
 *      recommendation lacking it, so the figure must be re-confirmed against
 *      the corrected assessment before any outcome can be set.
 *
 * Then, outside that transaction (ADMIN-write tables, mirroring
 * `completeAssessmentAction`'s own schedule hand-off): reverts the
 * close-on-complete effects — the year's schedule entry goes back to RECEIVED
 * and an account auto-closed by that completion is returned to ACTIVE. That
 * un-close is a DELIBERATE, documented exception to the set-once `closedAt`
 * rule; see `reopenAccountForAssessmentYear` and the schema note on
 * `BursaryAccount.closedAt` for why it is safe here and nowhere else.
 * Non-blocking, exactly like the completion path it mirrors.
 */
export async function reopenAssessmentAction(
  assessmentId: string,
  applicationId: string,
  reason?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    // Redirects a non-assigned assessor before we get here; the explicit
    // ownership check below is defence in depth for any caller that reaches the
    // action directly, and gives a clean refusal instead of a redirect.
    await requireApplicationAccess(user, applicationId);

    const trimmedReason = reason?.trim() || null;

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const assessment = await tx.assessment.findUnique({
          where: { id: assessmentId },
          select: {
            id: true,
            applicationId: true,
            status: true,
            outcome: true,
            application: {
              select: {
                assignedToId: true,
                closedAt: true,
                bursaryAccountId: true,
                round: { select: { academicYear: true } },
              },
            },
          },
        });

        if (!assessment || assessment.applicationId !== applicationId) {
          return { ok: false as const, error: "Assessment not found." };
        }

        // 1. Authorisation — ADMIN, or the assigned assessor.
        if (
          user.role !== Role.ADMIN &&
          assessment.application.assignedToId !== user.id
        ) {
          return { ok: false as const, error: REOPEN_NOT_ASSIGNED_MESSAGE };
        }

        // 2. The gate — never reopen past a decision.
        if (assessment.outcome != null) {
          return { ok: false as const, error: REOPEN_OUTCOME_SET_MESSAGE };
        }
        if (assessment.application.closedAt != null) {
          return {
            ok: false as const,
            error: REOPEN_APPLICATION_CLOSED_MESSAGE,
          };
        }
        if (assessment.status !== "COMPLETED") {
          return { ok: false as const, error: REOPEN_NOT_COMPLETED_MESSAGE };
        }

        // 3. COMPLETED → IN_PROGRESS via the central status service.
        await reopenAssessmentRow(tx, assessmentId, assessment.status);

        // 4. Stale-mark the recommendation: the confirmed figure signed off a
        //    calculation that is now open for correction, so it must be
        //    re-confirmed. `updateMany` (not `update`) so an assessment with no
        //    recommendation yet is a clean no-op.
        const cleared = await tx.recommendation.updateMany({
          where: { assessmentId },
          data: { confirmedPayableFees: null, gapAmount: null },
        });

        return {
          ok: true as const,
          recommendationCleared: cleared.count > 0,
          bursaryAccountId: assessment.application.bursaryAccountId,
          academicYear: assessment.application.round.academicYear,
        };
      }
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // ── Revert the close-on-complete effects (Epic 10 tables, ADMIN-write) ────
    // Mirrors completeAssessmentAction's schedule hand-off in reverse. Runs
    // under withAdminContext because the actor may be an ASSESSOR, and is
    // non-blocking: the reopen itself has already been persisted, and an
    // application with no account has nothing to revert.
    let accountReopened = false;
    let scheduleEntryReopened = false;
    if (result.bursaryAccountId) {
      try {
        const reverted = await withAdminContext((tx) =>
          reopenAccountForAssessmentYear(tx, {
            bursaryAccountId: result.bursaryAccountId as string,
            academicYear: result.academicYear,
          })
        );
        accountReopened = reverted.accountReopened;
        scheduleEntryReopened = reverted.scheduleEntryReopened;
      } catch (err) {
        console.error(
          "[reopenAssessmentAction] schedule/account reopen failed",
          err
        );
      }
    }

    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_REOPENED,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessmentId,
        context: trimmedReason
          ? `Assessment reopened for correction: ${trimmedReason}`
          : "Assessment reopened for correction (COMPLETED → IN_PROGRESS)",
        metadata: {
          applicationId,
          assessmentId,
          reason: trimmedReason,
          recommendationCleared: result.recommendationCleared,
          accountReopened,
          scheduleEntryReopened,
        },
      })
    );

    revalidatePath(`/applications/${applicationId}/assessment`);
    revalidatePath(`/applications/${applicationId}`);

    return { success: true };
  } catch (err) {
    console.error("[reopenAssessmentAction]", err);
    return { success: false, error: "Failed to reopen assessment." };
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
