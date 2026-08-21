"use server";

/**
 * Server actions for the applicant portal dashboard.
 *
 * startApplicationAction handles the onboarding card submitted when the
 * bursar did not pre-fill school/childName on the invitation.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InvitationStatus, Role } from "@prisma/client";
import { withAdminContext } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/roles";
import {
  getLatestAcceptedInvitationForUser,
  markInvitationAccepted,
} from "@/lib/db/queries/invitations";
import { createReassessmentApplicationFromInvitation } from "@/lib/db/queries/reassessment";
import { createFirstYearApplicationFromSource } from "@/lib/applications/create-from-invitation";
import { setActiveApplicationId } from "@/lib/portal/active-application";
import { resumeReview } from "@/lib/applications/status";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/app-url";
import { assertSubmissionInvariantPreserved } from "@/lib/portal/missing-docs-invariant";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const StartApplicationSchema = z.object({
  school: z.enum(["TRINITY", "WHITGIFT"] as const, {
    error: "Please select a school.",
  }),
  childName: z
    .string()
    .min(1, "Child's full name is required.")
    .max(200, "Name is too long."),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Error-only result. On success the action calls `redirect()`, which
 * causes Next.js to resolve the client-side promise with `undefined` and
 * navigate the browser — so the client only ever observes this object when
 * something went wrong before the redirect.
 */
export type StartApplicationResult = { success: false; error: string };

// ---------------------------------------------------------------------------
// startApplicationAction
// ---------------------------------------------------------------------------

/**
 * Creates an Application from the portal onboarding card.
 *
 * The applicant provides school + childName; all other data comes from
 * the invitation they accepted during registration.
 */
export async function startApplicationAction(
  formData: FormData
): Promise<StartApplicationResult> {
  const user = await requireRole([Role.APPLICANT]);

  // Parse and validate inputs
  const raw = {
    school: formData.get("school"),
    childName: formData.get("childName"),
  };

  const parsed = StartApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: first };
  }

  const { school, childName } = parsed.data;

  // Validation + DB work runs inside try; redirect happens after so the
  // NEXT_REDIRECT thrown by redirect() doesn't get swallowed by the catch.
  try {
    // Runs in admin context: creating the application's PRIMARY contributor
    // (dual-parent foundation) requires service_role, since the
    // application_contributors write policy is admin-only (PR 1). The applicant
    // is already authenticated above and the created application is owned by
    // them (leadApplicantId = user.id), mirroring the register / re-assessment
    // applicant-create paths which also run under withAdminContext.
    const validation = await withAdminContext(
      async (tx) => {
        const invitation = await getLatestAcceptedInvitationForUser(tx, user.id);

        if (!invitation) {
          return {
            error:
              "We could not find an accepted invitation for your account. Please contact the Foundation.",
          };
        }

        if (invitation.bursaryAccountId) {
          return {
            error:
              "This invitation is for a re-assessment. Please follow the re-assessment link sent to you by the Foundation.",
          };
        }

        if (!invitation.roundId) {
          return {
            error:
              "Your invitation does not have an assessment round assigned. Please contact the Foundation.",
          };
        }

        // The entry year-group is JWF-facing and admin-set (Q1) — the applicant
        // cannot supply it here, so a bare invitation that never captured one
        // is a Foundation-side data gap, not something to prompt the parent for.
        if (!invitation.entryYearGroup) {
          return {
            error:
              "Your invitation does not have an entry year group assigned. Please contact the Foundation.",
          };
        }

        // E2 (CG-04): the dedupe is scoped to THIS invitation's round + child.
        // The old profile-wide check (`any application exists`) silently
        // skipped creation for a SECOND child on the same login and dropped
        // the parent into the first child's form.
        const effectiveChildName = invitation.childName ?? childName.trim();
        const existing = await tx.application.findFirst({
          where: {
            leadApplicantId: user.id,
            roundId: invitation.roundId,
            childName: { equals: effectiveChildName, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (!existing) {
          const round = await tx.round.findUnique({
            where: { id: invitation.roundId },
            select: { academicYear: true },
          });

          if (!round) {
            return {
              error:
                "The assessment round could not be found. Please contact the Foundation.",
            };
          }

          // D1 lock-enforcement: when the invitation already fixes the school
          // (seeded from the admin's contact), it is authoritative — the
          // parent-supplied school is IGNORED. Likewise childName + the locked
          // entry-year come from the invitation when present. The parent's
          // onboarding-card inputs only fill the gaps a bare invite left open.
          // (Epic 02 removes the parent school selector entirely; this is the
          // server-side belt-and-braces in the interim.)
          const createdId = await createFirstYearApplicationFromSource(tx, {
            leadApplicantId: user.id,
            roundId: invitation.roundId,
            school: invitation.school ?? school,
            childName: effectiveChildName,
            // Split identity only when the invitation carries it (G2); a
            // parent-supplied gap-fill name has no split source.
            childFirstName: invitation.childFirstName,
            childLastName: invitation.childLastName,
            childDob: invitation.childDob,
            entryYear: invitation.entryYear,
            entryYearGroup: invitation.entryYearGroup,
            contactId: invitation.contactId,
          });
          return { error: null, applicationId: createdId };
        }

        return { error: null, applicationId: existing.id };
      }
    );

    if (validation.error) {
      return { success: false, error: validation.error };
    }

    // E2: the application just started/resumed becomes the active context so
    // the wizard opens on THIS child.
    if ("applicationId" in validation && validation.applicationId) {
      await setActiveApplicationId(validation.applicationId);
    }

    revalidatePath("/");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("[portal/actions] startApplicationAction error:", err);
    return { success: false, error: message };
  }

  redirect("/apply/child-details");
}

// ---------------------------------------------------------------------------
// beginReassessmentAction
// ---------------------------------------------------------------------------

/**
 * Error-only result. On success the action calls `redirect()` (see
 * StartApplicationResult for why the client never observes a success object).
 */
export type BeginReassessmentResult = { success: false; error: string };

/**
 * Begins a re-assessment from the portal "Welcome back" card.
 *
 * Unlike the first-year onboarding card, a re-assessment invite is left
 * PENDING on login (see getOrAcceptLatestInvitationForUser). This action is
 * where it is finally consumed:
 *
 *   1. Find the user's PENDING re-assessment invite (bursaryAccountId set).
 *   2. Create the fully prepopulated re-assessment application (shared helper).
 *   3. Mark the invitation ACCEPTED + write the ACCEPT_INVITATION audit log.
 *   4. Redirect into the form.
 *
 * Runs under admin context: writes to invitations.status and the
 * cross-application prepopulation reads are not granted to the app_user role.
 */
export async function beginReassessmentAction(): Promise<BeginReassessmentResult> {
  const user = await requireRole([Role.APPLICANT]);

  try {
    const result = await withAdminContext(async (tx) => {
      const invitation = await tx.invitation.findFirst({
        where: {
          authUserId: user.id,
          status: InvitationStatus.PENDING,
          bursaryAccountId: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!invitation) {
        return {
          error:
            "We could not find a pending re-assessment invitation for your account. Please contact the Foundation.",
        };
      }

      if (!invitation.roundId) {
        return {
          error:
            "Your re-assessment invitation does not have an assessment round assigned. Please contact the Foundation.",
        };
      }

      if (invitation.expiresAt < new Date()) {
        return {
          error:
            "This re-assessment invitation has expired. Please contact the Foundation for a new one.",
        };
      }

      const { id: applicationId } =
        await createReassessmentApplicationFromInvitation(tx, invitation);

      await markInvitationAccepted(tx, invitation.id, user.id);

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ACCEPT_INVITATION,
        entityType: AUDIT_ENTITY_TYPES.Invitation,
        entityId: invitation.id,
        context: `Re-assessment invitation accepted by ${invitation.email}`,
        metadata: {
          email: invitation.email,
          roundId: invitation.roundId,
          bursaryAccountId: invitation.bursaryAccountId,
          applicationId,
        },
      });

      return { error: null, applicationId };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    // E2: the freshly created re-assessment becomes the active context.
    if ("applicationId" in result && result.applicationId) {
      await setActiveApplicationId(result.applicationId);
    }

    revalidatePath("/");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    console.error("[portal/actions] beginReassessmentAction error:", err);
    return { success: false, error: message };
  }

  redirect("/apply/child-details");
}

// ---------------------------------------------------------------------------
// submitMissingDocsResponse
// ---------------------------------------------------------------------------

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Applicant-side counterpart to the assessor's `pauseApplication` action.
 *
 * Called from the "Respond to a missing-documents request" page when the
 * applicant has re-uploaded the requested files and clicks "Send to
 * assessor". Transitions the application PAUSED → NOT_STARTED (the status
 * the portal surfaces as "Under Review") and records a
 * `MISSING_DOCS_RESPONDED` audit row that mirrors the assessor's
 * `APPLICATION_PAUSED` entry.
 *
 * Ownership and the PAUSED precondition are both enforced server-side so the
 * action is safe even if the page state is stale.
 */
export async function submitMissingDocsResponse(
  applicationId: string
): Promise<ActionResult> {
  const user = await requireRole([Role.APPLICANT]);

  try {
    // Admin (service-role) context: the assessment row is invisible to the
    // applicant under RLS (assessments_select is staff-only), so reading its
    // PAUSED status and resuming review must bypass RLS. Ownership is enforced
    // explicitly below (leadApplicantId === user.id) since RLS no longer does.
    // Mirrors startApplicationAction, which likewise runs an applicant action
    // under admin context with an explicit ownership check.
    const result = await withAdminContext(
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            reference: true,
            formStatus: true,
            submittedAt: true,
            childName: true,
            leadApplicantId: true,
            assignedToId: true,
            assessment: {
              select: { id: true, status: true, assessorId: true },
            },
          },
        });

        if (!application || application.leadApplicantId !== user.id) {
          return { success: false as const, error: "Application not found." };
        }

        // PR-6a: "awaiting documents" reads the assessment lifecycle (PAUSED)
        // rather than the deprecated fused `applications.status`.
        if (application.assessment?.status !== "PAUSED") {
          return {
            success: false as const,
            error:
              "This application is not currently awaiting documents, so there is nothing to send.",
          };
        }

        // Capture the pre-response submission invariants. The portal missing-doc
        // upload must keep the SUBMISSION DATE intact and the form status fixed
        // (Epic 05 §3.5): only the assessment moves (PAUSED → resumes). The
        // uploads themselves are attached to the application by the FileUpload
        // mechanic (/api/documents) before this action is called, so this action
        // just resumes the assessment — it never touches submittedAt/formStatus.
        const submittedAtBefore = application.submittedAt;
        const formStatusBefore = application.formStatus;

        // A PAUSED assessment always exists with its original assessor; resume it
        // (assessment PAUSED → IN_PROGRESS) and clear the persisted pause
        // deadline. The applicant is not the assessor, so we resume the existing
        // row rather than creating one.
        await resumeReview(tx, applicationId, application.assessment.assessorId);

        // Invariant guard (defence-in-depth): re-read and assert the submission
        // date + form status did NOT move. The write-once submitted_at trigger
        // (Epic 01) is the durable backstop; this catches a regression here at
        // the app layer with a clear message.
        const after = await tx.application.findUnique({
          where: { id: applicationId },
          select: { submittedAt: true, formStatus: true },
        });
        assertSubmissionInvariantPreserved(
          { submittedAt: submittedAtBefore, formStatus: formStatusBefore },
          after
            ? { submittedAt: after.submittedAt, formStatus: after.formStatus }
            : null
        );

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.MISSING_DOCS_RESPONDED,
          entityType: AUDIT_ENTITY_TYPES.Application,
          entityId: applicationId,
          context: "Applicant responded to a missing-documents request",
          metadata: {
            fromStatus: "PAUSED",
            toStatus: "NOT_STARTED",
            reference: application.reference,
          },
        });

        return {
          success: true as const,
          reference: application.reference,
          childName: application.childName,
          assignedToId: application.assignedToId,
        };
      }
    );

    if (!result.success) return result;

    // Notify the assigned assessor that the applicant has responded.
    // Non-blocking: failures (or no assigned assessor) must not break the
    // applicant's response flow. Routes through sendEmail, so the #12
    // per-template enable/disable toggle governs whether it actually sends.
    if (result.assignedToId) {
      try {
        const assessor = await withAdminContext((tx) =>
          tx.profile.findUnique({
            where: { id: result.assignedToId as string },
            select: { email: true, firstName: true, lastName: true },
          })
        );

        if (assessor?.email) {
          const assessorName =
            `${assessor.firstName ?? ""} ${assessor.lastName ?? ""}`.trim() ||
            "Assessor";
          const emailResult = await sendEmail(
            assessor.email,
            "MISSING_DOCS_RESPONDED",
            {
              assessor_name: assessorName,
              child_name: result.childName,
              reference: result.reference,
              application_link: `${getAppUrl()}/applications/${applicationId}`,
            }
          );
          if (!emailResult.success) {
            console.warn(
              `[portal/actions] MISSING_DOCS_RESPONDED email failed for ${applicationId}: ${emailResult.error}`
            );
          }
        } else {
          console.warn(
            `[portal/actions] MISSING_DOCS_RESPONDED: assigned assessor ${result.assignedToId} has no email; skipping notification for ${applicationId}`
          );
        }
      } catch (emailErr) {
        console.warn(
          `[portal/actions] MISSING_DOCS_RESPONDED email error for ${applicationId}:`,
          emailErr
        );
      }
    }

    revalidatePath("/respond");
    revalidatePath("/status");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("[portal/actions] submitMissingDocsResponse error:", err);
    return {
      success: false,
      error: "Failed to send your response. Please try again.",
    };
  }
}
