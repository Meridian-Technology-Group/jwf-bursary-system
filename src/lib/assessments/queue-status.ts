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
    // Epic 18 — the post-assessment final states are all LOCKED from the
    // queue's viewpoint: no assessment work remains. The workspace strip
    // (lifecycle-state.ts) keeps the finer per-state labels; the queue stays
    // coarse deliberately.
    case "NEW_AWARD":
    case "ROLLED_OVER":
    case "WAITING_LIST":
    case "CLOSED_ARCHIVED":
      return "LOCKED";
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
  // Epic 18 (WP-B2) — "stored as complete" is her name for this stage.
  COMPLETED: "Stored as complete",
  // Epic 18 — "outcome" is the legacy vocabulary; the lock now also covers
  // the post-assessment final states (new award / waiting list / archived).
  LOCKED: "Locked — decided",
};

export const ALL_ASSESSMENT_QUEUE_STATUSES: readonly AssessmentQueueStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "LOCKED",
];
