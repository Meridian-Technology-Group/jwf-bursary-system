"use server";

/**
 * Server actions for the staff invitation registration flow.
 *
 * These are public, pre-auth actions — they do NOT use requireRole().
 * The single-use token in the URL is the only authorization credential.
 *
 * Mirrors the applicant `register/actions.ts` shape (validate then accept)
 * but operates on `staff_invitations` rather than `invitations`.
 */

import { InvitationStatus, type Role } from "@prisma/client";
import { withAdminContext } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import {
  getStaffInvitationByToken,
  markStaffInvitationAccepted,
} from "@/lib/db/queries/staff-invitations";
import { createAuditLog } from "@/lib/audit/log";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidateStaffInvitationResult =
  | {
      success: true;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: Role;
    }
  | { success: false; error: string };

export type AcceptStaffInvitationResult =
  | { success: true; email: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// validateStaffInvitationAction
// ---------------------------------------------------------------------------

/**
 * Validates a staff invitation token and returns the safe public fields
 * needed to render the registration form. Returns an error if the token
 * is unknown, already used, or expired.
 */
export async function validateStaffInvitationAction(
  token: string
): Promise<ValidateStaffInvitationResult> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid invitation token." };
  }

  try {
    const invitation = await withAdminContext((tx) =>
      getStaffInvitationByToken(tx, token)
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
          "This invitation has expired. Please ask an administrator to send a new one.",
      };
    }

    return {
      success: true,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      role: invitation.role,
    };
  } catch (err) {
    console.error(
      "[register/staff] validateStaffInvitationAction error:",
      err
    );
    return { success: false, error: "Failed to validate invitation." };
  }
}

// ---------------------------------------------------------------------------
// acceptStaffInvitationAction
// ---------------------------------------------------------------------------

export interface AcceptStaffInvitationInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

/**
 * Completes the staff registration:
 * 1. Re-validates the token (PENDING + unexpired).
 * 2. Validates password strength (12-char min + HIBP; fails open on network).
 * 3. Sets the password on the existing Supabase auth user.
 * 4. Updates the Profile firstName / lastName.
 * 5. Marks the StaffInvitation ACCEPTED.
 * 6. Writes an audit row.
 *
 * The caller is responsible for calling supabase.auth.signInWithPassword
 * client-side after this action returns success.
 */
export async function acceptStaffInvitationAction(
  input: AcceptStaffInvitationInput
): Promise<AcceptStaffInvitationResult> {
  const { token, firstName, lastName, password } = input;

  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid invitation token." };
  }

  // 1. Re-validate the token under admin context.
  const invitation = await withAdminContext((tx) =>
    getStaffInvitationByToken(tx, token)
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
      error: "This invitation has expired.",
    };
  }

  // 2. Password policy. validatePasswordStrength fails open on HIBP network errors.
  const strength = await validatePasswordStrength(password);
  if (!strength.ok) {
    return { success: false, error: strength.reason };
  }

  try {
    // 3. Set the chosen password on the existing Supabase auth user.
    const supabase = createSupabaseAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      invitation.authUserId,
      {
        password,
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error(
        "[register/staff] updateUserById error:",
        updateError
      );
      return {
        success: false,
        error: "Failed to set password. Please try again.",
      };
    }

    // 4-6. Update Profile, mark invitation accepted, write audit log.
    await withAdminContext(async (tx) => {
      await tx.profile.update({
        where: { id: invitation.authUserId },
        data: {
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        },
      });

      await markStaffInvitationAccepted(tx, invitation.id);

      await createAuditLog(tx, {
        userId: invitation.authUserId,
        action: "ACCEPT_STAFF_INVITATION",
        entityType: "StaffInvitation",
        entityId: invitation.id,
        context: `Staff invitation accepted by ${invitation.email}`,
        metadata: { email: invitation.email, role: invitation.role },
      });
    });

    return { success: true, email: invitation.email };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Registration failed.";
    console.error(
      "[register/staff] acceptStaffInvitationAction error:",
      err
    );
    return { success: false, error: message };
  }
}
