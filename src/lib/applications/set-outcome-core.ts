/**
 * Shared core for setting an application's final outcome.
 *
 * Backlog #11: two server actions (`setOutcome` in the application-detail
 * actions and `setApplicationOutcomeAction` in the recommendation actions)
 * previously implemented this transition independently and had diverged —
 * only the recommendation path created a BursaryAccount on a QUALIFIES
 * outcome (added in PR #43), and they wrote different audit-action keys.
 *
 * This module is the single source of truth for the outcome transition:
 *   1. transition validation (COMPLETED → QUALIFIES | DOES_NOT_QUALIFY)
 *   2. status persistence
 *   3. idempotent BursaryAccount creation on QUALIFIES (exactly one, never a
 *      duplicate — skipped when the application is already linked to one)
 *   4. the outcome email to the lead applicant
 *   5. exactly one canonical audit row (APPLICATION_OUTCOME_SET)
 *
 * Both server actions are thin wrappers that delegate here, so the two
 * admin UIs keep their existing call signatures unchanged.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole, type Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { generateBursaryAccountReference } from "@/lib/bursary-accounts/reference";
import { sendEmail } from "@/lib/email/send";
import { EmailTemplateType, type ApplicationStatus } from "@prisma/client";

export type SetOutcomeResult =
  | { success: true }
  | { success: false; error: string };

export type Outcome = "QUALIFIES" | "DOES_NOT_QUALIFY";

/**
 * Source statuses from which an outcome may be set. Mirrors the COMPLETED
 * row of the application lifecycle graph in
 * src/app/(admin)/applications/[id]/actions.ts.
 */
function isValidOutcomeTransition(from: ApplicationStatus): boolean {
  return from === "COMPLETED";
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
      leadApplicantId: true,
      leadApplicant: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      round: {
        select: { academicYear: true },
      },
      assessment: {
        select: { yearlyPayableFees: true },
      },
    },
  });
}

type OutcomeApplication = NonNullable<
  Awaited<ReturnType<typeof fetchApplicationForOutcome>>
>;

/**
 * Performs the qualifying-outcome side effect: create the BursaryAccount and
 * link it to the application. Idempotent — the caller must only invoke this
 * when `outcome === "QUALIFIES"` and the application is not already linked to
 * an account.
 */
async function createBursaryAccountForQualifies(
  tx: Tx,
  application: OutcomeApplication
): Promise<void> {
  const reference = await generateBursaryAccountReference(
    tx,
    application.round.academicYear
  );

  // BursaryAccount.entryYear is required; fall back to the round's starting
  // academic year (e.g. "2025/2026" -> 2025) when the application did not
  // capture an explicit entry year.
  const entryYear =
    application.entryYear ??
    parseInt(application.round.academicYear.slice(0, 4), 10);

  const account = await tx.bursaryAccount.create({
    data: {
      reference,
      school: application.school,
      childName: application.childName,
      childDob: application.childDob,
      entryYear,
      entryYearGroup: application.entryYearGroup,
      firstAssessmentYear: application.round.academicYear,
      benchmarkPayableFees: application.assessment?.yearlyPayableFees ?? null,
      leadApplicantId: application.leadApplicantId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await tx.application.update({
    where: { id: application.id },
    data: { bursaryAccountId: account.id },
  });
}

/**
 * Sets the final outcome of a COMPLETED application to QUALIFIES or
 * DOES_NOT_QUALIFY. Single source of truth for the transition — see module
 * docstring. Authenticates and authorises (ADMIN/ASSESSOR) internally.
 */
export async function setApplicationOutcome(
  applicationId: string,
  outcome: Outcome
): Promise<SetOutcomeResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // Phase 1: load, validate, persist status + idempotent BursaryAccount
    // creation (single RLS transaction).
    const pre = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForOutcome(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        if (!isValidOutcomeTransition(application.status)) {
          return {
            success: false as const,
            error: `Cannot set outcome ${outcome} from status ${application.status}.`,
          };
        }

        await tx.application.update({
          where: { id: applicationId },
          data: { status: outcome },
        });

        // Promote a qualifying application into an ongoing BursaryAccount.
        // Idempotent: only create when the outcome is QUALIFIES and the
        // application is not already linked to an account (re-assessments
        // already carry a bursary_account_id and are skipped here).
        if (outcome === "QUALIFIES" && !application.bursaryAccountId) {
          await createBursaryAccountForQualifies(tx, application);
        }

        return { success: true as const, application };
      }
    );

    if (!pre.success) return pre;
    const { application } = pre;

    // Phase 2: send the outcome email to the lead applicant.
    const templateType =
      outcome === "QUALIFIES"
        ? EmailTemplateType.OUTCOME_QUALIFIES
        : EmailTemplateType.OUTCOME_DNQ;

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

    // Phase 3: exactly one canonical audit row.
    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: "APPLICATION_OUTCOME_SET",
        entityType: "Application",
        entityId: applicationId,
        context: `Outcome set to ${outcome}`,
        metadata: {
          fromStatus: application.status,
          toStatus: outcome,
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
