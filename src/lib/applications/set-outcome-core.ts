/**
 * Shared core for setting an application's final outcome.
 *
 * Backlog #11 consolidated two diverged outcome paths into this single source of
 * truth. Epic 08 re-shapes it to the Foundation's real 3-value award decision:
 *
 *   - AWARDED               — the panel's "Approved Bursary". Promotes to the
 *                             rolling ACTIVE BursaryAccount via the Epic 10
 *                             interface (idempotent) and records the granted
 *                             bursary + scholarship (D9) awards on the
 *                             recommendation.
 *   - QUALIFIES_NOT_AWARDED — assessed as eligible but not granted this round.
 *   - DOES_NOT_QUALIFY      — the panel's "Declined Bursary"; a NEW application
 *                             is archived (Epic 01 sets archived_at).
 *
 * Responsibilities (single source of truth):
 *   1. transition validation (assessment COMPLETED → an outcome)
 *   2. outcome + lifecycle persistence via the central status service
 *      (writes assessments.outcome; PR-6a removed the legacy fused-status mirror)
 *   3. AWARDED → idempotent account promotion behind the Epic 10 interface
 *      (continue an existing rolling account, never double-create)
 *   4. persist the scholarship award (£) onto the recommendation (D9)
 *   5. the outcome email to the lead applicant (one template per outcome)
 *   6. exactly one canonical audit row (APPLICATION_OUTCOME_SET) carrying the
 *      chosen outcome + both award figures
 *
 * `setApplicationOutcome` is the module's only entry point. The recommendation
 * server action calls it with an explicit 3-value decision plus the award
 * figures. (Epic 13: C3 removed the legacy binary `setOutcome` action, F4 the
 * `setApplicationOutcomeLegacy` shim it wrapped.)
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole, type Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import {
  setApplicationOutcomeStatus,
  type LifecycleOutcome,
} from "@/lib/applications/status";
import {
  promoteToActiveAccount,
  type AwardFigures,
} from "@/lib/applications/account-promotion";
import { selectEngineVersion } from "@/lib/assessment/engine-version";
import { EmailTemplateType } from "@prisma/client";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

export type SetOutcomeResult =
  | { success: true }
  | { success: false; error: string };

/** The 3-value award decision (Epic 08). */
export type AwardDecision = LifecycleOutcome; // AWARDED | QUALIFIES_NOT_AWARDED | DOES_NOT_QUALIFY

/**
 * Outcome may only be set from a COMPLETED assessment. (Epic 01 PR-6a: the gate
 * reads the assessment's COMPLETED status — the single authoritative signal —
 * not the deprecated fused `applications.status`.)
 */
function isValidOutcomeSource(assessmentStatus: string | null): boolean {
  return assessmentStatus === "COMPLETED";
}

/** User-facing refusal when a recommendation's payable fees are unconfirmed. */
export const RECOMMENDATION_NOT_RECONFIRMED_MESSAGE =
  "The payable fees on this recommendation have not been confirmed — " +
  "reopening an assessment clears the previous confirmation. Confirm them on " +
  "the recommendation screen before setting an outcome.";

/**
 * Re-confirmation gate (Epic 13 / C1, D13-2).
 *
 * Reopening a COMPLETED assessment clears the recommendation's
 * `confirmedPayableFees` — the assessor's sign-off on a figure derived from an
 * assessment that has since been reopened and possibly corrected. Deciding on
 * it afterwards would promote a bursary account off a number nobody has looked
 * at since the correction (`promoteToActiveAccount` walks confirmed →
 * recommended → legacy for the benchmark). So: a v2 recommendation that exists
 * but carries no confirmed figure is stale, and cannot decide anything.
 *
 * Scoped so no pre-existing flow changes:
 *   - v1 assessments never populate `confirmedPayableFees` (a CALC-08/v2
 *     field), so they are exempt outright.
 *   - An assessment with NO recommendation row is exempt — nothing was ever
 *     recorded, so there is nothing stale, and the pre-recommendation outcome
 *     paths keep working unchanged.
 *
 * Reopen is the main way to reach the blocked state, but deliberately not the
 * only one: a v2 recommendation whose payable fees were NEVER confirmed is the
 * same defect wearing different clothes, and it should not decide an award
 * either. Both clear the same way — confirm the figure and save.
 */
function needsRecommendationReconfirmation(assessment: {
  calculationVersion: number | null;
  recommendation: { confirmedPayableFees: unknown } | null;
} | null): boolean {
  if (!assessment) return false;
  if (selectEngineVersion(assessment.calculationVersion) !== "v2") return false;
  if (!assessment.recommendation) return false;
  return assessment.recommendation.confirmedPayableFees == null;
}

async function fetchApplicationForOutcome(tx: Tx, applicationId: string) {
  return tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      formStatus: true,
      childName: true,
      childDob: true,
      entryYear: true,
      entryYearGroup: true,
      school: true,
      bursaryAccountId: true,
      applicationType: true,
      archivedAt: true,
      leadApplicantId: true,
      leadApplicant: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      round: {
        select: { academicYear: true, openDate: true, closeDate: true },
      },
      assessment: {
        select: {
          id: true,
          status: true,
          outcome: true,
          // Epic 13 / C1: engine version scopes the re-confirmation gate to v2.
          calculationVersion: true,
          // CALC-08: the account benchmark walks recommendation confirmed →
          // v2 recommended snapshot → legacy yearly (see account-promotion.ts).
          yearlyPayableFees: true,
          recommendedPayableFees: true,
          recommendation: { select: { confirmedPayableFees: true } },
        },
      },
    },
  });
}

/** The email template that backs each outcome. */
function templateForOutcome(outcome: AwardDecision): EmailTemplateType {
  switch (outcome) {
    case "AWARDED":
      return EmailTemplateType.OUTCOME_AWARDED;
    case "QUALIFIES_NOT_AWARDED":
      return EmailTemplateType.OUTCOME_QUALIFIES_NOT_AWARDED;
    case "DOES_NOT_QUALIFY":
      return EmailTemplateType.OUTCOME_DNQ;
  }
}

/**
 * Persists the scholarship award (£) onto the application's recommendation when
 * the outcome is AWARDED and a figure was supplied. The recommendation row is
 * created on first save from the recommendation form; this is a best-effort
 * top-up of the scholarship figure at decision time, so a NULL/absent figure
 * leaves any previously-saved value untouched.
 */
async function recordScholarshipAward(
  tx: Tx,
  assessmentId: string,
  scholarshipAward: number | null
): Promise<void> {
  if (scholarshipAward == null) return;
  await tx.recommendation.updateMany({
    where: { assessmentId },
    data: { scholarshipAward },
  });
}

/**
 * Sets the final outcome of a COMPLETED application's assessment to one of the
 * three award decisions. Single source of truth for the transition — see module
 * docstring. Authenticates and authorises (ADMIN/ASSESSOR) internally.
 *
 * @param awards optional bursary + scholarship figures recorded with the
 *   decision. For AWARDED, `scholarshipAward` is persisted onto the
 *   recommendation; both figures are written into the audit metadata regardless.
 */
export async function setApplicationOutcome(
  applicationId: string,
  outcome: AwardDecision,
  awards: AwardFigures = { bursaryAward: null, scholarshipAward: null }
): Promise<SetOutcomeResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // Phase 1: load, validate, promote (AWARDED), persist outcome + lifecycle
    // and the scholarship award (single RLS transaction).
    const pre = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForOutcome(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        if (!isValidOutcomeSource(application.assessment?.status ?? null)) {
          return {
            success: false as const,
            error: `Cannot set outcome ${outcome}: the assessment is not completed.`,
          };
        }

        // Epic 13 / C1 — a reopened assessment's recommendation must be
        // re-confirmed before it can decide anything.
        if (needsRecommendationReconfirmation(application.assessment)) {
          return {
            success: false as const,
            error: RECOMMENDATION_NOT_RECONFIRMED_MESSAGE,
          };
        }

        // AWARDED is the single entry point into the rolling-account lifecycle.
        // Promote FIRST so account presence is settled before the outcome write.
        // Idempotent: a re-assessment already carrying an account is continued,
        // never double-created (see promoteToActiveAccount).
        if (outcome === "AWARDED") {
          await promoteToActiveAccount(tx, application, awards);
        }

        // Central status service writes the 3-value assessments.outcome and
        // archives a NEW application that does not qualify (§3). (PR-6a: no
        // longer mirrors the deprecated fused applications.status.)
        await setApplicationOutcomeStatus(tx, applicationId, outcome, {
          applicationType: application.applicationType,
          alreadyArchived: application.archivedAt != null,
        });

        // Record the scholarship award (D9) onto the recommendation for AWARDED.
        if (outcome === "AWARDED" && application.assessment) {
          await recordScholarshipAward(
            tx,
            application.assessment.id,
            awards.scholarshipAward
          );
        }

        return { success: true as const, application };
      }
    );

    if (!pre.success) return pre;
    const { application } = pre;

    // Phase 2: send the outcome email to the lead applicant.
    const templateType = templateForOutcome(outcome);
    const schoolLabel =
      application.school === "TRINITY" ? "Trinity School" : "Whitgift School";
    const emailResult = await sendEmail(
      application.leadApplicant.email,
      templateType,
      {
        applicant_name:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        child_name: application.childName,
        school: schoolLabel,
        reference: application.reference,
        academic_year: application.round.academicYear,
      }
    );

    if (!emailResult.success) {
      console.warn(
        `[setApplicationOutcome] ${templateType} email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    // Phase 3: exactly one canonical audit row, carrying both award figures.
    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.APPLICATION_OUTCOME_SET,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: `Outcome set to ${outcome}`,
        metadata: {
          // Outcome can only be set from a COMPLETED assessment (gated above),
          // so the pre-decision review phase is always COMPLETED. (PR-6a: no
          // longer read from the deprecated fused `applications.status`.)
          fromStatus: "COMPLETED",
          outcome,
          bursaryAward: awards.bursaryAward,
          scholarshipAward: awards.scholarshipAward,
          reference: application.reference,
          emailSent: emailResult.success,
          emailMessageId: emailResult.messageId ?? null,
        },
      })
    );

    return { success: true };
  } catch (err) {
    console.error("[setApplicationOutcome]", err);
    return { success: false, error: "Failed to set application outcome." };
  }
}
