/**
 * queue-status.ts — Epic 14 C1 (CG-17): the status column of the Assessments
 * queue.
 *
 * The queue lists every SUBMITTED application as an assessment to be worked:
 * one that has no `Assessment` row yet is simply "due / not started" (the
 * assessor hasn't begun), and one whose outcome is recorded (or whose
 * application is closed) is LOCKED — Epic 13 C1's reopen rule blocks any
 * further assessment work after the outcome, so the queue shows it as such
 * rather than merely "completed".
 *
 * Pure module — no DB, no React — so the derivation matrix is unit-testable.
 */

import type { AssessmentOutcome, AssessmentStatus } from "@prisma/client";

export type AssessmentQueueStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "LOCKED";

export interface AssessmentQueueStatusInput {
  /** `Assessment.status`, or null when no assessment row exists yet. */
  assessmentStatus: AssessmentStatus | null;
  /** `Assessment.outcome` — non-null locks the assessment (Epic 13 C1). */
  outcome: AssessmentOutcome | null;
  /** `Application.closedAt` — a closed application is locked too. */
  closedAt: Date | null;
}

export function deriveAssessmentQueueStatus(
  input: AssessmentQueueStatusInput
): AssessmentQueueStatus {
  if (input.outcome != null || input.closedAt != null) return "LOCKED";
  switch (input.assessmentStatus) {
    case "COMPLETED":
      return "COMPLETED";
    case "PAUSED":
      return "PAUSED";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    default:
      return "NOT_STARTED";
  }
}

/** Display labels — user-facing "Assessment" terminology (CG-17). */
export const ASSESSMENT_QUEUE_STATUS_LABELS: Record<
  AssessmentQueueStatus,
  string
> = {
  NOT_STARTED: "Due — not started",
  IN_PROGRESS: "In progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  LOCKED: "Locked — outcome recorded",
};

export const ALL_ASSESSMENT_QUEUE_STATUSES: readonly AssessmentQueueStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "LOCKED",
];
