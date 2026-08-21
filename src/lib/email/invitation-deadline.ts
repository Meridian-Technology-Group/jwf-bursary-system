// src/lib/email/invitation-deadline.ts
// The two date merge fields every invitation-style email needs (Epic 13, E1).
//
// Pure functions only — no DB, no "use server" — so the invitation actions, the
// contact-register invite and the internal-request flow can all share one
// implementation, and it can be unit-tested without a database.
//
// ── The bug this exists to fix (CF-11 / CF-12) ────────────────────────────────
// Every invitation email injected the invitation TOKEN EXPIRY (now + 30 days)
// as `{{deadline}}`. The templates read that field as the deadline for
// SUBMITTING the application ("the deadline for submitting your completed
// application is {{deadline}}"), so recipients were told a date that had
// nothing to do with the round — it moved with the send date, and a resend
// silently pushed it 30 days further out.
//
// Two different dates were being conflated, so they now get two fields:
//
//   {{deadline}}     — the effective SUBMISSION deadline for the application
//                      this invitation leads to, resolved through the ONE
//                      helper (`effectiveSubmissionDeadline`, tiers 2–3 when no
//                      application row exists yet) and therefore type-aware:
//                      a rolling-over re-assessment gets the round's rolling
//                      date, a new applicant the round's NEW date.
//   {{link_expiry}}  — when the single-use registration LINK stops working.
//                      Still genuinely needed (the link really does die), which
//                      is exactly why it must not be smuggled into
//                      `{{deadline}}`.

import {
  effectiveSubmissionDeadline,
  type SubmissionDeadlineApplicationType,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";

/**
 * Shown when an invitation has no round attached, so no submission deadline can
 * be derived. `Invitation.roundId` is nullable and the resend path reads the
 * stored row, so this is reachable. Honest and readable in situ ("the deadline
 * for submitting your completed application is to be confirmed") — deliberately
 * NOT a silent fallback to the link expiry, which is the bug being fixed.
 */
export const DEADLINE_UNKNOWN = "to be confirmed";

/** How every date in an invitation email is rendered (matches existing sends). */
export function formatEmailDate(date: Date): string {
  return date.toLocaleDateString("en-GB");
}

export interface InvitationDeadlineFields {
  /** The effective SUBMISSION deadline, or `DEADLINE_UNKNOWN`. */
  deadline: string;
  /** When the single-use registration link stops working. */
  link_expiry: string;
}

/**
 * Builds the `{{deadline}}` + `{{link_expiry}}` merge fields for one
 * invitation-style send.
 *
 * @param round          the round this invitation is for, with `closeDate` and
 *                       both typed defaults; null when the invitation carries
 *                       no round
 * @param applicationType which round default applies — `ROLLING_OVER` for
 *                       re-assessment invitations, `NEW` otherwise
 * @param expiresAt      the invitation token's expiry instant
 * @param submissionDeadlineAt the application's own override, when the
 *                       invitation is attached to an existing application
 *                       (second-parent invites); null/omitted otherwise
 */
export function invitationDeadlineFields(
  round: SubmissionDeadlineRound | null,
  applicationType: SubmissionDeadlineApplicationType,
  expiresAt: Date,
  submissionDeadlineAt: Date | null = null
): InvitationDeadlineFields {
  const link_expiry = formatEmailDate(expiresAt);
  if (!round) {
    return { deadline: DEADLINE_UNKNOWN, link_expiry };
  }
  const { deadline } = effectiveSubmissionDeadline(
    { submissionDeadlineAt, applicationType },
    round
  );
  return { deadline: formatEmailDate(deadline), link_expiry };
}

/**
 * The `select` every caller needs on `round` to satisfy
 * `SubmissionDeadlineRound`. Kept here so a new invitation path cannot forget a
 * column and silently fall through to the close date.
 */
export const INVITATION_ROUND_DEADLINE_SELECT = {
  closeDate: true,
  defaultSubmissionDeadlineNew: true,
  defaultSubmissionDeadlineRolling: true,
} as const;
