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

import type { ReviewPhase } from "@/lib/applications/queue-filter";

export const REVIEW_PHASE_LABEL: Record<ReviewPhase, string> = {
  PRE_SUBMISSION: "Pre-submission",
  SUBMITTED: "Awaiting review",
  NOT_STARTED: "Review in progress",
  PAUSED: "Paused — awaiting documents",
  COMPLETED: "Assessment complete",
  QUALIFIES: "Active",
  DOES_NOT_QUALIFY: "Closed",
};
