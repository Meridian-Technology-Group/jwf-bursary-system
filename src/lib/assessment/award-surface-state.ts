/**
 * award-surface-state.ts — Epic 15 M6 (CI-11, LA15-4).
 *
 * Decides what the RecommendationSurface renders. Two modes:
 *
 *  - "gated" (the Recommendation route, unchanged pre-M6 behaviour): the full
 *    form only after the assessment is COMPLETED.
 *  - "workspace" (the BURSARY AWARD CALCULATION tab): Part 6 is the natural
 *    continuation of Part 5 — the form renders for any v2 assessment that has
 *    a saved calculation, in-progress or complete. The formal outcome actions
 *    stay locked until COMPLETE (the server enforces the same rule in
 *    set-outcome-core).
 *
 * Pure — unit-tested in __tests__/award-surface-state.test.ts.
 */

import type { AssessmentStatus } from "@prisma/client";

export type AwardSurfaceMode = "gated" | "workspace";

export type AwardSurfaceState =
  /** No assessment row at all. */
  | "NO_ASSESSMENT"
  /** Gated mode, assessment not yet COMPLETED. */
  | "GATE"
  /** Workspace mode, v2, nothing saved yet — nothing to calculate from. */
  | "NO_SAVED_CALCULATION"
  /** COMPLETED v2 with a missing snapshot — data corruption (CALC-15). */
  | "SNAPSHOT_INCOMPLETE"
  /** Render the form with outcome actions LOCKED (not yet complete). */
  | "FORM_OUTCOME_LOCKED"
  /** Render the form fully (assessment complete). */
  | "FORM"

export function resolveAwardSurfaceState(input: {
  mode: AwardSurfaceMode;
  assessmentStatus: AssessmentStatus | null;
  engineVersion: "v1" | "v2";
  /** `Assessment.recommendedPayableFees` — null until a save persists it. */
  hasSnapshot: boolean;
}): AwardSurfaceState {
  const { mode, assessmentStatus, engineVersion, hasSnapshot } = input;

  if (assessmentStatus == null) return "NO_ASSESSMENT";

  const completed = assessmentStatus === "COMPLETED";

  if (completed) {
    if (engineVersion === "v2" && !hasSnapshot) return "SNAPSHOT_INCOMPLETE";
    return "FORM";
  }

  // Not completed:
  if (mode === "gated") return "GATE";

  // Workspace (CI-11): v1 keeps the gate (the ungated continuation is a v2
  // workspace concept); v2 renders live working values once a save exists.
  if (engineVersion === "v1") return "GATE";
  if (!hasSnapshot) return "NO_SAVED_CALCULATION";
  return "FORM_OUTCOME_LOCKED";
}
