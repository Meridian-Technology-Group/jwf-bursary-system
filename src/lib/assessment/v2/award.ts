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
 * CH-50/51 + CH-52 — the maximum fees a parent could ever be asked to pay for
 * one year: the school's pre-VAT annual fee grossed up once.
 *
 * Charlotte's words: *"you will need the fees including VAT = maximum payable
 * fees"*. This is the single definition of that figure. **CH-52's cap and
 * CH-51's admin column must both read it from here** — if they compute it
 * independently they can disagree, and the cap would then bind at a different
 * number than the one shown to the assessor.
 */
export function maxPayableFeesInclVat(
  annualFeesExVat: number,
  vatRate: number = DEFAULT_VAT_RATE,
): number {
  return roundMoney(annualFeesExVat * (1 + vatRate / 100))
}

/**
 * Affordability-adjusted disposable income (C158): net income × a
 * category-adjusted percentage from the Appendix B grid
 * (`basePct − 0.5 × (category − 1)`).
 *
 * **CH-52 (25 Aug 2026) replaces the top half of `ASSUMPTION(CALC-A6)`.**
 * Above £105,000 the leg no longer holds the top band's percentage. She wants
 * it **capped at the full VAT-inclusive fees for the school in question** —
 * beyond the whole fee there is no bursary left to compute, so the expected
 * contribution cannot exceed what the parent could possibly be asked to pay.
 * `maxPayableFeesInclVat` is that ceiling, and the cap applies at every income
 * rather than only above the grid, because a large family on a mid-range income
 * can exceed the fee too.
 *
 * `maxPayableFees` is optional so callers with no fee to hand (unit tests of the
 * percentage logic) keep the uncapped behaviour.
 *
 * The bottom half of CALC-A6 stands, deliberately. She confirmed 0% applies
 * "from £0 to £29,000", which is already the outcome: the `netIncome <= 27_000`
 * shortcut returns £0 and the grid's own bottom band is 0%. The seeded band's
 * floor has been dropped from £27,001 to £0 so the table *says* so rather than
 * relying on the shortcut, but the shortcut is kept and the percentage is still
 * allowed to go negative — the min-of-three's `Math.max(0, …)` is what floors
 * the award, and the three legs are displayed to the assessor, so changing a
 * leg she has signed off is not something to slip in under this item.
 */
export function affordabilityAdjustedDI(
  netIncome: number,
  category: number,
  bands: readonly AffordabilityBandRow[],
  maxPayableFees?: number,
): number {
  // CALC-A6, bottom half: below the grid's working range the leg is £0.
  if (netIncome <= 27_000) return 0

  const band = resolveAffordabilityBand(bands, netIncome) ?? topAffordabilityBand(bands)
  if (!band) return 0 // defensive: empty bands array (should never happen against real seed data)

  const pct = band.basePct - 0.5 * (category - 1)
  const contribution = netIncome * (pct / 100)

  return maxPayableFees === undefined ? contribution : Math.min(contribution, maxPayableFees)
}

// ─── C160 — Recommended payable fees ───────────────────────────────────────

/** Recommended yearly payable fees (C160): the smallest of the three legs, floored at £0. */
export function recommendedPayableFees(actual: number, theoretical: number, affordability: number): number {
  return Math.max(0, Math.min(actual, theoretical, affordability))
}

// ─── C163–C172 — Award summary + VAT treatment ─────────────────────────────

export interface AwardSummaryInput {
  /** `autofill 1` — next-year school fees, BEFORE VAT (C163). */
  nextYearFees: number
  /** `manual fill 1` — scholarship percentage 0–100, assessor-entered (C164). */
  scholarshipPct: number
  /** `manual fill 2` — bursary award/spend, assessor-entered, BEFORE VAT (CH-36). */
  bursaryAwardBeforeVat: number
  /** Default `DEFAULT_VAT_RATE` (`../types`) — the single VAT-rate source shared with v1. */
  vatRate?: number
  /** The account's confirmed payable fees, when known — feeds `gapAmount` (C172). */
  confirmedPayableFees?: number
  /** This assessment's `recommendedPayableFees` (C160) — feeds `gapAmount` (C172). */
  recommendedPayableFees?: number
}

export interface AwardSummaryResult {
  /** `autofill 4` — scholarship spend BEFORE VAT: fees × scholarship%. */
  scholarshipSpendBeforeVat: number
  /** `autofill 2` — net fees BEFORE VAT: fees − scholarshipSpend − bursaryAward, floored at £0. */
  netFeesBeforeVat: number
  /** `autofill 3` — yearly payable fees INCLUDING VAT: netFeesBeforeVat × (1 + vatRate/100). What the parent pays. */
  yearlyPayableFeesInclVat: number
  /** C172 concept — confirmedPayableFees − recommendedPayableFees. `null` when either input is missing. */
  gapAmount: number | null
}

/**
 * Award summary + VAT treatment (C163–C172), per **CH-36** — Charlotte's
 * award-summary spec of 24 Aug 2026 (`image012.png`), which closes decision
 * **D8** and **overturns `ASSUMPTION(CALC-A5)`**.
 *
 * The whole summary is computed BEFORE VAT, and VAT is applied exactly ONCE,
 * at the end, to the net payable figure — because the fee reference data is
 * pre-VAT, while the scholarship and the bursary award are both understood
 * before VAT. Only the parent's payable fees carry VAT, since that is the
 * only line they actually pay. Her chain, verbatim:
 *
 *     autofill 1  fees for next year (or applicable year) — before VAT
 *     manual 1    scholarship award (%)
 *     autofill 4  scholarship spend — before VAT   = autofill1 × manual1
 *     manual 2    bursary award/spend — before VAT
 *     autofill 2  net fees — before VAT            = autofill1 − (autofill1 × manual1) − manual2
 *     autofill 3  yearly payable fees — incl. VAT  = autofill2 × 1.20
 *
 * This restores v1's shape (VAT on the NET remainder, per `payable-fees.ts`)
 * rather than CALC-A5's reading, under which the scholarship value and the
 * bursary award were each treated as individually VAT-inclusive. Her words:
 * *"we will never need to store the bursary award inclusive of VAT"* — so no
 * VAT-inclusive award figure is derived or persisted any more.
 *
 * The bursary award remains an assessor-entered £ amount guided by (not
 * derived from) `recommendedPayableFees` — it is not auto-computed as
 * `fees − NDI` the way v1's `requiredBursary` is.
 */
export function awardSummary(input: AwardSummaryInput): AwardSummaryResult {
  const {
    nextYearFees,
    scholarshipPct,
    bursaryAwardBeforeVat,
    vatRate = DEFAULT_VAT_RATE,
    confirmedPayableFees,
    recommendedPayableFees: recommended,
  } = input

  const vatMultiplier = 1 + vatRate / 100

  const scholarshipSpendBeforeVat = roundMoney(nextYearFees * (scholarshipPct / 100))

  const netFeesBeforeVat = roundMoney(
    Math.max(0, nextYearFees - scholarshipSpendBeforeVat - bursaryAwardBeforeVat),
  )

  const yearlyPayableFeesInclVat = roundMoney(netFeesBeforeVat * vatMultiplier)

  const gapAmount =
    confirmedPayableFees === undefined || recommended === undefined
      ? null
      : roundMoney(confirmedPayableFees - recommended)

  return { scholarshipSpendBeforeVat, netFeesBeforeVat, yearlyPayableFeesInclVat, gapAmount }
}
