/**
 * CALC-06 — Engine v2: bursary award calculation (workbook rows 138–180) +
 * the reworked VAT/award-summary treatment.
 *
 * Composes the three award legs (Actual / Theoretical / Affordability), the
 * min-of-three recommended payable fees, and the after-VAT award summary the
 * assessor fills in once a scholarship % + bursary award are decided.
 *
 * Pure module — no DB, no React. Reference values arrive via `ReferenceBundle`
 * (notional costs for the theoretical leg, the affordability grid for the
 * affordability leg).
 */

import { applySiblingDeductions } from '../sibling'
import { DEFAULT_VAT_RATE } from '../types'
import {
  getNotionalCostAmount,
  theoreticalNotionalTotal,
  resolveAffordabilityBand,
  type AffordabilityBandRow,
} from '../reference-bands'
import type { ReferenceBundle } from './types'

/** Rounds a monetary value to 2 decimal places (local copy — v1's `payable-fees.ts` stays untouched). */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

// ─── C154 — Actual leg ─────────────────────────────────────────────────────

/**
 * Actual net remaining disposable income (C154): NDI after notional spend,
 * less each older sibling's payable fees (in priority order — reuses
 * `applySiblingDeductions`'s sequential-absorption semantics verbatim, per
 * implementation-plan.md §CALC-06), less this pupil's annual fees.
 */
export function actualRemainingDI(
  ndiAfterNotionalSpend: number,
  siblingPayableFees: readonly number[],
  annualFees: number,
): number {
  const afterSiblings = applySiblingDeductions(ndiAfterNotionalSpend, [...siblingPayableFees])
  return afterSiblings - annualFees
}

// ─── C156 — Theoretical leg ────────────────────────────────────────────────

/**
 * Theoretical benchmarking disposable income (C156): net income minus the
 * category's THEORETICAL notional total (rent + council tax + essentials +
 * public transport + JWF allowance + car — `theoreticalNotionalTotal`,
 * `../reference-bands`) minus the category's notional-savings benchmark.
 *
 * LINKED NOTIONALS G47: unlike the actual leg's notional-spend block
 * (`notional-spend.ts`), which only deducts car/public-transport when the
 * assessor has toggled the corresponding `uses*` flag, this leg includes
 * BOTH transport modes unconditionally — it is a fixed benchmark for the
 * family category, not the household's actual toggled spend. This is a
 * deliberate divergence between the two legs, not a bug — documented here so
 * it isn't "fixed" to match the actual leg later.
 */
export function theoreticalBenchmarkDI(netIncome: number, category: number, ref: ReferenceBundle): number {
  const total = theoreticalNotionalTotal(ref.notionalCosts, category)
  if (total === null) {
    throw new Error(`ReferenceBundle is missing one or more NotionalCostConfig rows for category ${category}`)
  }

  const notionalSavings = getNotionalCostAmount(ref.notionalCosts, category, 'NOTIONAL_SAVINGS')
  if (notionalSavings === null) {
    throw new Error(`ReferenceBundle is missing NotionalCostConfig NOTIONAL_SAVINGS for category ${category}`)
  }

  return netIncome - total - notionalSavings
}

// ─── C158 — Affordability leg ──────────────────────────────────────────────

/** The affordability band with the highest `bandCeiling` (the top of the £27k–£105k grid). */
function topAffordabilityBand(bands: readonly AffordabilityBandRow[]): AffordabilityBandRow | null {
  if (bands.length === 0) return null
  return bands.reduce((top, band) => (band.bandCeiling > top.bandCeiling ? band : top))
}

/**
 * Affordability-adjusted disposable income (C158): net income × a
 * category-adjusted percentage from the Appendix B grid
 * (`basePct − 0.5 × (category − 1)`, negatives allowed — the workbook lets
 * the min-of-three floor at £0 handle a negative affordability leg rather
 * than flooring the percentage itself).
 *
 * `ASSUMPTION(CALC-A6)` — the grid only covers £27,001–£105,000:
 *   - net income ≤ £27,000 → the affordability leg is £0 outright (not a 0%
 *     band — the grid's own bottom band starts at £27,001).
 *   - net income > £105,000 (above the top band's ceiling) → holds the top
 *     band's `basePct` (still category-adjusted) rather than extrapolating
 *     the grid further.
 */
export function affordabilityAdjustedDI(
  netIncome: number,
  category: number,
  bands: readonly AffordabilityBandRow[],
): number {
  // ASSUMPTION(CALC-A6): below the bottom band.
  if (netIncome <= 27_000) return 0

  const band = resolveAffordabilityBand(bands, netIncome) ?? topAffordabilityBand(bands)
  if (!band) return 0 // defensive: empty bands array (should never happen against real seed data)

  const pct = band.basePct - 0.5 * (category - 1)
  return netIncome * (pct / 100)
}

// ─── C160 — Recommended payable fees ───────────────────────────────────────

/** Recommended yearly payable fees (C160): the smallest of the three legs, floored at £0. */
export function recommendedPayableFees(actual: number, theoretical: number, affordability: number): number {
  return Math.max(0, Math.min(actual, theoretical, affordability))
}

// ─── C163–C172 — Award summary + VAT treatment ─────────────────────────────

export interface AwardSummaryInput {
  /** Next-year school fees (C163). */
  nextYearFees: number
  /** Scholarship percentage 0–100, assessor-entered (C164). */
  scholarshipPct: number
  /** Bursary award value, assessor-entered, AFTER VAT (C166) — not auto-derived, unlike v1's `bursaryAward`. */
  bursaryAwardAfterVat: number
  /** Default `DEFAULT_VAT_RATE` (`../types`) — the single VAT-rate source shared with v1. */
  vatRate?: number
  /** The account's confirmed payable fees, when known — feeds `gapAmount` (C172). */
  confirmedPayableFees?: number
  /** This assessment's `recommendedPayableFees` (C160) — feeds `gapAmount` (C172). */
  recommendedPayableFees?: number
}

export interface AwardSummaryResult {
  /** C165 — (fees × scholarship%) × (1 + vatRate/100). `ASSUMPTION(CALC-A5)`: VAT is added TO the scholarship value. */
  scholarshipValueInclVat: number
  /** C167 — fees − scholarshipValueInclVat − bursaryAwardAfterVat, floored at £0. */
  payableFeesNextYear: number
  /** C169 — the school's true spend for the pupil BEFORE VAT: bursaryAwardAfterVat ÷ (1 + vatRate/100). */
  bursarySpendBeforeVat: number
  /** C172 concept — confirmedPayableFees − recommendedPayableFees. `null` when either input is missing. */
  gapAmount: number | null
}

/**
 * Award summary + VAT treatment (C163–C172). `ASSUMPTION(CALC-A5)` throughout
 * (pending explicit client sign-off of D8) — see implementation-plan.md §2.5
 * and gap-analysis.md §3.14 for the full workbook-vs-v1 comparison this
 * corrects: v1 (`payable-fees.ts`) applies VAT to the NET remainder after
 * scholarship/bursary are deducted; v2 instead treats the scholarship value
 * and the bursary award as already VAT-inclusive figures individually, per
 * the workbook.
 *
 * Note the inversion vs v1: here the bursary award is an assessor-entered £
 * amount (after VAT), guided by (but not derived from) `recommendedPayableFees`
 * — it is not auto-computed as `fees − NDI` the way v1's `requiredBursary` is.
 */
export function awardSummary(input: AwardSummaryInput): AwardSummaryResult {
  const {
    nextYearFees,
    scholarshipPct,
    bursaryAwardAfterVat,
    vatRate = DEFAULT_VAT_RATE,
    confirmedPayableFees,
    recommendedPayableFees: recommended,
  } = input

  const vatMultiplier = 1 + vatRate / 100

  const scholarshipValueInclVat = roundMoney(nextYearFees * (scholarshipPct / 100) * vatMultiplier)

  const payableFeesNextYear = roundMoney(
    Math.max(0, nextYearFees - scholarshipValueInclVat - bursaryAwardAfterVat),
  )

  const bursarySpendBeforeVat = roundMoney(bursaryAwardAfterVat / vatMultiplier)

  const gapAmount =
    confirmedPayableFees === undefined || recommended === undefined
      ? null
      : roundMoney(confirmedPayableFees - recommended)

  return { scholarshipValueInclVat, payableFeesNextYear, bursarySpendBeforeVat, gapAmount }
}
