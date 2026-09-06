/**
 * Epic 18 (WP-B3..B5) — the post-assessment lifecycle core.
 *
 * Charlotte's model, approved 25 Aug 2026 and drawn in
 * `docs/diagrams/epic-18-post-assessment-lifecycle.md`: a COMPLETED
 * assessment ("stored as complete") moves to exactly one of the final states —
 *
 *   NEW_AWARD        locked, finalised; creates/promotes the bursary account
 *                    and activates the admin page. Reversible (Q16).
 *   WAITING_LIST     held while the admission team works through place offers.
 *   CLOSED_ARCHIVED  closed with the record retained. Reopenable (Q15).
 *
 * CLOSED_PURGED (WP-B6) is deliberately absent until Q10b is agreed in
 * writing. This module replaces `set-outcome-core.ts` for the v2 surface —
 * differences that are the point, not accidents:
 *
 *   - **No email, on any transition.** Q11 (5 Sep 2026): "emails are sent out
 *     by me once all this has happened, separately" — she writes to families
 *     herself after governor approval. The OUTCOME_* templates are dead on
 *     this path.
 *   - **No `assessments.outcome` write.** The 3-value outcome column stays as
 *     history on legacy rows; the new lifecycle lives entirely on
 *     `assessments.status`.
 *   - **The reference prompt (Q14)** is advisory: the NEW_AWARD call may carry
 *     an amended application reference, editable by ASSESSOR and ADMIN alike
 *     ("editable option available for both"), but never blocks the lock.
 *   - **Every reversal goes back to COMPLETED** (stored as complete), and the
 *     bursary account created at lock survives a reversal — promotion is
 *     idempotent, so re-locking reuses it.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  setPostAssessmentState,
  isPostAssessmentFinalState,
  isLegalAssessmentTransition,
  type PostAssessmentFinalState,
} from "@/lib/applications/status";
import {
  needsRecommendationReconfirmation,
  RECOMMENDATION_NOT_RECONFIRMED_MESSAGE,
} from "@/lib/applications/recommendation-gate";
import { promoteToActiveAccount } from "@/lib/applications/account-promotion";
import { mirrorApplicationToSchedule } from "@/lib/bursary-accounts/lifecycle";
import { validateReferenceInput } from "@/lib/applications/reference";

export type PostAssessmentResult =
  | { success: true }
  | { success: false; error: string };

export interface NewAwardOptions {
  /**
   * Q14 — the reference prompt's amendment, applied to `Application.reference`
   * in the same transaction as the lock. Omitted/blank-after-trim = keep the
   * current reference (the prompt is advisory, never blocking).
   */
  amendedReference?: string;
}

async function fetchApplicationForLifecycle(
  tx: Parameters<typeof setPostAssessmentState>[0],
  applicationId: string
) {
  return tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      childName: true,
      childDob: true,
      entryYear: true,
      entryYearGroup: true,
      school: true,
      bursaryAccountId: true,
      applicationType: true,
      archivedAt: true,
      roundId: true,
      leadApplicantId: true,
      round: {
        select: { academicYear: true, openDate: true, closeDate: true },
      },
      assessment: {
        select: {
          id: true,
          status: true,
          outcome: true,
          calculationVersion: true,
          yearlyPayableFees: true,
          recommendedPayableFees: true,
          recommendation: { select: { confirmedPayableFees: true } },
        },
      },
    },
  });
}

/**
 * Move a stored-as-complete (or waiting-list) assessment into one of the
 * Epic 18 final states. ADMIN or ASSESSOR. See the module docstring for what
 * deliberately does NOT happen here (email, outcome write).
 */
export async function setPostAssessmentFinalState(
  applicationId: string,
  target: PostAssessmentFinalState,
  opts: NewAwardOptions = {}
): Promise<PostAssessmentResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const amended = opts.amendedReference?.trim();
    if (target === "NEW_AWARD" && amended) {
      const check = validateReferenceInput(amended);
      if (!check.valid) return { success: false, error: check.error };
    }

    const pre = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const application = await fetchApplicationForLifecycle(tx, applicationId);
      if (!application?.assessment) {
        return { success: false as const, error: "Application not found." };
      }
      const assessment = application.assessment;

      if (!isLegalAssessmentTransition(assessment.status, target)) {
        return {
          success: false as const,
          error: `Cannot move this assessment to ${target}: it is ${assessment.status}, not stored as complete.`,
        };
      }

      // Epic 13 / C1 — a v2 recommendation whose payable fees were never
      // (re-)confirmed cannot decide an award. Applies to the award lock only:
      // parking a case on the waiting list or archiving it decides nothing.
      if (target === "NEW_AWARD" && needsRecommendationReconfirmation(assessment)) {
        return { success: false as const, error: RECOMMENDATION_NOT_RECONFIRMED_MESSAGE };
      }

      if (target === "NEW_AWARD") {
        // Q12 — the account is created/promoted AT the lock, and that is what
        // activates the admin page. Idempotent: a rolling account is
        // continued, and one left behind by a reversal is reused.
        await promoteToActiveAccount(tx, application, {
          bursaryAward: null,
          scholarshipAward: null,
        });

        // Q14 — the advisory reference amendment, same transaction as the lock.
        if (amended && amended !== application.reference) {
          await tx.application.update({
            where: { id: applicationId },
            data: { reference: amended },
          });
          await createAuditLog(tx, {
            userId: user.id,
            action: AUDIT_ACTIONS.UPDATE_REFERENCE,
            entityType: AUDIT_ENTITY_TYPES.Application,
            entityId: applicationId,
            context: "Reference amended at the New Award prompt",
            metadata: { from: application.reference, to: amended },
          });
        }
      }

      await setPostAssessmentState(tx, assessment.id, assessment.status, target);

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_LIFECYCLE_SET,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessment.id,
        context: `Assessment moved to ${target}`,
        metadata: {
          applicationId,
          fromState: assessment.status,
          toState: target,
          reference: amended || application.reference,
          // Q11 — recorded so the trail says explicitly that silence is by design.
          emailSent: false,
        },
      });

      return { success: true as const };
    });

    if (!pre.success) return pre;

    // CH-49 fix — with the account now guaranteed to exist, mirror this
    // application's year onto the forward schedule (the completeAssessmentAction
    // hand-off early-returns on `!bursaryAccountId`, which is exactly the
    // first-time-applicant case this transition resolves). ADMIN-write table,
    // actor may be an ASSESSOR → withAdminContext; non-blocking, same as the
    // complete-action hand-off.
    if (target === "NEW_AWARD") {
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
        });
      } catch (err) {
        console.error("[setPostAssessmentFinalState] schedule mirror failed", err);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[setPostAssessmentFinalState]", err);
    return { success: false, error: "Failed to update the assessment's state." };
  }
}

/**
 * Reverse a final state back to stored-as-complete (COMPLETED). Q15/Q16
 * (5 Sep 2026): archived reopens, and a new award "has a way back too".
 * The bursary account is deliberately left untouched on a NEW_AWARD reversal —
 * promotion is idempotent, so re-locking continues the same account rather
 * than minting a second one.
 */
export async function revertPostAssessmentState(
  applicationId: string
): Promise<PostAssessmentResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    return await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          assessment: { select: { id: true, status: true } },
        },
      });
      if (!application?.assessment) {
        return { success: false as const, error: "Application not found." };
      }
      const assessment = application.assessment;

      if (!isPostAssessmentFinalState(assessment.status)) {
        return {
          success: false as const,
          error: "This assessment is not in a post-assessment state.",
        };
      }

      await setPostAssessmentState(tx, assessment.id, assessment.status, "COMPLETED");

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_LIFECYCLE_REVERTED,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessment.id,
        context: `Assessment reverted from ${assessment.status} to stored as complete`,
        metadata: {
          applicationId,
          fromState: assessment.status,
          toState: "COMPLETED",
          // A reversed NEW_AWARD keeps its bursary account (idempotent
          // promotion reuses it on a re-lock).
          accountRetained: assessment.status === "NEW_AWARD",
        },
      });

      return { success: true as const };
    });
  } catch (err) {
    console.error("[revertPostAssessmentState]", err);
    return { success: false, error: "Failed to revert the assessment's state." };
  }
}
