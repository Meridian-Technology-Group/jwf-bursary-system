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
import { withUserContext, withAdminContext, type RlsRole, type Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { humaniseSlot } from "@/lib/documents/slots";
import { deleteDocument } from "@/lib/storage/documents";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { restartApplicationFromRejection } from "@/lib/applications/create-from-invitation";
import { getAppUrl } from "@/lib/app-url";
import { isPurgeable, notYetPurgeableMessage } from "@/lib/retention/policy";
import {
  purgeApplication,
  buildPurgeAuditMetadata,
} from "@/lib/retention/purge";
import { deleteAuthUsersPostCommit } from "@/lib/retention/close-purge";
import { closeApplicationCore } from "@/lib/applications/close";
import { promoteToActiveAccount } from "@/lib/applications/account-promotion";
import {
  beginReview,
  resumeReview,
  markReviewComplete,
  pauseReviewForDocs,
  deriveReviewPhase,
  reopenAssessmentForMaterialChange,
} from "@/lib/applications/status";
import { validateReferenceInput } from "@/lib/applications/reference";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── Helper: fetch application with lead applicant email ──────────────────────
//
// PR-6a: the application-detail review track no longer reads the deprecated fused
// `applications.status`. The current review phase is DERIVED from the lifecycle
// columns (`form_status` + the assessment's `status`/`outcome`) via
// `deriveReviewPhase`, and the transitions write the assessment lifecycle.

async function fetchApplicationForStatus(tx: Tx, applicationId: string) {
  return tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      formStatus: true,
      closedAt: true,
      childName: true,
      school: true,
      leadApplicant: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      round: {
        select: { academicYear: true },
      },
      assessment: {
        select: { status: true, outcome: true },
      },
    },
  });
}

/** The derived review phase for a fetched application (lifecycle-column based). */
function reviewPhaseOf(application: {
  formStatus: import("@prisma/client").ApplicationFormStatus;
  closedAt: Date | null;
  assessment: {
    status: import("@prisma/client").AssessmentStatus;
    outcome: import("@prisma/client").AssessmentOutcome | null;
  } | null;
}) {
  return deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
    closedAt: application.closedAt,
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
 * the specialised actions (pauseApplication, resumeApplication).
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: "NOT_STARTED" | "COMPLETED",
  context?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForStatus(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        const oldStatus = reviewPhaseOf(application);

        // Behaviour-preserving guard matching the old fused graph:
        //   SUBMITTED → NOT_STARTED (begin review)
        //   NOT_STARTED → COMPLETED (mark complete)
        const legal =
          (newStatus === "NOT_STARTED" && oldStatus === "SUBMITTED") ||
          (newStatus === "COMPLETED" && oldStatus === "NOT_STARTED");
        if (!legal) {
          return {
            success: false as const,
            error: `Cannot transition from ${oldStatus} to ${newStatus}.`,
          };
        }

        if (newStatus === "NOT_STARTED") {
          await beginReview(tx, applicationId, user.id);
        } else {
          await markReviewComplete(tx, applicationId, user.id);
        }

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED,
          entityType: AUDIT_ENTITY_TYPES.Application,
          entityId: applicationId,
          context: context ?? `Status changed from ${oldStatus} to ${newStatus}`,
          metadata: {
            fromStatus: oldStatus,
            toStatus: newStatus,
            reference: application.reference,
          },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

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
 * @param customMessage       Optional personal note from the assessor, shown
 *                            in-portal AND injected into the MISSING_DOCS email.
 * @param deadlineIso         Optional assessor-chosen deadline (ISO/date string
 *                            from the dialog's date picker). When omitted the
 *                            status service falls back to `defaultPausedUntil()`.
 */
export async function pauseApplication(
  applicationId: string,
  missingDocumentSlots: string[],
  customMessage?: string,
  deadlineIso?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // Parse the assessor-chosen deadline (if any) up-front. The picker sends a
    // date-only "yyyy-mm-dd" string; build it as LOCAL midnight (not UTC, which
    // `new Date("2026-06-16")` would give) so the past-date comparison and the
    // emailed date render in the server's own day, free of timezone skew. Reject
    // malformed or past dates so a stale picker value can't set a gone deadline.
    let chosenDeadline: Date | undefined;
    if (deadlineIso && deadlineIso.trim() !== "") {
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadlineIso.trim());
      const parsed = ymd
        ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
        : new Date(deadlineIso);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid deadline date." };
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (parsed.getTime() < startOfToday.getTime()) {
        return { success: false, error: "The deadline cannot be in the past." };
      }
      chosenDeadline = parsed;
    }

    // First validate + persist + fetch application data (under RLS)
    const preEmail = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForStatus(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        const phase = reviewPhaseOf(application);
        // Old fused graph: only NOT_STARTED (review in progress) → PAUSED.
        if (phase !== "NOT_STARTED") {
          return {
            success: false as const,
            error: `Cannot pause application from status ${phase}.`,
          };
        }

        // Status service moves the assessment → PAUSED and PERSISTS the deadline
        // on the assessment row. Use the assessor-chosen deadline when supplied,
        // otherwise the service default. The returned deadline is the single
        // source the email reads below.
        const pausedUntil = await pauseReviewForDocs(
          tx,
          applicationId,
          user.id,
          chosenDeadline
        );

        return { success: true as const, application, phase, pausedUntil };
      }
    );

    if (!preEmail.success) return preEmail;
    const { application, phase, pausedUntil } = preEmail;

    // Build a human-readable list of missing slots
    const slotList = missingDocumentSlots
      .map((s) => `• ${humaniseSlot(s)}`)
      .join("\n");

    // The assessor's personal note leads the email body. When they leave it
    // blank, fall back to a neutral sentence so the email still reads correctly
    // (the {{custom_message}} placeholder sits at the top of the template).
    const noteForEmail =
      customMessage?.trim() ||
      "Thank you for submitting your bursary application. Having completed an initial review, we find that some supporting documents are still required.";

    // Send MISSING_DOCS email — non-blocking; log failure but don't abort.
    // Reads the persisted `paused_until` deadline instead of recomputing it.
    const docDeadline = pausedUntil;
    const emailResult = await sendEmail(
      application.leadApplicant.email,
      "MISSING_DOCS",
      {
        applicant_name:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        custom_message: noteForEmail,
        reference: application.reference,
        child_name: application.childName,
        missing_documents: slotList,
        deadline: docDeadline.toLocaleDateString("en-GB"),
      }
    );

    if (!emailResult.success) {
      console.warn(
        `[pauseApplication] MISSING_DOCS email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.APPLICATION_PAUSED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: "Application paused — missing documents requested",
        metadata: {
          fromStatus: phase,
          toStatus: "PAUSED",
          reference: application.reference,
          missingDocumentSlots,
          customMessage: customMessage ?? null,
          emailSent: emailResult.success,
          emailMessageId: emailResult.messageId ?? null,
        },
      })
    );

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[pauseApplication]", err);
    return { success: false, error: "Failed to pause application." };
  }
}

// ─── rejectAndRestartApplication (Full Rejection) ────────────────────────────

/**
 * Full Rejection: the submitted application is invalid as a whole. The assessor
 * voids it and the applicant is asked to start a brand-new application from
 * scratch.
 *
 * Because of the `@@unique([roundId, leadApplicantId, childName, childDob])`
 * constraint the rejected application cannot coexist with its replacement, so it
 * is HARD-DELETED (its cascades clear sections, contributors, documents,
 * assessment and invitations — this subsumes "clear all documents") and a fresh
 * blank application is created in its place, reusing the freed `reference`.
 * Storage objects are removed after the transaction commits (the DB cascade only
 * drops the Document rows). An `APPLICATION_RESTART_REQUIRED` email points the
 * applicant back into the portal, and the rejection is recorded in the
 * append-only audit log (which survives the row delete).
 *
 * Allowed before a final outcome only (SUBMITTED / NOT_STARTED / PAUSED).
 *
 * @param applicationId The application being rejected.
 * @param customMessage The assessor's note explaining what was wrong / what to
 *                      address in the new submission (shown in the email).
 */
export async function rejectAndRestartApplication(
  applicationId: string,
  customMessage?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // Admin context: deleting the application + creating the replacement's
    // PRIMARY contributor both need service_role (the application_contributors
    // write policy is admin-only — mirrors startApplicationAction).
    const result = await withAdminContext(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          reference: true,
          roundId: true,
          leadApplicantId: true,
          school: true,
          childName: true,
          childDob: true,
          entryYear: true,
          entryYearGroup: true,
          contactId: true,
          isReassessment: true,
          applicationType: true,
          bursaryAccountId: true,
          custodyArrangement: true,
          formStatus: true,
          closedAt: true,
          leadApplicant: {
            select: { email: true, firstName: true, lastName: true },
          },
          assessment: { select: { status: true, outcome: true } },
          documents: { select: { storagePath: true } },
        },
      });

      if (!application) {
        return { success: false as const, error: "Application not found." };
      }

      const phase = deriveReviewPhase({
        formStatus: application.formStatus,
        assessmentStatus: application.assessment?.status ?? null,
        outcome: application.assessment?.outcome ?? null,
        closedAt: application.closedAt,
      });

      // Reject only before a final outcome. A decided/completed application must
      // go through the outcome flow, not a restart.
      if (
        phase !== "SUBMITTED" &&
        phase !== "NOT_STARTED" &&
        phase !== "PAUSED"
      ) {
        return {
          success: false as const,
          error: `Cannot reject and restart an application from status ${phase}.`,
        };
      }

      const storagePaths = application.documents.map((d) => d.storagePath);
      const clearedDocumentCount = storagePaths.length;
      const oldReference = application.reference;

      // Void + recreate. Helper deletes the old row (cascade) and creates the
      // fresh blank application reusing the reference.
      const newApplicationId = await restartApplicationFromRejection(tx, {
        id: application.id,
        reference: application.reference,
        roundId: application.roundId,
        leadApplicantId: application.leadApplicantId,
        school: application.school,
        childName: application.childName,
        childDob: application.childDob,
        entryYear: application.entryYear,
        entryYearGroup: application.entryYearGroup,
        contactId: application.contactId,
        isReassessment: application.isReassessment,
        applicationType: application.applicationType,
        bursaryAccountId: application.bursaryAccountId,
        custodyArrangement: application.custodyArrangement,
      });

      // Audit on the OLD application id (entityId is a loose UUID — the row was
      // just deleted, but the append-only audit trail persists).
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.APPLICATION_REJECTED_RESTART,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: `Application ${oldReference} rejected and restarted from scratch`,
        metadata: {
          fromStatus: phase,
          reference: oldReference,
          customMessage: customMessage?.trim() || null,
          clearedDocumentCount,
          newApplicationId,
        },
      });

      return {
        success: true as const,
        newApplicationId,
        reference: oldReference,
        childName: application.childName,
        leadApplicant: application.leadApplicant,
        storagePaths,
      };
    });

    if (!result.success) return result;

    // Storage cleanup AFTER the DB transaction commits. Non-fatal — the Document
    // rows are already gone via cascade; an orphaned object is logged, not fatal.
    for (const path of result.storagePaths) {
      try {
        await deleteDocument(path);
      } catch (err) {
        console.warn(
          `[rejectAndRestartApplication] storage cleanup failed for ${path}:`,
          err
        );
      }
    }

    // Email the applicant — non-blocking. The note explains what was wrong; fall
    // back to a neutral sentence when the assessor left it blank.
    const noteForEmail =
      customMessage?.trim() ||
      "Having reviewed your application, we are unable to proceed with it as submitted.";
    const emailResult = await sendEmail(
      result.leadApplicant.email,
      "APPLICATION_RESTART_REQUIRED",
      {
        applicant_name:
          `${result.leadApplicant.firstName ?? ""} ${result.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        child_name: result.childName,
        reference: result.reference,
        custom_message: noteForEmail,
        restart_link: `${getAppUrl()}/apply/child-details`,
      }
    );
    if (!emailResult.success) {
      console.warn(
        `[rejectAndRestartApplication] APPLICATION_RESTART_REQUIRED email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    revalidateApplicationPaths(applicationId);
    revalidatePath(`/applications/${result.newApplicationId}`);

    return { success: true };
  } catch (err) {
    console.error("[rejectAndRestartApplication]", err);
    return { success: false, error: "Failed to reject and restart application." };
  }
}

// ─── reopenForMaterialChange (soft send-back, keep submission date) ───────────

/**
 * Reopen a SUBMITTED application for a MATERIAL change, KEEPING the original
 * submission date (D-G6/D3). A soft send-back: the form moves SUBMITTED →
 * IN_PROGRESS so the applicant (or staff on their behalf) can correct the data
 * and re-submit; the in-progress/paused assessment is DISCARDED in the same
 * transaction (state-model §4/§6.5/§7.2) so it is re-run against the corrected
 * form. Unlike `rejectAndRestartApplication`, NOTHING is deleted — all section
 * data is preserved, and the original `submitted_at` is retained (re-submission
 * reuses it without violating the write-once guard/trigger).
 *
 * Allowed only from a phase where an assessment is still live and reversible:
 * SUBMITTED (awaiting review), NOT_STARTED (review in progress) or PAUSED. A
 * COMPLETED/decided application is NOT reopened on this path.
 */
export async function reopenForMaterialChange(
  applicationId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      return { success: false, error: "A reason for reopening is required." };
    }

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForStatus(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        const phase = reviewPhaseOf(application);
        // Only reversible, pre-outcome phases. A reopen demotes the form, so the
        // form must currently be SUBMITTED (it is, in every one of these phases).
        if (
          phase !== "SUBMITTED" &&
          phase !== "NOT_STARTED" &&
          phase !== "PAUSED"
        ) {
          return {
            success: false as const,
            error: `Cannot reopen an application from status ${phase}.`,
          };
        }

        // Form SUBMITTED → IN_PROGRESS + discard the live assessment (the
        // primitive writes the ASSESSMENT_DISCARDED audit row itself).
        const { assessmentDiscarded } = await reopenAssessmentForMaterialChange(
          tx,
          applicationId,
          user.id,
          trimmedReason
        );

        // Audit the reopen (the form-status side); the discard is audited by the
        // primitive as ASSESSMENT_DISCARDED.
        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED,
          entityType: AUDIT_ENTITY_TYPES.Application,
          entityId: applicationId,
          context: `Application reopened for a material change: ${trimmedReason}`,
          metadata: {
            fromStatus: phase,
            toStatus: "PRE_SUBMISSION",
            formStatus: "IN_PROGRESS",
            reference: application.reference,
            reason: trimmedReason,
            assessmentDiscarded,
            submittedAtRetained: true,
          },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[reopenForMaterialChange]", err);
    return { success: false, error: "Failed to reopen application." };
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
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await fetchApplicationForStatus(tx, applicationId);
        if (!application) {
          return { success: false as const, error: "Application not found." };
        }

        const phase = reviewPhaseOf(application);
        // Old fused graph: only PAUSED → NOT_STARTED (resume).
        if (phase !== "PAUSED") {
          return {
            success: false as const,
            error: `Cannot resume application from status ${phase}.`,
          };
        }

        // Resume moves the assessment back to IN_PROGRESS and clears the
        // persisted pause deadline.
        await resumeReview(tx, applicationId, user.id);

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.APPLICATION_RESUMED,
          entityType: AUDIT_ENTITY_TYPES.Application,
          entityId: applicationId,
          context: "Application resumed from PAUSED to NOT_STARTED",
          metadata: {
            fromStatus: phase,
            toStatus: "NOT_STARTED",
            reference: application.reference,
          },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

    revalidateApplicationPaths(applicationId);

    return { success: true };
  } catch (err) {
    console.error("[resumeApplication]", err);
    return { success: false, error: "Failed to resume application." };
  }
}

// ─── assignApplicationAction ──────────────────────────────────────────────────

/**
 * Assigns (or unassigns) an application to an assessor.
 * Only ADMIN users may reassign applications.
 */
export async function assignApplicationAction(
  applicationId: string,
  assessorId: string | null
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { assignedToId: assessorId },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.APPLICATION_ASSESSOR_ASSIGNED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: assessorId
          ? `Application assigned to assessor ${assessorId}`
          : "Application unassigned from assessor",
        metadata: { assessorId },
      });
    });

    revalidatePath(`/applications/${applicationId}`);

    return { success: true };
  } catch (err) {
    console.error("[assignApplicationAction]", err);
    return { success: false, error: "Failed to assign assessor." };
  }
}

// ─── bulkAssignApplicationsAction ─────────────────────────────────────────────

/** Hard cap on how many applications a single bulk assign may touch. */
const BULK_ASSIGN_MAX = 500;

/**
 * Assigns (or unassigns) MANY applications to a single assessor in one pass.
 *
 * Mirrors `assignApplicationAction` but over a list of ids. Each application
 * gets its own `APPLICATION_ASSESSOR_ASSIGNED` audit row (identical action +
 * metadata shape to the single action) so the per-application trail is
 * preserved — there is no aggregate "bulk" audit event by design.
 *
 * ADMIN only. Empty input is a no-op success; oversized input is rejected.
 * Runs every update + audit write inside a single `withUserContext` so RLS
 * `current_user_id()` / role are set once for the whole batch.
 */
export async function bulkAssignApplicationsAction(
  applicationIds: string[],
  assessorId: string | null
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    const user = await requireRole([Role.ADMIN]);

    // De-dupe and drop falsy ids defensively.
    const ids = Array.from(new Set(applicationIds.filter(Boolean)));

    if (ids.length === 0) {
      return { success: true, updated: 0 };
    }
    if (ids.length > BULK_ASSIGN_MAX) {
      return {
        success: false,
        updated: 0,
        error: `Cannot assign more than ${BULK_ASSIGN_MAX} applications at once.`,
      };
    }

    const updated = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        let count = 0;
        for (const applicationId of ids) {
          await tx.application.update({
            where: { id: applicationId },
            data: { assignedToId: assessorId },
          });

          await createAuditLog(tx, {
            userId: user.id,
            action: AUDIT_ACTIONS.APPLICATION_ASSESSOR_ASSIGNED,
            entityType: AUDIT_ENTITY_TYPES.Application,
            entityId: applicationId,
            context: assessorId
              ? `Application assigned to assessor ${assessorId}`
              : "Application unassigned from assessor",
            metadata: { assessorId },
          });

          count += 1;
        }
        return count;
      }
    );

    revalidatePath("/queue");

    return { success: true, updated };
  } catch (err) {
    console.error("[bulkAssignApplicationsAction]", err);
    return {
      success: false,
      updated: 0,
      error: "Failed to assign applications.",
    };
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
 * Dual-parent (backlog #20, PR 6): if the application has a SECONDARY
 * contributor (a second parent who supplied their own financials/documents),
 * their contribution is erased too. Their owned sections and documents are
 * already covered by the by-applicationId deletes below (sections and Document
 * rows are deleted for the WHOLE application, and Storage objects are deleted by
 * enumerating every Document row's storagePath — including the secondary's
 * `documents/{appId}/secondary/...` files). What this action adds is: deleting
 * the ApplicationContributor rows (the application is ANONYMISED not deleted, so
 * the ON DELETE CASCADE never fires), and — guarded — anonymising the
 * secondary's Profile + deleting their Supabase auth user. That last step ONLY
 * happens when the secondary's Profile is linked to nothing else; if they are a
 * lead applicant for another child (or a secondary elsewhere) the Profile and
 * auth user are RETAINED and only their link + data on THIS application is
 * removed. See `decideSecondaryProfileErasure`.
 *
 * Access: ASSESSOR role only.
 * Guard:  Cannot delete if application was submitted within the last 7 years.
 */
export async function gdprDeleteApplicantAction(
  applicationId: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    // 1. Fetch the application with all relevant relations (admin context —
    //    GDPR cascade must bypass RLS for full visibility and mutation).
    const application = await withAdminContext((tx) =>
      tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          reference: true,
          submittedAt: true,
          archivedAt: true,
          closedAt: true,
          leadApplicantId: true,
          documents: { select: { id: true, storagePath: true } },
          assessment: {
            select: {
              id: true,
              outcome: true,
              property: { select: { id: true } },
              recommendation: { select: { id: true } },
            },
          },
          bursaryAccount: {
            select: { status: true, closedAt: true },
          },
        },
      })
    );

    if (!application) {
      return { success: false, error: "Application not found." };
    }

    // 2. Tiered retention check (Epic 10, D6) — single source of truth shared
    //    with the auto-purge cron. Replaces the old flat 7-year-from-submission
    //    guard; the horizon now depends on the outcome (declined / qualifies-
    //    not-awarded / awarded) and anchors from the correct date.
    const evaluation = isPurgeable(
      {
        outcome: application.assessment?.outcome ?? null,
        closedAt: application.closedAt,
        archivedAt: application.archivedAt,
        submittedAt: application.submittedAt,
      },
      application.bursaryAccount
        ? {
            status: application.bursaryAccount.status,
            closedAt: application.bursaryAccount.closedAt,
          }
        : null
    );
    if (!evaluation.purgeable) {
      return {
        success: false,
        error: notYetPurgeableMessage(evaluation),
      };
    }

    const leadApplicantId = application.leadApplicantId;

    // 3. Run the shared erasure cascade (Epic 10): Storage-first, anonymising
    //    DB transaction (append-only audit honoured by nulling userId, never
    //    deleting), dual-parent shared-profile guard, then Supabase auth
    //    deletion. The manual button and the auto-purge cron call the SAME
    //    cascade, so they can never diverge.
    const purgeResult = await purgeApplication(
      {
        id: application.id,
        reference: application.reference,
        leadApplicantId,
        documents: application.documents,
        assessment: application.assessment
          ? {
              id: application.assessment.id,
              property: application.assessment.property,
              recommendation: application.assessment.recommendation,
            }
          : null,
      },
      {
        withAdminContext,
        deleteDocument,
        deleteAuthUser: (uid) =>
          createSupabaseAdminClient().auth.admin.deleteUser(uid),
      }
    );

    // 4. Write the GDPR audit log entry (the lead's userId was just nulled, so
    //    we record the assessor who triggered it). Admin context so the insert
    //    succeeds independently of the actor's current_user_id() / role.
    await withAdminContext((tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.GDPR_DELETION,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: `GDPR deletion performed on application ${application.reference}`,
        metadata: buildPurgeAuditMetadata(
          application,
          leadApplicantId,
          purgeResult
        ),
      })
    );

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

// ─── setSubmissionDeadlineAction (Epic 03 — per-application submit-by) ──────────

/**
 * Sets or clears the per-application submission deadline override
 * (`submission_deadline_at`). ADMIN-gated.
 *
 * - `deadlineIso` is an ISO 8601 instant (from a datetime-local input, converted
 *   client-side) granting THIS applicant a later/earlier submit-by date than the
 *   round default/close. Passing `null` (or empty) CLEARS the override,
 *   reverting the application to the round's default deadline (Item 12), or the
 *   round close date if the round has no default.
 * - The effective deadline is derived everywhere via
 *   `effectiveSubmissionDeadline()` (src/lib/rounds/submission-deadline.ts);
 *   this action only persists the raw override.
 * - Audited as `SET_SUBMISSION_DEADLINE`. Never touches `submitted_at`,
 *   `form_status`, or the assessment pause clock — the three clocks stay
 *   distinct (plan §3).
 */
export async function setSubmissionDeadlineAction(
  applicationId: string,
  deadlineIso: string | null
): Promise<ActionResult> {
  const user = await requireRole([Role.ADMIN]);

  let deadline: Date | null = null;
  if (deadlineIso && deadlineIso.trim() !== "") {
    const parsed = new Date(deadlineIso);
    if (Number.isNaN(parsed.getTime())) {
      return { success: false, error: "Invalid deadline date." };
    }
    deadline = parsed;
  }

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, reference: true, roundId: true },
      });
      if (!app) throw new Error("Application not found.");

      await tx.application.update({
        where: { id: applicationId },
        data: { submissionDeadlineAt: deadline },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SET_SUBMISSION_DEADLINE,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: deadline
          ? `Set submission deadline for ${app.reference} to ${deadline.toISOString()}`
          : `Cleared submission deadline override for ${app.reference} (reverts to round close)`,
        metadata: {
          reference: app.reference,
          roundId: app.roundId,
          submissionDeadlineAt: deadline ? deadline.toISOString() : null,
        },
      });
    });

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/queue");

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to set submission deadline.";
    console.error("[setSubmissionDeadlineAction]", err);
    return { success: false, error: message };
  }
}

// ─── updateApplicationReferenceAction (item 11 — editable bursary reference) ──

/**
 * Updates an application's bursary reference. ADMIN-only, no lifecycle-state
 * gate — the reference is explicitly exempt from state-gating (Story 11.1) and
 * can be changed in any state, including archived/closed. Never touches any
 * assessment, recommendation, or outcome.
 *
 * - The value is stored VERBATIM — no trimming/normalisation. Whitespace and
 *   special characters are significant (Story 11.2, decided); only emptiness
 *   after trim is rejected.
 * - Re-saving the current value (case-sensitively identical) is a no-op — no
 *   write, no audit entry.
 * - Uniqueness is case-insensitive (Story 11.2): a pre-check inside the
 *   transaction returns a friendly error naming the conflicting application,
 *   and the `applications_reference_lower_key` functional unique index
 *   (migration 20260709130000_reference_case_insensitive_unique) catches any
 *   race the pre-check misses.
 * - Audited as `UPDATE_REFERENCE` only on success, capturing { from, to }.
 */
export async function updateApplicationReferenceAction(
  applicationId: string,
  newReference: string
): Promise<ActionResult> {
  const user = await requireRole([Role.ADMIN]);

  const validation = validateReferenceInput(newReference);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, reference: true },
      });
      if (!app) throw new Error("Application not found.");

      // Unchanged (case-sensitively identical) — nothing to persist or audit.
      if (app.reference === newReference) return;

      const conflict = await tx.application.findFirst({
        where: {
          reference: { equals: newReference, mode: "insensitive" },
          id: { not: applicationId },
        },
        select: { reference: true },
      });
      if (conflict) {
        throw new Error(
          `"${conflict.reference}" is already in use by another application.`
        );
      }

      await tx.application.update({
        where: { id: applicationId },
        data: { reference: newReference },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.UPDATE_REFERENCE,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: `Changed bursary reference from "${app.reference}" to "${newReference}"`,
        metadata: { from: app.reference, to: newReference },
      });
    });

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/queue");

    return { success: true };
  } catch (err) {
    let message =
      err instanceof Error ? err.message : "Failed to update reference.";
    // Unique constraint violation race on the case-insensitive functional
    // index — mirrors createRoundAction's message-matching pattern
    // (src/app/(admin)/rounds/actions.ts).
    if (message.includes("Unique constraint")) {
      message = "That reference is already in use by another application.";
    }
    console.error("[updateApplicationReferenceAction]", err);
    return { success: false, error: message };
  }
}

// ─── closeApplicationAction (item 2 — the unified close) ───────────────────────

/**
 * Closes an application into the single terminal Closed state (item 2) under
 * an admin-configured close reason (item 4.1). ADMIN-only. Delegates to
 * `closeApplicationCore` — the same core the A4 bulk close loops — inside one
 * admin-context transaction (the purge touches RLS-protected tables), then
 * performs the post-commit auth-user deletions the purge may have queued.
 */
export async function closeApplicationAction(
  applicationId: string,
  closeReasonId: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    if (!closeReasonId || typeof closeReasonId !== "string") {
      return { success: false, error: "A close reason is required." };
    }

    const result = await withAdminContext((tx) =>
      closeApplicationCore(
        tx,
        { applicationId, closeReasonId, actorId: user.id },
        { deleteDocument }
      )
    );

    if (!result.success) return result;

    // Post-commit: auth-user deletion is external to Postgres (non-fatal —
    // failures are logged; the data-side purge has already committed).
    if (result.authUsersToDelete.length > 0) {
      await deleteAuthUsersPostCommit(result.authUsersToDelete, {
        deleteAuthUser: (uid) =>
          createSupabaseAdminClient().auth.admin.deleteUser(uid),
      });
    }

    revalidateApplicationPaths(applicationId);
    return { success: true };
  } catch (err) {
    console.error("[closeApplicationAction]", err);
    return { success: false, error: "Failed to close the application." };
  }
}

// ─── bulkMarkActiveAction (item 3 — the school's OFFERED decision) ─────────────

/** Hard cap on how many applications a single bulk activation may touch. */
const BULK_MARK_ACTIVE_MAX = 500;

export interface BulkResultRow {
  id: string;
  reference: string;
  reason: string;
}

export interface BulkMarkActiveResult {
  success: boolean;
  succeeded: number;
  skipped: BulkResultRow[];
  error?: string;
}

/**
 * Marks MANY applications active in one pass — the bulk counterpart of the
 * per-row "Move to active bursary" item (Story 3.1). Per D-4 (resolved
 * 2026-07-09): direct activation, no outcome write, no outcome email. Calls
 * `promoteToActiveAccount` DIRECTLY, the same primitive the per-row path (and
 * the AWARDED outcome path) uses — no forked activation logic.
 *
 * Gate per row (mirrors `ApplicationRowActions`'s `canDecide`): not closed,
 * assessment COMPLETED, no outcome already recorded. Invalid rows are skipped
 * and reported; the batch never fails as a whole (Story 3.1's AC).
 *
 * ADMIN only. Runs the whole batch inside ONE `withAdminContext` transaction
 * (mirrors `bulkAssignApplicationsAction`'s single-tx shape) — activation is a
 * light write (account create/continue + schedule), unlike bulk close, which
 * may purge and therefore isolates each row into its own transaction.
 */
export async function bulkMarkActiveAction(
  applicationIds: string[]
): Promise<BulkMarkActiveResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const ids = Array.from(new Set(applicationIds.filter(Boolean)));
    if (ids.length === 0) {
      return { success: true, succeeded: 0, skipped: [] };
    }
    if (ids.length > BULK_MARK_ACTIVE_MAX) {
      return {
        success: false,
        succeeded: 0,
        skipped: [],
        error: `Cannot activate more than ${BULK_MARK_ACTIVE_MAX} applications at once.`,
      };
    }

    const { succeeded, skipped } = await withAdminContext(async (tx) => {
      let succeeded = 0;
      const skipped: BulkResultRow[] = [];

      for (const applicationId of ids) {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            reference: true,
            school: true,
            childName: true,
            childDob: true,
            entryYear: true,
            entryYearGroup: true,
            bursaryAccountId: true,
            leadApplicantId: true,
            closedAt: true,
            round: {
              select: { academicYear: true, openDate: true, closeDate: true },
            },
            assessment: {
              select: {
                status: true,
                outcome: true,
                // CALC-08: the account benchmark walks recommendation
                // confirmed → v2 recommended snapshot → legacy yearly
                // (see account-promotion.ts).
                yearlyPayableFees: true,
                recommendedPayableFees: true,
                recommendation: {
                  select: {
                    bursaryAward: true,
                    scholarshipAward: true,
                    confirmedPayableFees: true,
                  },
                },
              },
            },
          },
        });

        if (!application) {
          skipped.push({
            id: applicationId,
            reference: applicationId,
            reason: "Application not found.",
          });
          continue;
        }
        // Gate mirrors ApplicationRowActions' `canDecide` exactly — not
        // closed, assessment finished in full, no outcome already recorded.
        if (application.closedAt != null) {
          skipped.push({
            id: applicationId,
            reference: application.reference,
            reason: "Application is closed.",
          });
          continue;
        }
        if (application.assessment?.status !== "COMPLETED") {
          skipped.push({
            id: applicationId,
            reference: application.reference,
            reason: "The assessment is not yet complete.",
          });
          continue;
        }
        if (application.assessment.outcome != null) {
          skipped.push({
            id: applicationId,
            reference: application.reference,
            reason: "An outcome has already been recorded.",
          });
          continue;
        }

        // The Recommendation interface requires award figures but they are
        // not stored on the account (see account-promotion.ts) — pass
        // through whatever is on record (nulls when no recommendation exists
        // yet), exactly as the AWARDED outcome path does.
        const recommendation = application.assessment.recommendation;
        const awards = {
          bursaryAward:
            recommendation?.bursaryAward != null
              ? Number(recommendation.bursaryAward)
              : null,
          scholarshipAward:
            recommendation?.scholarshipAward != null
              ? Number(recommendation.scholarshipAward)
              : null,
        };

        const result = await promoteToActiveAccount(tx, application, awards);

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.APPLICATION_MARKED_ACTIVE,
          entityType: AUDIT_ENTITY_TYPES.Application,
          entityId: applicationId,
          context: `Application ${application.reference} marked active`,
          metadata: {
            accountId: result.bursaryAccountId,
            created: result.created,
            reference: application.reference,
          },
        });

        succeeded += 1;
      }

      return { succeeded, skipped };
    });

    revalidatePath("/queue");

    return { success: true, succeeded, skipped };
  } catch (err) {
    console.error("[bulkMarkActiveAction]", err);
    return {
      success: false,
      succeeded: 0,
      skipped: [],
      error: "Failed to activate applications.",
    };
  }
}

// ─── bulkCloseApplicationsAction (item 3 — one batch-wide close reason) ────────

/** Hard cap on how many applications a single bulk close may touch. */
const BULK_CLOSE_MAX = 500;

export interface BulkCloseResult {
  success: boolean;
  succeeded: number;
  skipped: BulkResultRow[];
  error?: string;
}

/**
 * Closes MANY applications under ONE batch-wide close reason (Story 3.2).
 * Loops `closeApplicationCore` — the SAME core the per-row `closeApplicationAction`
 * calls — so per-row and bulk share one close path (Story 3.2's AC); no forked
 * close logic. Reason enforcement (must exist, must be active) and the
 * reason-driven purge (item 10) are entirely the core's responsibility.
 *
 * Each row runs in its OWN `withAdminContext` transaction — a purge-triggering
 * reason applied across up to 500 rows in one giant transaction is a hazard
 * (long-held locks, one failure rolling back an otherwise-successful batch), so
 * rows are isolated and skip-and-report independently (Story 3.2's AC: the
 * batch never fails as a whole). Post-commit auth-user deletion runs after
 * EACH row's transaction commits, mirroring the per-row action exactly.
 *
 * ADMIN only.
 */
export async function bulkCloseApplicationsAction(
  applicationIds: string[],
  closeReasonId: string
): Promise<BulkCloseResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    if (!closeReasonId || typeof closeReasonId !== "string") {
      return {
        success: false,
        succeeded: 0,
        skipped: [],
        error: "A close reason is required.",
      };
    }

    const ids = Array.from(new Set(applicationIds.filter(Boolean)));
    if (ids.length === 0) {
      return { success: true, succeeded: 0, skipped: [] };
    }
    if (ids.length > BULK_CLOSE_MAX) {
      return {
        success: false,
        succeeded: 0,
        skipped: [],
        error: `Cannot close more than ${BULK_CLOSE_MAX} applications at once.`,
      };
    }

    // References for skip reporting — `closeApplicationCore`'s failure path
    // doesn't carry one (e.g. "not found" has none to give), so resolve them
    // up front in a single read rather than threading it through the core.
    const referenceRows = await withAdminContext((tx) =>
      tx.application.findMany({
        where: { id: { in: ids } },
        select: { id: true, reference: true },
      })
    );
    const referenceById = new Map(referenceRows.map((r) => [r.id, r.reference]));

    let succeeded = 0;
    const skipped: BulkResultRow[] = [];

    for (const applicationId of ids) {
      const result = await withAdminContext((tx) =>
        closeApplicationCore(
          tx,
          { applicationId, closeReasonId, actorId: user.id },
          { deleteDocument }
        )
      );

      if (!result.success) {
        skipped.push({
          id: applicationId,
          reference: referenceById.get(applicationId) ?? applicationId,
          reason: result.error,
        });
        continue;
      }

      // Post-commit: auth-user deletion is external to Postgres (non-fatal —
      // failures are logged; this row's data-side purge has already
      // committed). Runs after EACH row's own transaction, not the whole batch.
      if (result.authUsersToDelete.length > 0) {
        await deleteAuthUsersPostCommit(result.authUsersToDelete, {
          deleteAuthUser: (uid) =>
            createSupabaseAdminClient().auth.admin.deleteUser(uid),
        });
      }

      succeeded += 1;
    }

    revalidatePath("/queue");

    return { success: true, succeeded, skipped };
  } catch (err) {
    console.error("[bulkCloseApplicationsAction]", err);
    return {
      success: false,
      succeeded: 0,
      skipped: [],
      error: "Failed to close applications.",
    };
  }
}
