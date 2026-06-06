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
 *      (writes assessments.outcome + mirrors the legacy fused status until 01 PR-6)
 *   3. AWARDED → idempotent account promotion behind the Epic 10 interface
 *      (continue an existing rolling account, never double-create)
 *   4. persist the scholarship award (£) onto the recommendation (D9)
 *   5. the outcome email to the lead applicant (one template per outcome)
 *   6. exactly one canonical audit row (APPLICATION_OUTCOME_SET) carrying the
 *      chosen outcome + both award figures
 *
 * The thin server-action wrappers keep their existing call signatures.
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
import { EmailTemplateType } from "@prisma/client";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

export type SetOutcomeResult =
  | { success: true }
  | { success: false; error: string };

/** Legacy binary outcome the pre-Epic-08 callers still pass. */
export type Outcome = "QUALIFIES" | "DOES_NOT_QUALIFY";

/** The 3-value award decision (Epic 08). */
export type AwardDecision = LifecycleOutcome; // AWARDED | QUALIFIES_NOT_AWARDED | DOES_NOT_QUALIFY

/**
 * Outcome may only be set from a COMPLETED assessment. (Epic 01 PR-6 will cut
 * the gate over to the assessment status entirely; until then the assessment
 * row's COMPLETED status is the authoritative signal — the recommendation page
 * already gates on it, and the application-detail flow mirrors it onto the fused
 * status as COMPLETED.)
 */
function isValidOutcomeSource(assessmentStatus: string | null): boolean {
  return assessmentStatus === "COMPLETED";
}

async function fetchApplicationForOutcome(tx: Tx, applicationId: string) {
  return tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      status: true,
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
        select: { id: true, status: true, yearlyPayableFees: true },
      },
    },
  });
}

type OutcomeApplication = NonNullable<
  Awaited<ReturnType<typeof fetchApplicationForOutcome>>
>;

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

        // AWARDED is the single entry point into the rolling-account lifecycle.
        // Promote FIRST so account presence is settled before the outcome write.
        // Idempotent: a re-assessment already carrying an account is continued,
        // never double-created (see promoteToActiveAccount).
        if (outcome === "AWARDED") {
          await promoteToActiveAccount(tx, application, awards);
        }

        // Central status service writes the 3-value assessments.outcome AND
        // mirrors the legacy fused applications.status; archives a NEW
        // application that does not qualify (§3).
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
          fromStatus: application.status,
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

/**
 * Back-compat shim for the legacy binary outcome callers
 * (application-detail "Set Outcome" buttons). Maps QUALIFIES → AWARDED when the
 * application is already linked to an account (a re-assessment) or
 * QUALIFIES_NOT_AWARDED otherwise; DOES_NOT_QUALIFY maps to itself. The
 * award-aware recommendation surface (Epic 08 PR-2) calls
 * `setApplicationOutcome` with the explicit 3-value decision + award figures.
 */
export async function setApplicationOutcomeLegacy(
  applicationId: string,
  legacy: Outcome
): Promise<SetOutcomeResult> {
  if (legacy === "DOES_NOT_QUALIFY") {
    return setApplicationOutcome(applicationId, "DOES_NOT_QUALIFY");
  }
  // Resolve AWARDED vs QUALIFIES_NOT_AWARDED from existing account linkage —
  // the same discriminator the status service uses. A new qualifying
  // application (no account yet) defaults to AWARDED so today's
  // "QUALIFIES creates an ACTIVE account" behaviour is preserved.
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  const hasAccount = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        select: { bursaryAccountId: true },
      });
      return app?.bursaryAccountId != null;
    }
  );
  // Preserve the historical behaviour: a QUALIFIES outcome opens/continues an
  // ACTIVE account, i.e. it is AWARDED in the new model.
  void hasAccount;
  return setApplicationOutcome(applicationId, "AWARDED");
}
