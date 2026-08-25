/**
 * CALC-08 — pure helpers for the v2 recommendation surface.
 *
 * The v2 recommendation screen reads the three award legs + `recommendedPayableFees`
 * straight from the completed assessment's persisted snapshot columns (never
 * recomputed), then lets the assessor enter a scholarship %, an after-VAT bursary
 * award, and a confirmed payable-fees figure. The derived award-summary numbers
 * come from the SAME pure `awardSummary` the engine uses (assumption CALC-A5).
 *
 * Everything here is pure (no DB, no React) so it is shared verbatim between the
 * client form (live derivation + submit gating) and the server action
 * (authoritative gap-reason validation), and unit-tested directly.
 */

import { awardSummary, type AwardSummaryResult } from "./v2/award";
import { DEFAULT_VAT_RATE } from "./types";

/**
 * Tolerance (£) within which a gap is treated as zero. Rounding in the VAT /
 * min-of-three arithmetic can leave a sub-penny residual; a gap must exceed this
 * to require a reason. Both the client (submit gating) and the server
 * (authoritative validation) use this single value.
 */
export const GAP_TOLERANCE = 0.01;

/** `confirmed − recommended`, rounded to the penny. */
export function computeGapAmount(
  confirmedPayableFees: number,
  recommendedPayableFees: number,
): number {
  return Math.round((confirmedPayableFees - recommendedPayableFees) * 100) / 100;
}

/** True when the gap is material (beyond `GAP_TOLERANCE`) and therefore needs ≥1 reason. */
export function hasMaterialGap(
  gapAmount: number | null | undefined,
  tolerance: number = GAP_TOLERANCE,
): boolean {
  if (gapAmount == null) return false;
  return Math.abs(gapAmount) > tolerance;
}

/**
 * Gap-reason requirement rule (CALC-08): a material gap requires at least one
 * gap reason; no gap requires none. Used by both the client (to gate the Save
 * button) and the server action (authoritative). Returns `true` when the
 * selection is acceptable.
 */
export function gapReasonSelectionValid(
  gapAmount: number | null | undefined,
  gapReasonIds: readonly string[],
  tolerance: number = GAP_TOLERANCE,
): boolean {
  if (!hasMaterialGap(gapAmount, tolerance)) return true;
  return gapReasonIds.length > 0;
}

/** The previous recommendation's payable-fees shape, as read for the last-payable lookup. */
export interface PreviousRecommendationPayable {
  confirmedPayableFees: number | null;
  recommendedPayableFees: number | null;
  yearlyPayableFees: number | null;
}

/**
 * The "last payable fees" carried into a re-assessment's recommendation:
 * the previous recommendation's CONFIRMED figure (what was actually charged),
 * falling back to its recommended (min-of-three) figure, then to the legacy v1
 * `yearlyPayableFees`. Returns `null` for a first assessment (no previous
 * recommendation).
 */
export function selectLastPayableFees(
  previous: PreviousRecommendationPayable | null,
): number | null {
  if (!previous) return null;
  return (
    previous.confirmedPayableFees ??
    previous.recommendedPayableFees ??
    previous.yearlyPayableFees ??
    null
  );
}

/**
 * Resolves the fee figure the award summary works against. Prefers the
 * assessment's persisted next-year fee snapshot; falls back to the current-year
 * annual fee when no next-year figure is present, flagging the fallback so the
 * UI can label it (plan §CALC-08).
 */
export function resolveNextYearFees(input: {
  nextYearAnnualFees: number | null | undefined;
  annualFees: number | null | undefined;
}): { fees: number; usingCurrentYearFee: boolean } {
  if (input.nextYearAnnualFees != null && input.nextYearAnnualFees > 0) {
    return { fees: input.nextYearAnnualFees, usingCurrentYearFee: false };
  }
  return { fees: input.annualFees ?? 0, usingCurrentYearFee: true };
}

/** Inputs the assessor supplies on the v2 recommendation screen. */
export interface RecommendationAwardInput {
  /** Next-year fees the summary works against, before VAT (see `resolveNextYearFees`). */
  nextYearFees: number;
  /** Scholarship percentage 0–100. */
  scholarshipPct: number;
  /** Bursary award/spend, BEFORE VAT, assessor-entered (CH-36). */
  bursaryAwardBeforeVat: number;
  /** What the assessor is confirming as this year's payable fees (C172). */
  confirmedPayableFees: number;
  /** The engine's min-of-three recommended payable fees (from the snapshot). */
  recommendedPayableFees: number;
  /** VAT rate (%); defaults to `DEFAULT_VAT_RATE`. */
  vatRate?: number;
}

/**
 * Full derived award figures for the v2 recommendation surface (CH-36): the
 * before-VAT scholarship spend, before-VAT net fees, the VAT-inclusive yearly
 * payable fees, and the recommended→confirmed gap — all via the engine's
 * `awardSummary` (`gapAmount` here always resolves to a number because both
 * inputs are always supplied on this screen).
 */
export function deriveRecommendationAward(
  input: RecommendationAwardInput,
): AwardSummaryResult {
  return awardSummary({
    nextYearFees: input.nextYearFees,
    scholarshipPct: input.scholarshipPct,
    bursaryAwardBeforeVat: input.bursaryAwardBeforeVat,
    vatRate: input.vatRate ?? DEFAULT_VAT_RATE,
    confirmedPayableFees: input.confirmedPayableFees,
    recommendedPayableFees: input.recommendedPayableFees,
  });
}
