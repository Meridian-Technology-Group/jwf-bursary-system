/**
 * Shared review-phase label map (Item 1.1).
 *
 * Single source of truth for how a `ReviewPhase` reads in the UI. Two
 * divergent copies used to exist — `STATUS_LABEL` in
 * `application-actions.tsx` (detail page) and `STATUS_LABELS` in
 * `queue/page.tsx` (list) — this module replaces both, so the list and detail
 * page always agree (1.1's AC).
 *
 * Flow-map vocabulary (D-3): the official state map has no qualify / does-not-
 * qualify concept, so the legacy outcome-derived phases are NOT surfaced under
 * those names. They render in state-map terms instead, converging with the
 * real `CLOSED` phase Track A is adding:
 *   QUALIFIES        (account activated) → "Active"
 *   DOES_NOT_QUALIFY                     → "Closed"
 *
 * Zero server-only imports (only the `ReviewPhase` type, erased at compile
 * time) — safe to import from both server and client components.
 */

import { ALL_REVIEW_PHASES, type ReviewPhase } from "@/lib/applications/queue-filter";

export const REVIEW_PHASE_LABEL: Record<ReviewPhase, string> = {
  PRE_SUBMISSION: "Pre-submission",
  SUBMITTED: "Awaiting review",
  NOT_STARTED: "Review in progress",
  PAUSED: "Paused — awaiting documents",
  COMPLETED: "Assessment complete",
  QUALIFIES: "Active",
  DOES_NOT_QUALIFY: "Closed",
  // Item 2's real unified terminal state — converges with the legacy
  // DOES_NOT_QUALIFY wording above, per the flow-map vocabulary.
  CLOSED: "Closed",
};

/**
 * The status filter's options, deduplicated by LABEL.
 *
 * Charlotte, 10 Sep 2026: *"Do you know why closed shows twice on the status
 * dropdown list?"* Because `DOES_NOT_QUALIFY` and `CLOSED` are two distinct
 * review phases that deliberately converge on the same word (see the module
 * note above), and the dropdown rendered one entry per phase.
 *
 * They cannot simply be merged in the type: `DOES_NOT_QUALIFY` is still
 * carried by historic assessments (6 of them on nonprod at the time of
 * writing), so dropping it would make those rows unfilterable. Instead one
 * option is offered per distinct label, carrying every phase that shares it —
 * picking "Closed" matches both.
 *
 * Order follows `ALL_REVIEW_PHASES`, by first appearance of each label.
 */
export const REVIEW_PHASE_FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  phases: ReviewPhase[];
}> = (() => {
  const byLabel = new Map<string, ReviewPhase[]>();
  for (const phase of ALL_REVIEW_PHASES) {
    const label = REVIEW_PHASE_LABEL[phase];
    const existing = byLabel.get(label);
    if (existing) existing.push(phase);
    else byLabel.set(label, [phase]);
  }
  return Array.from(byLabel, ([label, phases]) => ({ label, phases }));
})();
