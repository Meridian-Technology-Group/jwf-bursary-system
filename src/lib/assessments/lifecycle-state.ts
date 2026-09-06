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
  /** Legacy lock: an old 3-value outcome recorded, or the application closed. */
  | "LOCKED"
  // Epic 18 (WP-B3..B5) — the post-assessment final states, each its own
  // strip label. All render in the strip's fourth (final) slot.
  | "NEW_AWARD"
  | "ROLLED_OVER"
  | "WAITING_LIST"
  | "ARCHIVED";

export function deriveAssessmentLifecycleState(
  input: AssessmentQueueStatusInput
): AssessmentLifecycleState {
  // Epic 18 — the specific final state wins over the queue's coarse LOCKED,
  // so the strip can say WHICH final the assessment reached.
  switch (input.assessmentStatus) {
    case "NEW_AWARD":
      return "NEW_AWARD";
    case "ROLLED_OVER":
      return "ROLLED_OVER";
    case "WAITING_LIST":
      return "WAITING_LIST";
    case "CLOSED_ARCHIVED":
      return "ARCHIVED";
    default:
      break;
  }
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

/** Charlotte's labels (CH-05, relabelled per Epic 18 WP-B2 and B3..B5). */
export const ASSESSMENT_LIFECYCLE_LABELS: Record<
  AssessmentLifecycleState,
  string
> = {
  NOT_STARTED: "NOT STARTED",
  PAUSED: "PAUSED",
  // WP-B2 — her name for the intermediary stage; same state, new label.
  COMPLETE: "STORED AS COMPLETE",
  LOCKED: "LOCKED",
  NEW_AWARD: "NEW AWARD",
  // Epic 18b — her rolling-over lock; she asked for a short label.
  ROLLED_OVER: "ROLLED OVER",
  WAITING_LIST: "WAITING LIST",
  ARCHIVED: "CLOSED & ARCHIVED",
};

/**
 * The strip stays FOUR chips (CH-05's mock). The fourth slot is the final
 * stage: it shows the generic LOCKED until a specific Epic 18 final state is
 * reached, at which point it shows that state's own label.
 */
export const ASSESSMENT_LIFECYCLE_ORDER: readonly AssessmentLifecycleState[] = [
  "NOT_STARTED",
  "PAUSED",
  "COMPLETE",
  "LOCKED",
];

/** The states that occupy the strip's fourth (final) slot. */
const FINAL_SLOT_STATES: readonly AssessmentLifecycleState[] = [
  "LOCKED",
  "NEW_AWARD",
  "ROLLED_OVER",
  "WAITING_LIST",
  "ARCHIVED",
];

export interface LifecycleStripSlot {
  key: AssessmentLifecycleState;
  label: string;
  current: boolean;
}

/**
 * The four chips the strip renders for a given state. Pure, so the
 * final-slot substitution (LOCKED → the specific Epic 18 state) is
 * unit-testable without React.
 */
export function lifecycleStripSlots(
  state: AssessmentLifecycleState
): LifecycleStripSlot[] {
  const finalSlotState = FINAL_SLOT_STATES.includes(state) ? state : "LOCKED";
  return ASSESSMENT_LIFECYCLE_ORDER.map((slot) => {
    const key = slot === "LOCKED" ? finalSlotState : slot;
    return {
      key,
      label: ASSESSMENT_LIFECYCLE_LABELS[key],
      current: key === state,
    };
  });
}
