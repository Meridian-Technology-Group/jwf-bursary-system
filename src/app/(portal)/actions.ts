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
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/roles";
import {
  getLatestAcceptedInvitationForUser,
  markInvitationAccepted,
} from "@/lib/db/queries/invitations";
import { generateApplicationReference } from "@/lib/applications/reference";
import { createReassessmentApplicationFromInvitation } from "@/lib/db/queries/reassessment";
import { createAuditLog } from "@/lib/audit/log";

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
    const validation = await withUserContext(
      user.id,
      user.role as RlsRole,
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

        const existing = await tx.application.findFirst({
          where: { leadApplicantId: user.id },
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

          const reference = await generateApplicationReference(tx, school, round.academicYear);

          await tx.application.create({
            data: {
              reference,
              roundId: invitation.roundId,
              leadApplicantId: user.id,
              school,
              childName: childName.trim(),
              isReassessment: false,
              status: "PRE_SUBMISSION",
            },
          });
        }

        return { error: null };
      }
    );

    if (validation.error) {
      return { success: false, error: validation.error };
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
        action: "ACCEPT_INVITATION",
        entityType: "Invitation",
        entityId: invitation.id,
        context: `Re-assessment invitation accepted by ${invitation.email}`,
        metadata: {
          email: invitation.email,
          roundId: invitation.roundId,
          bursaryAccountId: invitation.bursaryAccountId,
          applicationId,
        },
      });

      return { error: null };
    });

    if (result.error) {
      return { success: false, error: result.error };
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
