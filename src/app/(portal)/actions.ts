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
import { Role } from "@prisma/client";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/roles";
import { getLatestAcceptedInvitationForUser } from "@/lib/db/queries/invitations";
import { generateApplicationReference } from "@/lib/applications/reference";

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
