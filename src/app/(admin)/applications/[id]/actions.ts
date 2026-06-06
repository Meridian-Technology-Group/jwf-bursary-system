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
import { setApplicationOutcomeLegacy } from "@/lib/applications/set-outcome-core";
import { isPurgeable, notYetPurgeableMessage } from "@/lib/retention/policy";
import {
  purgeApplication,
  buildPurgeAuditMetadata,
} from "@/lib/retention/purge";
import {
  beginReview,
  resumeReview,
  markReviewComplete,
  pauseReviewForDocs,
  deriveReviewPhase,
} from "@/lib/applications/status";

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
  assessment: {
    status: import("@prisma/client").AssessmentStatus;
    outcome: import("@prisma/client").AssessmentOutcome | null;
  } | null;
}) {
  return deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
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
 * @param customMessage       Optional free-text appended to the email body.
 */
export async function pauseApplication(
  applicationId: string,
  missingDocumentSlots: string[],
  customMessage?: string
): Promise<ActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

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

        // Status service moves the assessment → PAUSED and PERSISTS the 14-day
        // deadline on the assessment row (previously email-only). The returned
        // deadline is the single source the email reads below.
        const pausedUntil = await pauseReviewForDocs(
          tx,
          applicationId,
          user.id
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

// ─── setOutcome ───────────────────────────────────────────────────────────────

/**
 * Sets the final outcome of a COMPLETED application to QUALIFIES or
 * DOES_NOT_QUALIFY, and sends the appropriate outcome email.
 *
 * Thin wrapper around the shared core in
 * `@/lib/applications/set-outcome-core` (backlog #11) — see that module for
 * the transition validation, idempotent BursaryAccount creation, email and
 * canonical audit write. This entry point revalidates the application-detail
 * paths.
 */
export async function setOutcome(
  applicationId: string,
  outcome: "QUALIFIES" | "DOES_NOT_QUALIFY"
): Promise<ActionResult> {
  const result = await setApplicationOutcomeLegacy(applicationId, outcome);
  if (result.success) {
    revalidateApplicationPaths(applicationId);
  }
  return result;
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
 *   round close. Passing `null` (or empty) CLEARS the override, reverting the
 *   application to the round-level close date.
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
