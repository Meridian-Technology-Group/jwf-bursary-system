"use server";

/**
 * Send an invitation FROM a contact (Epic 04, PR-3 of the plan).
 *
 * The headline path: an administrator opens a contact, picks an OPEN round, and
 * sends a parent invite seeded entirely from the contact's stored data. The
 * school + entry-year are carried onto the invitation and are LOCKED (D1): on
 * accept the shared `createFirstYearApplicationFromSource` helper stamps them
 * onto the application and the parent can never change them.
 *
 * Reuses the exact hardening of `createInvitationAction`:
 *   1. assert the contact carries the required locked set;
 *   2. create the Supabase auth user up front (email_confirm suppresses OTP);
 *   3. in one withAdminContext tx — upsert Profile, bind Contact.profileId,
 *      create the Invitation (contactId + entryYear carried), audit log;
 *   4. roll back the auth user on any failure;
 *   5. send the branded INVITATION email inside the rollback boundary.
 */

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { RoundStatus } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { withAdminContext } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { provisionApplicantAuthUser } from "@/lib/auth/provision-applicant";
import { createProfile } from "@/lib/auth/create-profile";
import { createInvitation } from "@/lib/db/queries/invitations";
import { getAppUrl } from "@/lib/app-url";
import {
  deadlineTypeForSituation,
  openingDateMergeField,
  resolveInvitationTemplate,
} from "@/lib/email/invitation-template";
import {
  invitationDeadlineFields,
  INVITATION_ROUND_DEADLINE_SELECT,
} from "@/lib/email/invitation-deadline";
import type { SubmissionDeadlineRound } from "@/lib/rounds/submission-deadline";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  contactDisplayName,
  missingRequiredInviteFields,
  schoolLabel,
} from "@/lib/contacts/contact-helpers";

export interface InviteFromContactResult {
  success: boolean;
  error?: string;
}

export async function sendInvitationFromContactAction(
  contactId: string,
  roundId: string
): Promise<InviteFromContactResult> {
  const user = await requireRole([Role.ADMIN]);

  if (!contactId || !roundId) {
    return { success: false, error: "A contact and an open round are required." };
  }

  // 1. Load the contact + validate round (must be OPEN — Epic 03 concurrent
  //    rounds; you invite into a live intake, never a DRAFT/CLOSED round).
  let contact: {
    id: string;
    firstName: string | null;
    lastName: string;
    email: string;
    childName: string;
    school: import("@prisma/client").School;
    entryYear: number;
    entryYearGroup: import("@prisma/client").EntryYearGroup | null;
    situation: import("@prisma/client").InvitationSituation | null;
    profileId: string | null;
  };
  let academicYear = "";
  // Round deadline columns for the invitation's {{deadline}} field (E1).
  let deadlineRound: SubmissionDeadlineRound | null = null;
  // B3 — feeds the rolling template's {{opening_date}}.
  let roundOpenDate: Date | null = null;
  try {
    const loaded = await withAdminContext(async (tx) => {
      const c = await tx.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          childName: true,
          school: true,
          entryYear: true,
          entryYearGroup: true,
          situation: true,
          profileId: true,
          archivedAt: true,
        },
      });
      if (!c) return { ok: false as const, error: "Contact not found." };
      if (c.archivedAt) {
        return { ok: false as const, error: "This contact has been archived." };
      }

      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          academicYear: true,
          status: true,
          openDate: true,
          ...INVITATION_ROUND_DEADLINE_SELECT,
        },
      });
      if (!round) return { ok: false as const, error: "Round not found." };
      if (round.status !== RoundStatus.OPEN) {
        return {
          ok: false as const,
          error: `Round ${round.academicYear} is ${round.status}; invitations can only target an OPEN round.`,
        };
      }

      return {
        ok: true as const,
        contact: c,
        academicYear: round.academicYear,
        roundOpenDate: round.openDate,
        deadlineRound: {
          closeDate: round.closeDate,
          defaultSubmissionDeadlineNew: round.defaultSubmissionDeadlineNew,
          defaultSubmissionDeadlineRolling:
            round.defaultSubmissionDeadlineRolling,
        },
      };
    });

    if (!loaded.ok) return { success: false, error: loaded.error };
    contact = loaded.contact;
    academicYear = loaded.academicYear;
    deadlineRound = loaded.deadlineRound;
    roundOpenDate = loaded.roundOpenDate;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load contact";
    console.error("[contacts] sendInvitationFromContactAction load error:", err);
    return { success: false, error: message };
  }

  // 2. Reject an incomplete contact rather than sending a half-formed invite (D1).
  const missing = missingRequiredInviteFields({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    childName: contact.childName,
    school: contact.school,
    entryYear: contact.entryYear,
    entryYearGroup: contact.entryYearGroup,
  });
  if (missing.length > 0) {
    return {
      success: false,
      error: `This contact is missing ${missing.join(", ")}. Complete the contact before inviting.`,
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const supabase = createSupabaseAdminClient();
  const appUrl = getAppUrl();
  const applicantName = contactDisplayName(contact);

  // 3. Provision the auth user up front. Epic 14 E1 (CG-04): a SECOND child
  //    contact shares the parent's email, so the provisioning helper reuses
  //    the existing APPLICANT profile/auth user (one login, many children) —
  //    creating fresh only for a genuinely new email.
  let authUserId: string;
  let createdAuthUser = false;
  if (contact.profileId) {
    authUserId = contact.profileId;
  } else {
    const provisioned = await provisionApplicantAuthUser(supabase, contact.email);
    if (!provisioned.ok) {
      console.error(
        "[contacts] sendInvitationFromContactAction provisioning error:",
        provisioned.error
      );
      return { success: false, error: provisioned.error };
    }
    authUserId = provisioned.authUserId;
    createdAuthUser = provisioned.created;
  }

  const rollbackAuthUser = async () => {
    if (!createdAuthUser) return;
    await supabase.auth.admin.deleteUser(authUserId).catch((err) => {
      console.error("[contacts] sendInvitationFromContactAction auth rollback failed:", err);
    });
  };

  // 4. Profile + Contact.profileId bind + Invitation (locked entry-year carried)
  //    + audit, one tx. Roll back the auth user on any failure.
  let invitationId: string;
  let invitationToken: string;
  try {
    const result = await withAdminContext(async (tx) => {
      const profile = await createProfile(tx, {
        id: authUserId,
        email: contact.email,
        role: Role.APPLICANT,
        firstName: contact.firstName ?? undefined,
        lastName: contact.lastName,
      });
      if (!profile.success) {
        return { success: false as const, error: profile.error };
      }

      // Bind the contact to the profile on first invite (idempotent).
      if (!contact.profileId) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { profileId: authUserId },
        });
      }

      const inv = await createInvitation(tx, {
        email: contact.email,
        firstName: contact.firstName ?? undefined,
        lastName: contact.lastName,
        childName: contact.childName,
        school: contact.school,
        entryYear: contact.entryYear,
        entryYearGroup: contact.entryYearGroup,
        roundId,
        contactId: contact.id,
        // B3 — the situation chosen when the contact was created; resends
        // then reuse it from the invitation row.
        situation: contact.situation,
        authUserId,
        createdBy: user.id,
        expiresAt,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.INVITE_FROM_CONTACT,
        entityType: AUDIT_ENTITY_TYPES.Invitation,
        entityId: inv.id,
        context: `Invited ${contact.email} from contact (${contact.childName})`,
        metadata: {
          contactId: contact.id,
          email: contact.email,
          roundId,
          school: contact.school,
          entryYear: contact.entryYear,
          authUserId,
        },
      });

      return { success: true as const, invitationId: inv.id, token: inv.token };
    });

    if (!result.success) {
      await rollbackAuthUser();
      return { success: false, error: result.error ?? "Failed to send invitation" };
    }
    invitationId = result.invitationId;
    invitationToken = result.token;
  } catch (err) {
    await rollbackAuthUser();
    const message = err instanceof Error ? err.message : "Failed to send invitation";
    console.error("[contacts] sendInvitationFromContactAction error:", err);
    return { success: false, error: message };
  }

  // 5. Send the branded INVITATION email inside the rollback boundary.
  // B3 (CG-26): the template follows the contact's situation × school;
  // legacy contacts (situation NULL) keep the generic INVITATION.
  const emailResult = await sendEmail(
    contact.email,
    resolveInvitationTemplate(contact.situation, contact.school),
    {
      applicant_name: applicantName,
      child_name: contact.childName,
      school: schoolLabel(contact.school),
      round_year: academicYear,
      registration_link: `${appUrl}/register?token=${invitationToken}`,
      opening_date: openingDateMergeField(
        roundOpenDate ? { openDate: roundOpenDate } : null
      ),
      // E1/CF-11: {{deadline}} is the round's SUBMISSION deadline (typed by
      // situation), not the 30-day token expiry — that now has its own
      // {{link_expiry}} field.
      ...invitationDeadlineFields(
        deadlineRound,
        deadlineTypeForSituation(contact.situation),
        expiresAt
      ),
    }
  );

  if (!emailResult.success) {
    console.error("[contacts] sendInvitationFromContactAction email error:", emailResult.error);

    await withAdminContext(async (tx) => {
      await tx.invitation.delete({ where: { id: invitationId } }).catch((err) => {
        console.error("[contacts] sendInvitationFromContactAction invitation rollback failed:", err);
      });
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.INVITE_FROM_CONTACT_FAILED,
        entityType: AUDIT_ENTITY_TYPES.Invitation,
        entityId: invitationId,
        context: `Invite from contact to ${contact.email} rolled back — email failed to send`,
        metadata: {
          contactId: contact.id,
          email: contact.email,
          roundId,
          emailError: emailResult.error ?? null,
        },
      });
    }).catch((err) => {
      console.error("[contacts] sendInvitationFromContactAction rollback tx failed:", err);
    });

    await rollbackAuthUser();

    revalidatePath("/contacts");
    return {
      success: false,
      error: `Email failed to send. The invitation was rolled back — please try again. (${emailResult.error})`,
    };
  }

  revalidatePath("/contacts");
  revalidatePath("/invitations");
  return { success: true };
}
