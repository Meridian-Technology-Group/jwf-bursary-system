/**
 * Second parent's deadline.
 *
 * 26 Nov 2026 (Charlotte, Option 1): the second parent works to their OWN
 * deadline, independent of the first parent — staff often learn they need the
 * second parent's documents well after the lead has finished. It defaults to 7
 * days from the second-parent link being sent (end of that London day) and an
 * ADMIN can move it on the application page.
 *
 * Before this (21 Nov) they worked to the APPLICATION's effective deadline, so
 * one added late was locked out on arrival. A SECONDARY row with no own
 * deadline (none should exist after the backfill migration) still falls back
 * to the application's.
 *
 * Read under admin context: the caller is already proven to be this
 * contributor (session-resolved), and the round's deadline columns must be
 * readable whatever the applicant RLS allows.
 */

import { withAdminContext } from "@/lib/db/prisma";
import {
  DEADLINE_ROUND_SELECT,
  isSubmissionDeadlinePassed,
  type SubmissionDeadlineApplication,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";
import { defaultSubmitByValue, endOfLondonDay } from "@/lib/invitations/submit-by";

/** The deadline a newly invited second parent gets: 7 days on, end of that London day. */
export function defaultSecondParentDeadline(now: Date = new Date()): Date {
  return endOfLondonDay(defaultSubmitByValue("NEW", now));
}

/** Pure: own deadline when set, else the application's effective deadline. */
export function isSecondParentDeadlinePassed(
  ownDeadline: Date | null,
  application: SubmissionDeadlineApplication,
  round: SubmissionDeadlineRound,
  now: Date = new Date()
): boolean {
  return ownDeadline
    ? now.getTime() > ownDeadline.getTime()
    : isSubmissionDeadlinePassed(application, round, now);
}

export async function secondParentDeadlinePassed(
  contributorId: string,
  now: Date = new Date()
): Promise<boolean> {
  const contributor = await withAdminContext((tx) =>
    tx.applicationContributor.findUnique({
      where: { id: contributorId },
      select: {
        submissionDeadlineAt: true,
        application: {
          select: {
            submissionDeadlineAt: true,
            applicationType: true,
            round: { select: DEADLINE_ROUND_SELECT },
          },
        },
      },
    })
  );
  if (!contributor) return false;
  return isSecondParentDeadlinePassed(
    contributor.submissionDeadlineAt,
    contributor.application,
    contributor.application.round,
    now
  );
}
