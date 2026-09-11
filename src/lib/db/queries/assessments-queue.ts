/**
 * assessments-queue.ts — Epic 14 C1 (CG-17): rows for the Assessments list.
 *
 * A dedicated ASSESSMENT-centric queue, separate from the applications queue:
 * every SUBMITTED application is an assessment to be worked, whether or not an
 * `Assessment` row exists yet (no row = "due / not started"). No schema
 * change — the status is derived (`deriveAssessmentQueueStatus`).
 *
 * Role scoping: ASSESSORs see only applications assigned to them (mirrors the
 * guard in `applications/[id]/layout.tsx`); ADMIN/VIEWER see all.
 */

import type { School, BursaryAccountStatus } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import {
  deriveAssessmentQueueStatus,
  type AssessmentQueueStatus,
} from "@/lib/assessments/queue-status";

export interface AssessmentQueueRow {
  applicationId: string;
  reference: string;
  childName: string;
  school: School;
  academicYear: string | null;
  status: AssessmentQueueStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  submittedAt: Date | null;
  /** When assessment work last moved (assessment update), for sorting. */
  updatedAt: Date | null;
  /**
   * Charlotte, 8 Sep 2026: *"we need a status for the bursary account: ACTIVE
   * or CLOSED. So the bursary is active and within an active bursary, you will
   * have assessment statuses which evolve."* The account's own status, distinct
   * from the derived assessment status above.
   *
   * The bursary ACCOUNT's own status, or `null` when the application has no
   * account.
   *
   * Charlotte, 10 Sep 2026, correcting her own earlier Levi Amoah example:
   * *"if closed before becoming a bursary account, it will never have a closed
   * bursary account status, but a closed and archived status with no
   * corresponding account, I agree."* So an archived assessment with no account
   * reads "No account" here, and the closed-and-archived meaning is carried by
   * the assessment status column beside it.
   *
   * An earlier version of this derived CLOSED from a CLOSED_ARCHIVED
   * assessment, to match her first description of Levi. She has since
   * confirmed that was her thinking of the real family, who does have an
   * account, rather than the test record, which never had one.
   */
  bursaryStatus: BursaryAccountStatus | null;
}

export async function listAssessmentQueueRows(
  tx: Tx,
  opts: {
    /** Restrict to this assignee (the ASSESSOR guard, or the assignee filter). */
    assignedToId?: string;
  } = {}
): Promise<AssessmentQueueRow[]> {
  const rows = await tx.application.findMany({
    where: {
      formStatus: "SUBMITTED",
      ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}),
    },
    select: {
      id: true,
      reference: true,
      childName: true,
      school: true,
      submittedAt: true,
      closedAt: true,
      assignedToId: true,
      assignedTo: { select: { firstName: true, lastName: true, email: true } },
      round: { select: { academicYear: true } },
      bursaryAccount: { select: { status: true } },
      assessment: {
        select: { status: true, outcome: true, updatedAt: true },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  return rows.map((app) => ({
    applicationId: app.id,
    reference: app.reference,
    childName: app.childName,
    school: app.school,
    academicYear: app.round?.academicYear ?? null,
    status: deriveAssessmentQueueStatus({
      assessmentStatus: app.assessment?.status ?? null,
      outcome: app.assessment?.outcome ?? null,
      closedAt: app.closedAt,
    }),
    assigneeId: app.assignedToId,
    assigneeName: app.assignedTo
      ? [app.assignedTo.firstName, app.assignedTo.lastName]
          .filter(Boolean)
          .join(" ") || app.assignedTo.email
      : null,
    submittedAt: app.submittedAt,
    updatedAt: app.assessment?.updatedAt ?? null,
    bursaryStatus: app.bursaryAccount?.status ?? null,
  }));
}
