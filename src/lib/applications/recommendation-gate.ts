/**
 * The v2 recommendation re-confirmation gate (Epic 13 / C1, D13-2), extracted
 * from `set-outcome-core.ts` so the Epic 18 post-assessment core can apply the
 * same rule without transitively importing the email module (which the new
 * lifecycle deliberately never uses — Q11).
 */

import { selectEngineVersion } from "@/lib/assessment/engine-version";

/** User-facing refusal when a recommendation's payable fees are unconfirmed. */
export const RECOMMENDATION_NOT_RECONFIRMED_MESSAGE =
  "The payable fees on this recommendation have not been confirmed — " +
  "reopening an assessment clears the previous confirmation. Confirm them on " +
  "the recommendation screen before setting an outcome.";

/**
 * Re-confirmation gate (Epic 13 / C1, D13-2).
 *
 * Reopening a COMPLETED assessment clears the recommendation's
 * `confirmedPayableFees` — the assessor's sign-off on a figure derived from an
 * assessment that has since been reopened and possibly corrected. Deciding on
 * it afterwards would promote a bursary account off a number nobody has looked
 * at since the correction (`promoteToActiveAccount` walks confirmed →
 * recommended → legacy for the benchmark). So: a v2 recommendation that exists
 * but carries no confirmed figure is stale, and cannot decide anything.
 *
 * Scoped so no pre-existing flow changes:
 *   - v1 assessments never populate `confirmedPayableFees` (a CALC-08/v2
 *     field), so they are exempt outright.
 *   - An assessment with NO recommendation row is exempt — nothing was ever
 *     recorded, so there is nothing stale, and the pre-recommendation outcome
 *     paths keep working unchanged.
 *
 * Reopen is the main way to reach the blocked state, but deliberately not the
 * only one: a v2 recommendation whose payable fees were NEVER confirmed is the
 * same defect wearing different clothes, and it should not decide an award
 * either. Both clear the same way — confirm the figure and save.
 */
export function needsRecommendationReconfirmation(assessment: {
  calculationVersion: number | null;
  recommendation: { confirmedPayableFees: unknown } | null;
} | null): boolean {
  if (!assessment) return false;
  if (selectEngineVersion(assessment.calculationVersion) !== "v2") return false;
  if (!assessment.recommendation) return false;
  return assessment.recommendation.confirmedPayableFees == null;
}
