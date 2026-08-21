/**
 * lifecycle-state.ts — Epic 15 W1 (CH-05, LA15-1/2): Charlotte's four-state
 * assessment lifecycle for the workspace header strip.
 *
 *   NOT STARTED → PAUSED → COMPLETE → LOCKED
 *
 * Her definitions map onto existing data — no schema change:
 *   NOT STARTED  no assessment row, or Assessment.status NOT_STARTED
 *   PAUSED       anything saved but not complete — her words: "as soon as at
 *                least one entry has been entered and saved". Covers BOTH
 *                IN_PROGRESS and the missing-docs PAUSED state.
 *   COMPLETE     Assessment.status COMPLETED, no outcome recorded
 *   LOCKED       outcome recorded (or application closed) — the existing
 *                reopen-blocked semantics ("the assessor has validated the
 *                complete assessment version as final")
 *
 * One vocabulary: this delegates to the queue's derivation and collapses its
 * finer IN_PROGRESS/PAUSED distinction. The queue keeps its own labels.
 *
 * Pure module — no DB, no React.
 */

import {
  deriveAssessmentQueueStatus,
  type AssessmentQueueStatusInput,
} from "./queue-status";

export type AssessmentLifecycleState =
  | "NOT_STARTED"
  | "PAUSED"
  | "COMPLETE"
  | "LOCKED";

export function deriveAssessmentLifecycleState(
  input: AssessmentQueueStatusInput
): AssessmentLifecycleState {
  switch (deriveAssessmentQueueStatus(input)) {
    case "LOCKED":
      return "LOCKED";
    case "COMPLETED":
      return "COMPLETE";
    case "PAUSED":
    case "IN_PROGRESS":
      return "PAUSED";
    default:
      return "NOT_STARTED";
  }
}

/** Charlotte's labels, verbatim (CH-05). */
export const ASSESSMENT_LIFECYCLE_LABELS: Record<
  AssessmentLifecycleState,
  string
> = {
  NOT_STARTED: "NOT STARTED",
  PAUSED: "PAUSED",
  COMPLETE: "COMPLETE",
  LOCKED: "LOCKED",
};

export const ASSESSMENT_LIFECYCLE_ORDER: readonly AssessmentLifecycleState[] = [
  "NOT_STARTED",
  "PAUSED",
  "COMPLETE",
  "LOCKED",
];
