/**
 * An invitation taken up after its submission date (Charlotte, 20 Nov 2026).
 *
 * A parent who first opens the form after the date their application would be
 * held to used to get an application that was locked from the moment it was
 * created. Charlotte chose to block instead: no application is created, the
 * parent is told to email the bursary team, and the assessor decides whether
 * to send a new invitation or treat the deadline as missed.
 *
 * "Passed" is exactly the portal lockout's rule (`isSubmissionDeadlinePassed`)
 * applied to the application the invitation WOULD create: the invitation's
 * "Submit by" date, else the round default for its type, else (rolling over)
 * the RA window, else the round close. So the block fires precisely when the
 * new application would otherwise be born locked.
 *
 * Secondary-parent invitations (`applicationId` set) join an application that
 * already exists, so they are never blocked here.
 */

import { InvitationStatus, type Invitation } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { BURSARIES_CONTACT_EMAIL } from "@/lib/portal/guidance-content";
import {
  DEADLINE_ROUND_SELECT,
  isSubmissionDeadlinePassed,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";

/** Charlotte's wording, 20 Nov 2026. */
export const SUBMIT_BY_PASSED_LINES = [
  "You are trying to access the application form for the first time, but the submission date has already passed. We had emailed you over a week ago about it.",
  `Please email our bursary department at ${BURSARIES_CONTACT_EMAIL} to notify the team so that they can inform you of the next steps.`,
] as const;

/** One-string form, for the parent-side error boxes that render plain text. */
export const SUBMIT_BY_PASSED_MESSAGE = SUBMIT_BY_PASSED_LINES.join(" ");

/**
 * Thrown by the application-create helpers so every parent path refuses in
 * one place; the surrounding transaction rolls back (no application, the
 * invitation is not marked accepted, no audit row).
 */
export class SubmitByPassedError extends Error {
  constructor() {
    super(SUBMIT_BY_PASSED_MESSAGE);
    this.name = "SubmitByPassedError";
  }
}

export type InvitationDeadlineFacts = Pick<
  Invitation,
  "submissionDeadlineAt" | "bursaryAccountId" | "applicationId"
>;

/** Pure: has the date the invitation's new application would carry passed? */
export function invitationSubmitByPassed(
  invitation: InvitationDeadlineFacts,
  round: SubmissionDeadlineRound | null,
  now: Date = new Date()
): boolean {
  if (invitation.applicationId || !round) return false;
  return isSubmissionDeadlinePassed(
    {
      submissionDeadlineAt: invitation.submissionDeadlineAt,
      applicationType: invitation.bursaryAccountId ? "ROLLING_OVER" : "NEW",
    },
    round,
    now
  );
}

/**
 * Pure: should the contact register show this invitation as "Expired"? Either
 * it was never taken up before its submission date, or it is already EXPIRED
 * (the 30-day link lapsed, or staff revoked it).
 */
export function isInvitationLapsed(
  invitation: InvitationDeadlineFacts & Pick<Invitation, "status">,
  round: SubmissionDeadlineRound | null,
  now: Date = new Date()
): boolean {
  if (invitation.status === InvitationStatus.EXPIRED) return true;
  return (
    invitation.status === InvitationStatus.PENDING &&
    invitationSubmitByPassed(invitation, round, now)
  );
}

/** Loads the round and applies `invitationSubmitByPassed`. */
export async function checkInvitationSubmitByPassed(
  tx: Tx,
  invitation: InvitationDeadlineFacts & Pick<Invitation, "roundId">,
  now: Date = new Date()
): Promise<boolean> {
  if (!invitation.roundId || invitation.applicationId) return false;
  const round = await tx.round.findUnique({
    where: { id: invitation.roundId },
    select: DEADLINE_ROUND_SELECT,
  });
  return invitationSubmitByPassed(invitation, round, now);
}
