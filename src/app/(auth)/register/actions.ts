"use server";

/**
 * Server actions for the applicant invitation registration flow.
 *
 * These are public, pre-auth actions — they do NOT use requireRole().
 * The single-use token in the URL is the only authorization credential.
 *
 * Mirrors `src/app/(auth)/register/staff/actions.ts` exactly. Operates on
 * the `invitations` (applicant) table rather than `staff_invitations`.
 *
 * `createProfileAction` is retained for the parallel Supabase magic-link
 * branch driven by `?token_hash=…` on the registration page.
 */

import { InvitationStatus, type Role, type School } from "@prisma/client";
import { withAdminContext } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { createProfile } from "@/lib/auth/create-profile";
import {
  getInvitationByToken,
  markInvitationAccepted,
} from "@/lib/db/queries/invitations";
import { generateApplicationReference } from "@/lib/applications/reference";
import { createReassessmentApplicationFromInvitation } from "@/lib/db/queries/reassessment";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import { createAuditLog } from "@/lib/audit/log";

// ---------------------------------------------------------------------------
// createProfileAction — server-action wrapper for the magic-link flow
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
 * Client Components (`?token_hash=…` magic-link registration). The user has
 * just signed up via Supabase Auth but does not yet have a JWT context for
 * RLS — so we use withAdminContext to bypass RLS for this single insert.
 */
export async function createProfileAction(
  input: CreateProfileActionInput
): Promise<CreateProfileActionResult> {
  const result = await withAdminContext((tx) => createProfile(tx, input));
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

// ---------------------------------------------------------------------------
// validateApplicantInvitationAction
// ---------------------------------------------------------------------------

export type ValidateApplicantInvitationResult =
  | {
      success: true;
      email: string;
      firstName: string | null;
      lastName: string | null;
      applicantName: string | null;
      childName: string | null;
      school: School | null;
      roundId: string | null;
      /**
       * True when this is a re-assessment invite (links to an existing
       * BursaryAccount). The holder already has an account, so the page
       * routes them to sign in rather than rendering the create-account form.
       */
      isReassessment: boolean;
      /** New round's academic year, for the re-assessment "welcome back" copy. */
      academicYear: string | null;
    }
  | { success: false; error: string };

/**
 * Validates an applicant invitation token and returns the safe public fields
 * needed to render the registration form. Returns an error if the token is
 * unknown, already used, or expired.
 *
 * Mirrors `validateStaffInvitationAction`.
 */
export async function validateApplicantInvitationAction(
  token: string
): Promise<ValidateApplicantInvitationResult> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid invitation token." };
  }

  try {
    const invitation = await withAdminContext((tx) =>
      getInvitationByToken(tx, token)
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

    const isReassessment = !!invitation.bursaryAccountId;
    let academicYear: string | null = null;
    if (invitation.roundId) {
      const round = await withAdminContext((tx) =>
        tx.round.findUnique({
          where: { id: invitation.roundId! },
          select: { academicYear: true },
        })
      );
      academicYear = round?.academicYear ?? null;
    }

    return {
      success: true,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      applicantName: invitation.applicantName,
      childName: invitation.childName,
      school: invitation.school,
      roundId: invitation.roundId,
      isReassessment,
      academicYear,
    };
  } catch (err) {
    console.error(
      "[register] validateApplicantInvitationAction error:",
      err
    );
    return { success: false, error: "Failed to validate invitation." };
  }
}

// ---------------------------------------------------------------------------
// acceptApplicantInvitationAction
// ---------------------------------------------------------------------------

export interface AcceptApplicantInvitationInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

export type AcceptApplicantInvitationResult =
  | { success: true; email: string }
  | { success: false; error: string };

/**
 * Completes the applicant registration:
 *
 *   1. Re-validates the token (PENDING + unexpired).
 *   2. Validates password strength (12-char min + HIBP; fails open on
 *      network errors).
 *   3. Sets the password on the existing Supabase auth user via
 *      `updateUserById(invitation.authUserId, …)` — no `listUsers()` paged
 *      scan.
 *   4. In one withAdminContext tx:
 *        - Updates the Profile firstName / lastName.
 *        - If the invitation carries school + childName + roundId, creates
 *          the matching Application row.
 *        - Marks the Invitation ACCEPTED.
 *        - Writes the ACCEPT_INVITATION audit log.
 *
 * The caller is responsible for calling `signInWithPassword` client-side
 * after this action returns success.
 */
export async function acceptApplicantInvitationAction(
  input: AcceptApplicantInvitationInput
): Promise<AcceptApplicantInvitationResult> {
  const { token, firstName, lastName, password } = input;

  if (!token || typeof token !== "string") {
    return { success: false, error: "Invalid invitation token." };
  }

  // 1. Re-validate the token under admin context.
  const invitation = await withAdminContext((tx) =>
    getInvitationByToken(tx, token)
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
    return { success: false, error: "This invitation has expired." };
  }

  if (!invitation.authUserId) {
    // Legacy invitation created before PR2 — without a captured authUserId
    // we cannot deterministically attach a password. Bursary office must
    // resend from /invitations to provision a fresh auth user.
    console.error(
      "[register] acceptApplicantInvitationAction: invitation missing authUserId",
      invitation.id
    );
    return {
      success: false,
      error:
        "This invitation is from before the new invitation flow was deployed. Please ask the bursary office to resend it.",
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
        "[register] acceptApplicantInvitationAction updateUserById error:",
        updateError
      );
      return {
        success: false,
        error: "Failed to set password. Please try again.",
      };
    }

    // 4. Profile update + optional Application + markInvitationAccepted + audit log.
    await withAdminContext(async (tx) => {
      await tx.profile.update({
        where: { id: invitation.authUserId! },
        data: {
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        },
      });

      // Application row.
      //
      // Re-assessment invite (bursaryAccountId set): create a fully
      // prepopulated re-assessment application via the shared helper so it
      // carries the previous year's personal sections and blank financials.
      //
      // First-year invite: create a plain PRE_SUBMISSION application — but
      // only when the invitation carries school + childName + roundId.
      // Otherwise the applicant completes onboarding via the portal card.
      if (invitation.bursaryAccountId && invitation.roundId) {
        await createReassessmentApplicationFromInvitation(tx, invitation);
      } else if (
        invitation.school &&
        invitation.childName &&
        invitation.roundId
      ) {
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
            leadApplicantId: invitation.authUserId!,
            school: invitation.school,
            childName: invitation.childName,
            isReassessment: false,
            status: "PRE_SUBMISSION",
          },
        });
      }

      await markInvitationAccepted(tx, invitation.id, invitation.authUserId!);

      await createAuditLog(tx, {
        userId: invitation.authUserId!,
        action: "ACCEPT_INVITATION",
        entityType: "Invitation",
        entityId: invitation.id,
        context: `Applicant invitation accepted by ${invitation.email}`,
        metadata: {
          email: invitation.email,
          roundId: invitation.roundId,
          bursaryAccountId: invitation.bursaryAccountId,
        },
      });
    });

    return { success: true, email: invitation.email };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Registration failed.";
    console.error(
      "[register] acceptApplicantInvitationAction error:",
      err
    );
    return { success: false, error: message };
  }
}
