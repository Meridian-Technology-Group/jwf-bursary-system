"use server";

/**
 * WP-15: Status Management Server Actions
 *
 * All application-level status transitions live here. Each action:
 *   1. Authenticates and authorises the caller (ASSESSOR role required for mutations)
 *   2. Validates the requested transition against the allowed lifecycle graph
 *   3. Persists the status change via Prisma
 *   4. Fires emails where appropriate
 *   5. Writes an immutable audit-log entry
 *   6. Revalidates the relevant Next.js cache paths
 *
 * Status lifecycle (PRE_SUBMISSION is managed by the applicant portal):
 *   SUBMITTED → NOT_STARTED (begin review)
 *   NOT_STARTED → PAUSED    (request missing documents)
 *   PAUSED → NOT_STARTED    (resume after documents received)
 *   NOT_STARTED → COMPLETED (assessment finished)
 *   COMPLETED → QUALIFIES   (set outcome)
 *   COMPLETED → DOES_NOT_QUALIFY (set outcome)
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { humaniseSlot } from "@/lib/documents/slots";
import { deleteDocument } from "@/lib/storage/documents";
import type { ApplicationStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── Valid transition map ─────────────────────────────────────────────────────

/**
 * Defines which target statuses are reachable from each source status.
 * PRE_SUBMISSION → SUBMITTED is handled by the applicant portal submission flow.
 */
const VALID_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ["NOT_STARTED"],
  NOT_STARTED: ["PAUSED", "COMPLETED"],
  PAUSED: ["NOT_STARTED"],
  COMPLETED: ["QUALIFIES", "DOES_NOT_QUALIFY"],
};

function isValidTransition(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Helper: fetch application with lead applicant email ──────────────────────

async function fetchApplicationForStatus(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      status: true,
      childName: true,
      leadApplicant: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });
}

// ─── Revalidation helper ─────────────────────────────────────────────────────

function revalidateApplicationPaths(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/applications/${applicationId}/history`);
  revalidatePath("/queue");
}

// ─── updateApplicationStatus ─────────────────────────────────────────────────

/**
 * General-purpose status transition. Validates the transition, persists it,
 * and writes an audit log. Callers that need email side-effects should use
 * the specialised actions (pauseApplication, resumeApplication, setOutcome).
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  context?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const application = await fetchApplicationForStatus(applicationId);
    if (!application) {
      return { success: false, error: "Application not found." };
    }

    const oldStatus = application.status;

    if (!isValidTransition(oldStatus, newStatus)) {
      return {
        success: false,
        error: `Cannot transition from ${oldStatus} to ${newStatus}.`,
      };
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { status: newStatus },
    });

    await createAuditLog({
      userId: user.id,
      action: "APPLICATION_STATUS_CHANGED",
      entityType: "Application",
      entityId: applicationId,
      context: context ?? `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: {
        fromStatus: oldStatus,
        toStatus: newStatus,
        reference: application.reference,
      },
    });

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[updateApplicationStatus]", err);
    return { success: false, error: "Failed to update application status." };
  }
}

// ─── pauseApplication ────────────────────────────────────────────────────────

/**
 * Transitions the application to PAUSED and sends a MISSING_DOCS email to
 * the lead applicant listing the document slots that are outstanding.
 *
 * @param applicationId       The application to pause.
 * @param missingDocumentSlots Array of slot names that are missing / unverified.
 * @param customMessage       Optional free-text appended to the email body.
 */
export async function pauseApplication(
  applicationId: string,
  missingDocumentSlots: string[],
  customMessage?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const application = await fetchApplicationForStatus(applicationId);
    if (!application) {
      return { success: false, error: "Application not found." };
    }

    if (!isValidTransition(application.status, "PAUSED")) {
      return {
        success: false,
        error: `Cannot pause application from status ${application.status}.`,
      };
    }

    // Persist the status change
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "PAUSED" },
    });

    // Build a human-readable list of missing slots
    const slotList = missingDocumentSlots
      .map((s) => `• ${humaniseSlot(s)}`)
      .join("\n");

    // Send MISSING_DOCS email — non-blocking; log failure but don't abort
    const emailResult = await sendEmail(
      application.leadApplicant.email,
      "MISSING_DOCS",
      {
        applicant_name:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        reference: application.reference,
        child_name: application.childName,
        missing_documents: slotList,
        custom_message: customMessage ?? "",
      }
    );

    if (!emailResult.success) {
      console.warn(
        `[pauseApplication] MISSING_DOCS email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    await createAuditLog({
      userId: user.id,
      action: "APPLICATION_PAUSED",
      entityType: "Application",
      entityId: applicationId,
      context: "Application paused — missing documents requested",
      metadata: {
        fromStatus: application.status,
        toStatus: "PAUSED",
        reference: application.reference,
        missingDocumentSlots,
        customMessage: customMessage ?? null,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId ?? null,
      },
    });

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[pauseApplication]", err);
    return { success: false, error: "Failed to pause application." };
  }
}

// ─── resumeApplication ───────────────────────────────────────────────────────

/**
 * Transitions the application from PAUSED back to NOT_STARTED, indicating that
 * outstanding documents have been received and review can resume.
 */
export async function resumeApplication(
  applicationId: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const application = await fetchApplicationForStatus(applicationId);
    if (!application) {
      return { success: false, error: "Application not found." };
    }

    if (!isValidTransition(application.status, "NOT_STARTED")) {
      return {
        success: false,
        error: `Cannot resume application from status ${application.status}.`,
      };
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "NOT_STARTED" },
    });

    await createAuditLog({
      userId: user.id,
      action: "APPLICATION_RESUMED",
      entityType: "Application",
      entityId: applicationId,
      context: "Application resumed from PAUSED to NOT_STARTED",
      metadata: {
        fromStatus: application.status,
        toStatus: "NOT_STARTED",
        reference: application.reference,
      },
    });

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[resumeApplication]", err);
    return { success: false, error: "Failed to resume application." };
  }
}

// ─── setOutcome ───────────────────────────────────────────────────────────────

/**
 * Sets the final outcome of a COMPLETED application to QUALIFIES or
 * DOES_NOT_QUALIFY, and sends the appropriate outcome email.
 */
export async function setOutcome(
  applicationId: string,
  outcome: "QUALIFIES" | "DOES_NOT_QUALIFY"
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const application = await fetchApplicationForStatus(applicationId);
    if (!application) {
      return { success: false, error: "Application not found." };
    }

    if (!isValidTransition(application.status, outcome)) {
      return {
        success: false,
        error: `Cannot set outcome ${outcome} from status ${application.status}.`,
      };
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { status: outcome },
    });

    // Send appropriate outcome email
    const templateType =
      outcome === "QUALIFIES" ? "OUTCOME_QUALIFIES" : "OUTCOME_DNQ";

    const emailResult = await sendEmail(
      application.leadApplicant.email,
      templateType,
      {
        applicant_name:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        reference: application.reference,
        child_name: application.childName,
        outcome: outcome === "QUALIFIES" ? "Qualifies" : "Does Not Qualify",
      }
    );

    if (!emailResult.success) {
      console.warn(
        `[setOutcome] ${templateType} email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    await createAuditLog({
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
    });

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[setOutcome]", err);
    return { success: false, error: "Failed to set application outcome." };
  }
}

// humaniseSlot is exported from @/lib/documents/slots — imported above.

// ─── gdprDeleteApplicantAction ───────────────────────────────────────────────

/**
 * Permanently deletes or anonymises all personal data for an applicant.
 *
 * Rules (per UX research / GDPR):
 *   DELETE:    ApplicationSection, Document (DB + Storage), AssessmentEarner,
 *              AssessmentProperty, AssessmentChecklist, Assessment,
 *              RecommendationReasonCode, Recommendation, Invitation records.
 *   ANONYMISE: Application.childName → '[Child Removed]', childDob → null
 *              Profile.firstName/lastName/phone → null,
 *              Profile.email → '[deleted-{uuid}]@removed.invalid',
 *              Profile.role → DELETED
 *              AuditLog.userId → null (where userId matches)
 *   RETAIN:    Round, aggregate statistics, ReasonCode reference data.
 *
 * Access: ASSESSOR role only.
 * Guard:  Cannot delete if application was submitted within the last 7 years.
 */
export async function gdprDeleteApplicantAction(
  applicationId: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    // 1. Fetch the application with all relevant relations
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        reference: true,
        status: true,
        submittedAt: true,
        leadApplicantId: true,
        documents: { select: { id: true, storagePath: true } },
        assessment: {
          select: {
            id: true,
            earners: { select: { id: true } },
            property: { select: { id: true } },
            checklists: { select: { id: true } },
            recommendation: {
              select: {
                id: true,
                reasonCodes: { select: { reasonCodeId: true } },
              },
            },
          },
        },
      },
    });

    if (!application) {
      return { success: false, error: "Application not found." };
    }

    // 2. 7-year retention check — block if submitted within the last 7 years
    if (application.submittedAt) {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
      if (application.submittedAt > sevenYearsAgo) {
        return {
          success: false,
          error:
            "This application cannot be deleted yet. Records must be retained for 7 years from the date of submission.",
        };
      }
    }

    const leadApplicantId = application.leadApplicantId;

    // 3. Delete Storage files first (non-fatal: continue on partial failure)
    const storageErrors: string[] = [];
    for (const doc of application.documents) {
      try {
        await deleteDocument(doc.storagePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        storageErrors.push(`${doc.id}: ${msg}`);
        console.warn("[gdprDelete] Storage delete failed for", doc.id, msg);
      }
    }

    // 4. Run the DB mutations in a single transaction
    await prisma.$transaction(async (tx) => {
      // a. Delete assessment children
      if (application.assessment) {
        const assessmentId = application.assessment.id;

        await tx.assessmentEarner.deleteMany({ where: { assessmentId } });
        await tx.assessmentChecklist.deleteMany({ where: { assessmentId } });
        if (application.assessment.property) {
          await tx.assessmentProperty.delete({
            where: { assessmentId },
          });
        }

        // b. Delete recommendation + junction rows
        if (application.assessment.recommendation) {
          const recommendationId = application.assessment.recommendation.id;
          await tx.recommendationReasonCode.deleteMany({
            where: { recommendationId },
          });
          await tx.recommendation.delete({ where: { id: recommendationId } });
        }

        // c. Delete assessment itself
        await tx.assessment.delete({ where: { id: assessmentId } });
      }

      // d. Delete ApplicationSection rows
      await tx.applicationSection.deleteMany({ where: { applicationId } });

      // e. Delete Document DB records
      await tx.document.deleteMany({ where: { applicationId } });

      // f. Anonymise Application
      await tx.application.update({
        where: { id: applicationId },
        data: {
          childName: "[Child Removed]",
          childDob: null,
        },
      });

      // g. Delete Invitation records linked to this lead applicant
      await tx.invitation.deleteMany({ where: { createdBy: leadApplicantId } });
      // Also invitations where the email matches (authUserId may be null)
      const profile = await tx.profile.findUnique({
        where: { id: leadApplicantId },
        select: { email: true },
      });
      if (profile) {
        await tx.invitation.deleteMany({ where: { email: profile.email } });
      }

      // h. Anonymise AuditLog rows (set userId → null)
      await tx.auditLog.updateMany({
        where: { userId: leadApplicantId },
        data: { userId: null },
      });

      // i. Anonymise Profile
      const anonymisedEmail = `[deleted-${leadApplicantId}]@removed.invalid`;
      await tx.profile.update({
        where: { id: leadApplicantId },
        data: {
          firstName: null,
          lastName: null,
          phone: null,
          email: anonymisedEmail,
          role: "DELETED",
        },
      });
    });

    // 5. Write the GDPR audit log entry (using a system/null user as the
    //    lead applicant's userId was just nulled — we record the assessor)
    await createAuditLog({
      userId: user.id,
      action: "GDPR_DELETION",
      entityType: "Application",
      entityId: applicationId,
      context: `GDPR deletion performed on application ${application.reference}`,
      metadata: {
        reference: application.reference,
        leadApplicantId,
        storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
      },
    });

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/queue");

    return { success: true };
  } catch (err) {
    console.error("[gdprDeleteApplicantAction]", err);
    return {
      success: false,
      error: "Failed to perform GDPR deletion. Please try again.",
    };
  }
}
