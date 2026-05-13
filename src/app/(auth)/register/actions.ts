"use server";

/**
 * Server actions for invitation-based registration (branded email flow).
 *
 * These are public, pre-auth actions — they do NOT use requireRole().
 * The invitationId in the URL serves as the authorization token.
 */

import { InvitationStatus, type Role } from "@prisma/client";
import { withAdminContext } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { createProfile } from "@/lib/auth/create-profile";
import { updateInvitationStatus } from "@/lib/db/queries/invitations";
import { generateApplicationReference } from "@/lib/applications/reference";
import { validatePasswordStrength } from "@/lib/auth/password-policy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidateInvitationResult =
  | {
      success: true;
      email: string;
      applicantName: string | null;
      childName: string | null;
      school: string | null;
    }
  | { success: false; error: string };

export type RegisterWithInvitationResult =
  | { success: true; email: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// createProfileAction — server-action wrapper for the token-based flow
// ---------------------------------------------------------------------------

export interface CreateProfileActionInput {
  id: string;
  email: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export type CreateProfileActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Server-action wrapper around createProfile() for invocation from
 * Client Components (token-based registration). The user has just signed up
 * via Supabase Auth but does not yet have a JWT context for RLS — so we use
 * withAdminContext to bypass RLS for this single insert.
 */
export async function createProfileAction(
  input: CreateProfileActionInput
): Promise<CreateProfileActionResult> {
  const result = await withAdminContext((tx) => createProfile(tx, input));
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

// ---------------------------------------------------------------------------
// validateInvitationAction
// ---------------------------------------------------------------------------

/**
 * Looks up an invitation by ID and returns safe public fields if it's valid.
 */
export async function validateInvitationAction(
  invitationId: string
): Promise<ValidateInvitationResult> {
  try {
    const invitation = await withAdminContext((tx) =>
      tx.invitation.findUnique({
        where: { id: invitationId },
      })
    );

    if (!invitation) {
      return { success: false, error: "Invitation not found." };
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return {
        success: false,
        error: "This invitation has already been used.",
      };
    }

    if (invitation.expiresAt < new Date()) {
      return {
        success: false,
        error:
          "This invitation has expired. Please contact your assessor for a new one.",
      };
    }

    return {
      success: true,
      email: invitation.email,
      applicantName: invitation.applicantName,
      childName: invitation.childName,
      school: invitation.school,
    };
  } catch (err) {
    console.error("[register] validateInvitationAction error:", err);
    return { success: false, error: "Failed to validate invitation." };
  }
}

// ---------------------------------------------------------------------------
// registerWithInvitationAction
// ---------------------------------------------------------------------------

/**
 * Registers a user via a branded invitation link.
 *
 * 1. Re-validates the invitation (PENDING + not expired)
 * 2. Finds or creates the Supabase auth user
 * 3. Sets password and confirms email
 * 4. Creates Profile row
 * 5. Marks invitation as ACCEPTED
 */
export async function registerWithInvitationAction(data: {
  invitationId: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<RegisterWithInvitationResult> {
  const { invitationId, firstName, lastName, password } = data;

  const strength = await validatePasswordStrength(password);
  if (!strength.ok) {
    return { success: false, error: strength.reason };
  }

  try {
    // 1. Re-validate the invitation
    const invitation = await withAdminContext((tx) =>
      tx.invitation.findUnique({
        where: { id: invitationId },
      })
    );

    if (!invitation) {
      return { success: false, error: "Invitation not found." };
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return {
        success: false,
        error: "This invitation has already been used.",
      };
    }

    if (invitation.expiresAt < new Date()) {
      return {
        success: false,
        error:
          "This invitation has expired. Please contact your assessor for a new one.",
      };
    }

    const email = invitation.email;
    const supabase = createSupabaseAdminClient();

    // 2. Find existing Supabase user (created by admin.createUser during invitation)
    const { data: listData, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("[register] listUsers error:", listError);
      return { success: false, error: "Failed to look up user account." };
    }

    const existingUser = listData.users.find((u) => u.email === email);
    let userId: string;

    if (existingUser) {
      // User exists (created during invitation) — update password + confirm email
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          email_confirm: true,
        }
      );

      if (updateError) {
        console.error("[register] updateUserById error:", updateError);
        return { success: false, error: "Failed to set up account." };
      }

      userId = existingUser.id;
    } else {
      // User doesn't exist — create with confirmed email
      const { data: createData, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createError || !createData.user) {
        console.error("[register] createUser error:", createError);
        return { success: false, error: "Failed to create account." };
      }

      userId = createData.user.id;
    }

    // 3-5. Create Profile row, mark invitation accepted, create application
    //      All under admin context (the new user does not yet have a JWT).
    const profileResult = await withAdminContext(async (tx) => {
      const result = await createProfile(tx, {
        id: userId,
        email,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      if (!result.success) return result;

      // Mark invitation as ACCEPTED
      await updateInvitationStatus(
        tx,
        invitationId,
        InvitationStatus.ACCEPTED,
        userId
      );

      // Create Application record if the invitation has the required data.
      // When any of school / childName / roundId are absent the applicant
      // completes onboarding via the portal dashboard card instead.
      if (invitation.school && invitation.childName && invitation.roundId) {
        const round = await tx.round.findUnique({
          where: { id: invitation.roundId },
          select: { academicYear: true },
        });
        const reference = await generateApplicationReference(
          tx,
          invitation.school,
          round?.academicYear ?? ""
        );

        await tx.application.create({
          data: {
            reference,
            roundId: invitation.roundId,
            leadApplicantId: userId,
            school: invitation.school,
            childName: invitation.childName,
            bursaryAccountId: invitation.bursaryAccountId ?? undefined,
            isReassessment: !!invitation.bursaryAccountId,
            status: "PRE_SUBMISSION",
          },
        });
      }

      return result;
    });

    if (!profileResult.success) {
      return { success: false, error: profileResult.error };
    }

    return { success: true, email };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Registration failed.";
    console.error("[register] registerWithInvitationAction error:", err);
    return { success: false, error: message };
  }
}
