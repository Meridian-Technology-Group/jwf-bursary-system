/**
 * CALC-05 — Engine v2: profiling derivations (workbook `PROFILING CATEGORIES`
 * tab, rows C101–C135).
 *
 * Every profiling category the workbook computes is a derived lookup, never
 * an assessor-entered value (implementation-plan.md §2 architecture decision
 * #3): income category + fees-benchmark %, property category (portfolio ×
 * value-band × mortgaged-vs-outright matrix), property-equity category,
 * financial-equity label, and the lifestyle-squeeze ratio + status. This
 * module is pure — no DB, no React — and reads every band/threshold from the
 * `ReferenceBundle` (CALC-01 rows), except the property-category matrix
 * (Appendix C.6), which is rule-shaped rather than band-table-shaped and so
 * is hardcoded logic here (see the doc comment above `propertyCategory`).
 */

import {
  resolveIncomeCategoryBand,
  resolvePropertyEquityBand,
  resolveFinancialEquityBand,
  resolveLifestyleSqueezeBand,
  type IncomeCategoryBandRow,
  type PropertyEquityBandRow,
  type FinancialEquityBandRow,
  type LifestyleSqueezeBandRow,
} from '../reference-bands'
import type { PropertyAssetsRecord, DebtsRecord } from '@/types/assessment-v2'

function n(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

// ─── C.1 — income category + fees-benchmark % ─────────────────────────────

/**
 * Income category (Appendix C.1 / `IncomeCategoryBand`) for a given net
 * income. Floor-inclusive, ceiling-exclusive (the appendix's own note, see
 * `resolveIncomeCategoryBand`). The 1,2,3,4,5,6,7,7,8,**7**,8 tail anomaly
 * (£110k–£119,999 maps to category 7, *below* the £100k–£110k band's
 * category 8) is workbook DATA, preserved verbatim as seeded —
 * `ASSUMPTION(CALC-A1)`. Returns `null` only if the bundle is missing a band
 * for the value (a seed/data-integrity gap, not a business case).
 */
export function incomeCategory(netIncome: number, bands: readonly IncomeCategoryBandRow[]): number | null {
  return resolveIncomeCategoryBand(bands, netIncome)?.category ?? null
}

/**
 * Fees-benchmark % (Appendix C.1, same band table as `incomeCategory` — the
 * gap analysis notes tables 1 and 6 merge into one) for a given net income.
 * Expressed in whole percentage points (e.g. `30` means 30%), matching the
 * seeded `feesBenchmarkPct` column and `AffordabilityBand.basePct`'s
 * convention. Same £110k–£119,999 anomaly applies (`CALC-A1`) — that band's
 * `feesBenchmarkPct` is still 30, same as its neighbours either side.
 */
export function feesBenchmarkPct(netIncome: number, bands: readonly IncomeCategoryBandRow[]): number | null {
  return resolveIncomeCategoryBand(bands, netIncome)?.feesBenchmarkPct ?? null
}

// ─── Property assets — equity totals ──────────────────────────────────────

export interface PropertyEquityTotals {
  homeEquity: number
  secondEquity: number
  otherEquity: number
  /** Sum of the three per-property equities. */
  totalEquity: number
  /** Sum of the three properties' values (workbook C101/C102 aggregate — used for the property-category value bands). */
  totalValue: number
}

/**
 * Per-property equity (value − mortgageBalance) and totals from the
 * assessor-itemised `PropertyAssetsRecord` (CALC-02). A missing block (no
 * `home`/`second`/`other` entry, or a missing `value`/`mortgageBalance`
 * field within one) contributes 0 to every total — the workbook has no
 * "unknown" state for a property that isn't itemised.
 */
export function propertyEquityTotals(assets: PropertyAssetsRecord): PropertyEquityTotals {
  const homeValue = n(assets.home?.value)
  const secondValue = n(assets.second?.value)
  const otherValue = n(assets.other?.value)

  const homeEquity = homeValue - n(assets.home?.mortgageBalance)
  const secondEquity = secondValue - n(assets.second?.mortgageBalance)
  const otherEquity = otherValue - n(assets.other?.mortgageBalance)

  return {
    homeEquity,
    secondEquity,
    otherEquity,
    totalEquity: homeEquity + secondEquity + otherEquity,
    totalValue: homeValue + secondValue + otherValue,
  }
}

// ─── C.6 — property category matrix ───────────────────────────────────────

/**
 * The workbook's own portfolio-type dropdown (PROFILING table 2's row
 * selector) — not a Prisma enum (no DB import in this pure module). `RENTING`
 * short-circuits the whole matrix to category 1; the other three pick which
 * single itemised property block (`home`/`second`/`other`) is "relevant" for
 * the value-band × mortgaged-vs-outright lookup.
 */
export type PropertyPortfolioType = 'RENTING' | 'SINGLE' | 'DOUBLE' | 'MULTIPLE'

interface PropertyCategoryBand {
  /** Exclusive upper bound on property VALUE (not equity); `Infinity` for the open-ended top band. */
  ceiling: number
  mortgagedCategory: number
  outrightCategory: number
}

/**
 * Appendix C.6 property-category matrix, hardcoded as rule-shaped logic (per
 * the CALC-05 scope note — this is a portfolio-type-conditional matrix, not a
 * flat band table like the rest of Appendix C, so it doesn't get a CALC-01
 * reference row/seed table).
 *
 * Workbook table (value bands are floor-inclusive/ceiling-exclusive, matching
 * the convention every other Appendix C table already uses — the workbook's
 * own "<360k" / "360–500k" / … labels don't spell out which side of each
 * £-boundary wins, so this module resolves the boundary the same way
 * `resolveBand` does elsewhere in the engine):
 *
 * | Value band            | mortgaged | outright |
 * |------------------------|-----------|----------|
 * | < £360,000             | 2         | 4        |
 * | £360,000 – £500,000    | 3         | 5        |
 * | £500,000 – £800,000    | 6         | 7        |
 * | £800,000 – £1,200,000  | 8         | 9        |
 *
 * Then, by portfolio type:
 * - `SINGLE` tops out at one band: **≥ £1,200,000 → 10 (mortgaged) / 11 (outright)**.
 * - `DOUBLE` / `MULTIPLE` get one more band before their top:
 *   **£1,200,000 – £1,600,000 → 10 / 11**, **≥ £1,600,000 → 12 / 13**.
 */
function propertyCategoryBands(portfolioType: 'SINGLE' | 'DOUBLE' | 'MULTIPLE'): readonly PropertyCategoryBand[] {
  const common: PropertyCategoryBand[] = [
    { ceiling: 360_000, mortgagedCategory: 2, outrightCategory: 4 },
    { ceiling: 500_000, mortgagedCategory: 3, outrightCategory: 5 },
    { ceiling: 800_000, mortgagedCategory: 6, outrightCategory: 7 },
    { ceiling: 1_200_000, mortgagedCategory: 8, outrightCategory: 9 },
  ]

  if (portfolioType === 'SINGLE') {
    return [...common, { ceiling: Infinity, mortgagedCategory: 10, outrightCategory: 11 }]
  }

  // DOUBLE / MULTIPLE — one extra band before the top.
  return [
    ...common,
    { ceiling: 1_600_000, mortgagedCategory: 10, outrightCategory: 11 },
    { ceiling: Infinity, mortgagedCategory: 12, outrightCategory: 13 },
  ]
}

/** Picks the itemised property block the value-band lookup applies to, per portfolio type. */
function relevantProperty(portfolioType: 'SINGLE' | 'DOUBLE' | 'MULTIPLE', assets: PropertyAssetsRecord) {
  switch (portfolioType) {
    case 'SINGLE':
      return assets.home
    case 'DOUBLE':
      return assets.second
    case 'MULTIPLE':
      return assets.other
  }
}

/**
 * Property category (1–13, Appendix C.6). `RENTING` is always category 1
 * regardless of `assets`. Otherwise, classifies the "relevant" property for
 * the portfolio type (single → `home`, double → `second`, multiple →
 * `other`) by its value band × outright-vs-mortgaged status, where "outright"
 * means the property's equity equals its value (no/zero mortgage balance —
 * see `propertyEquityTotals`). A missing relevant-property block is treated
 * as value 0 / no mortgage (outright, bottom band) — a data gap, not
 * expected in practice once CALC-07 wires real assessor input.
 */
export function propertyCategory(portfolioType: PropertyPortfolioType, assets: PropertyAssetsRecord): number {
  if (portfolioType === 'RENTING') return 1

  const property = relevantProperty(portfolioType, assets)
  const value = n(property?.value)
  const mortgageBalance = n(property?.mortgageBalance)
  const equity = value - mortgageBalance
  const outright = equity === value

  const bands = propertyCategoryBands(portfolioType)
  const band = bands.find((b) => value < b.ceiling) ?? bands[bands.length - 1]
  return outright ? band.outrightCategory : band.mortgagedCategory
}

// ─── C.2 — property-equity category ───────────────────────────────────────

/**
 * Property-equity category (Appendix C.2 / `PropertyEquityBand`) for a total
 * equity figure (e.g. `propertyEquityTotals(...).totalEquity`).
 */
export function propertyEquityCategory(
  totalEquity: number,
  bands: readonly PropertyEquityBandRow[],
): number | null {
  return resolvePropertyEquityBand(bands, totalEquity)?.category ?? null
}

// ─── C.3 — financial-equity label ─────────────────────────────────────────

/**
 * Net financial equity = cash & savings on hand minus every itemised debt
 * (workbook C103-ish "financial equity" line feeding PROFILING table 4). The
 * caller supplies `cashAndSavings` (e.g. `cashSavings + isasPepsShares`, as
 * already summed elsewhere in the v2 engine) and the assessor's itemised
 * `DebtsRecord` (CALC-02) — a missing debt field contributes 0.
 */
export function netFinancialEquity(cashAndSavings: number, debts: DebtsRecord): number {
  const totalDebts =
    n(debts.creditCards) + n(debts.loans) + n(debts.leaseBalances) + n(debts.schoolFeesOwedOrOther)
  return cashAndSavings - totalDebts
}

/**
 * Financial-equity label (Appendix C.3 / `FinancialEquityBand`) for a net
 * financial-equity figure (see `netFinancialEquity`).
 */
export function financialEquityLabel(
  netFinancialEquityValue: number,
  bands: readonly FinancialEquityBandRow[],
): string | null {
  return resolveFinancialEquityBand(bands, netFinancialEquityValue)?.label ?? null
}

// ─── C131–C135 — lifestyle-squeeze ratio ──────────────────────────────────

export interface LifestyleSqueezeInput {
  /** NDI after notional spend (C87, from `calculateNotionalSpend`). */
  ndiAfterNotionalSpend: number
  /** Household net income (C40). */
  householdNetIncome: number
  /**
   * Total itemised personal debt (`totalPersonalDebt`, CALC-04). This view
   * gives the household a fixed FIVE years to repay it (Charlotte's
   * benchmark-bands respec, 5 Sep 2026) — deliberately NOT the
   * schooling-years-based repayments or the savings-netted exposure.
   */
  totalDebt: number
  /**
   * Fees-benchmark % for the household's income category (Appendix C.1,
   * `feesBenchmarkPct(...)` above) — whole percentage points, e.g. `30` for
   * 30%, NOT a 0–1 fraction.
   */
  feesBenchmarkPct: number
}

export interface LifestyleSqueezeResult {
  /** NDI ÷ net income, as a percentage (100 = 100%). `null` when net income is 0. */
  ndiOverIncomePct: number | null
  /** (NDI − totalDebt/5) ÷ net income, as a percentage. `null` when net income is 0. */
  postDebtLifestylePct: number | null
  /** feesBenchmarkPct% of net income, in £. */
  feesBenchmarkAmount: number
  /**
   * feesBenchmarkAmount ÷ (NDI − totalDebt/5), as a percentage (100 = 100%,
   * matching `LifestyleSqueezeBand`'s own scale). `null` when the denominator
   * is 0 — there is no meaningful squeeze ratio against zero debt-adjusted
   * NDI.
   */
  squeezeRatio: number | null
  /** Appendix C.5 status label for `squeezeRatio`; `null` whenever `squeezeRatio` is `null`. */
  statusLabel: string | null
}

/** The fixed repayment horizon the lifestyle-squeeze view grants a household's debt. */
const SQUEEZE_DEBT_REPAYMENT_YEARS = 5

/**
 * Lifestyle-squeeze ratio + status (workbook rows C131–C135, Appendix
 * C.5/`LifestyleSqueezeBand`). Every percentage here is expressed in whole
 * percentage points (100 = 100%) to match `LifestyleSqueezeBand`'s own
 * `ratioFloor`/`ratioCeiling` scale — see the seed-data doc comment.
 *
 * Benchmark-bands respec (Charlotte, 5 Sep 2026): the debt figure in this
 * view is the household's TOTAL debt spread over a fixed five years ("I am
 * giving the household five years to repay their debt in this view") —
 * replacing the previous savings-netted yearly debt exposure. Her vectors:
 * DW 9,047.85 / (5,685 − 43,000/5) = −310.39%; Kaluba 18,662.43 /
 * (25,621.29 − 8,000/5) = 77.69%.
 *
 * Division-by-zero guard: both debt-adjusted figures (`squeezeRatio`, and by
 * extension `statusLabel`) require a non-zero `ndiAfterNotionalSpend −
 * totalDebt/5`; `ndiOverIncomePct` and `postDebtLifestylePct` require a
 * non-zero `householdNetIncome`. Any of these denominators being exactly 0
 * yields `null` for that field rather than `Infinity`/`NaN` — there is no
 * meaningful "% of nothing" figure, and a `null` is a clean signal for the
 * UI to render "n/a" instead of a nonsensical number.
 */
export function lifestyleSqueeze(
  input: LifestyleSqueezeInput,
  bands: readonly LifestyleSqueezeBandRow[],
): LifestyleSqueezeResult {
  const { ndiAfterNotionalSpend, householdNetIncome, totalDebt, feesBenchmarkPct: pct } = input

  const fiveYearDebtRepayment = totalDebt / SQUEEZE_DEBT_REPAYMENT_YEARS

  const ndiOverIncomePct = householdNetIncome === 0 ? null : (ndiAfterNotionalSpend / householdNetIncome) * 100

  const postDebtLifestylePct =
    householdNetIncome === 0
      ? null
      : ((ndiAfterNotionalSpend - fiveYearDebtRepayment) / householdNetIncome) * 100

  const feesBenchmarkAmount = (pct / 100) * householdNetIncome

  const postDebtLifestyleSpend = ndiAfterNotionalSpend - fiveYearDebtRepayment
  const squeezeRatio = postDebtLifestyleSpend === 0 ? null : (feesBenchmarkAmount / postDebtLifestyleSpend) * 100

  const statusLabel = squeezeRatio === null ? null : resolveLifestyleSqueezeBand(bands, squeezeRatio)?.statusLabel ?? null

  return {
    ndiOverIncomePct,
    postDebtLifestylePct,
    feesBenchmarkAmount,
    squeezeRatio,
    statusLabel,
  }
}
