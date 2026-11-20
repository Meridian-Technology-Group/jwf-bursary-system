/**
 * send-invitation.ts — the parts of a parent-invitation send that every
 * invite path shares (audit finding 19).
 *
 * Used by `createInvitationAction` (quick invite),
 * `sendInvitationFromContactAction` (invite from a contact) and
 * `sendReassessmentInviteForHolder` (re-assessment batch). Each caller keeps
 * its own validation, provisioning, invitation row, audit entry and login
 * rollback, because those genuinely differ; what lives here is what used to be
 * copied verbatim and had already drifted once (#516):
 *
 *   - the merge fields every invitation email carries;
 *   - undoing an invitation whose email failed to send: delete the row and
 *     write the `*_FAILED` audit entry, in one admin transaction whose failure
 *     is logged, never thrown.
 *
 * Removing a login the call created stays with the caller: each one already
 * does it for its earlier failure paths, and only the caller knows whether it
 * created the login.
 */

import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ENTITY_TYPES, type AuditAction } from "@/lib/audit/actions";
import { invitationDeadlineFields } from "@/lib/email/invitation-deadline";
import type { EmailMergeData } from "@/lib/email/types";
import { emailDeadlineOverride } from "@/lib/invitations/submit-by";
import type {
  SubmissionDeadlineApplicationType,
  SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";

/**
 * The merge fields shared by every invitation email. First-year invitations
 * add `opening_date` on top; the re-assessment email has none, so it is not
 * part of this set.
 *
 * {{deadline}} is the SUBMISSION deadline (E1/CF-11): the invitation's own
 * "Submit by" date when set (licence fix, 14 Oct 2026), otherwise the round's
 * default for `deadlineType`. {{link_expiry}} carries the token expiry.
 */
export function invitationEmailMergeData(input: {
  applicantName: string;
  childName: string;
  /** Display label, already resolved by the caller. */
  school: string;
  roundYear: string;
  registrationLink: string;
  deadlineRound: SubmissionDeadlineRound | null;
  deadlineType: SubmissionDeadlineApplicationType;
  expiresAt: Date;
  submitBy: Date | null;
}): EmailMergeData {
  return {
    applicant_name: input.applicantName,
    child_name: input.childName,
    school: input.school,
    round_year: input.roundYear,
    registration_link: input.registrationLink,
    ...invitationDeadlineFields(
      input.deadlineRound,
      input.deadlineType,
      input.expiresAt,
      emailDeadlineOverride(input.submitBy)
    ),
  };
}

/**
 * Undo an invitation whose email failed to send: delete the row (a PENDING
 * row whose link never reached the parent looks valid and blocks a re-send)
 * and record the failure so the attempt stays visible. Never throws.
 */
export async function rollBackUnsentInvitation(input: {
  invitationId: string;
  audit: {
    userId: string;
    action: AuditAction;
    context: string;
    metadata: Record<string, unknown>;
  };
  /** Builds the console label for a failed rollback step. */
  logLabel: (step: "invitation rollback" | "rollback tx") => string;
}): Promise<void> {
  const { invitationId, audit, logLabel } = input;
  await withAdminContext(async (tx) => {
    await tx.invitation.delete({ where: { id: invitationId } }).catch((err) => {
      console.error(logLabel("invitation rollback"), err);
    });
    await createAuditLog(tx, {
      userId: audit.userId,
      action: audit.action,
      entityType: AUDIT_ENTITY_TYPES.Invitation,
      entityId: invitationId,
      context: audit.context,
      metadata: audit.metadata,
    });
  }).catch((err) => {
    console.error(logLabel("rollback tx"), err);
  });
}
