/**
 * Second parent's deadline (Brian, 21 Nov 2026).
 *
 * A second parent works to the APPLICATION's effective submission deadline —
 * the date their invitation email already quotes ({{deadline}}). Before this,
 * nothing in their flow checked it. The lead normally submits first, so the
 * application's form status says nothing about the second parent; only the
 * date does. Staff extend it per family with the application's Submission
 * deadline card.
 *
 * Read under admin context: the caller is already proven to be this
 * application's SECONDARY contributor (session-resolved), and the round's
 * deadline columns must be readable whatever the applicant RLS allows.
 */

import { withAdminContext } from "@/lib/db/prisma";
import {
  DEADLINE_ROUND_SELECT,
  isSubmissionDeadlinePassed,
} from "@/lib/rounds/submission-deadline";

export async function applicationDeadlinePassed(
  applicationId: string,
  now: Date = new Date()
): Promise<boolean> {
  const application = await withAdminContext((tx) =>
    tx.application.findUnique({
      where: { id: applicationId },
      select: {
        submissionDeadlineAt: true,
        applicationType: true,
        round: { select: DEADLINE_ROUND_SELECT },
      },
    })
  );
  if (!application) return false;
  return isSubmissionDeadlinePassed(application, application.round, now);
}
