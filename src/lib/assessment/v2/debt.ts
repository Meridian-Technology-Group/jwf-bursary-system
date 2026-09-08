/**
 * CALC-04 — Engine v2: personal-debt module (workbook rows 101–125).
 *
 * Spreads the assessor's itemised personal debts over a fixed five-year
 * horizon, expresses that burden as a ratio of household net income, and
 * classifies the ratio against the CALC-01 `DebtRatioBand` reference rows
 * (Appendix C.4) to produce a debt-status label.
 *
 * Reworked per Charlotte's Part 5 respec of 8 Sep 2026:
 *   - the yearly repayments divisor is a fixed 5 years, not the remaining
 *     schooling years;
 *   - the ratio is `total debt / 5 / NDI` and no longer nets savings off;
 *   - savings instead SELECT which of her two commentary tables to read
 *     (`savingsVariantFor`) — cushioned vs uncushioned wording.
 *
 * `yearlyDebtExposure` (C124) survives the respec as a DISPLAYED figure only
 * (the workbook's "netted off yearly savings" row, and a year-on-year
 * comparison column); it no longer feeds the ratio.
 *
 * Pure module — no DB, no React. Reference values (debt-ratio bands) arrive
 * via `DebtRatioBandRow[]` (the `ReferenceBundle.debtRatioBands` slice).
 */

import { resolveDebtRatioBand, type DebtRatioBandRow } from '../reference-bands'
import type { SavingsVariant } from '@prisma/client'
import type { DebtsRecord } from '@/types/assessment-v2'

function n(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Total itemised personal debt: credit cards + loans + lease balances +
 * school fees owed/other. Shared by the yearly-repayments split below and the
 * savings test's net-savings figure (savings-test respec v3, 5 Sep 2026).
 */
export function totalPersonalDebt(debts: DebtsRecord): number {
  return n(debts.creditCards) + n(debts.loans) + n(debts.leaseBalances) + n(debts.schoolFeesOwedOrOther)
}

/**
 * The fixed horizon the household is given to clear its personal debt, in
 * years (Charlotte, 8 Sep 2026: *"In line with the 5 year-ahead logic when it
 * comes to debt"*). Replaces the previous schooling-years-remaining divisor,
 * so the figure no longer shrinks as a pupil approaches the end of school.
 * `profiling.ts`'s lifestyle squeeze already used this same 5-year horizon
 * (her 5 Sep respec); the two are now consistent.
 */
export const DEBT_REPAYMENT_YEARS = 5

/**
 * Derived yearly debt repayments (C123): the sum of every itemised personal
 * debt (credit cards, loans, lease balances, school fees owed/other) spread
 * evenly over `DEBT_REPAYMENT_YEARS`.
 *
 * Her worked example (8 Sep 2026): Kaluba £8,000 / 5 = £1,600.
 */
export function calculateDerivedYearlyDebtRepayments(debts: DebtsRecord): number {
  return totalPersonalDebt(debts) / DEBT_REPAYMENT_YEARS
}

/**
 * Which of Charlotte's two commentary-table variants applies to a household
 * (8 Sep 2026): *"the logic of whether the total savings are higher or lower
 * than the total debt of the household"*.
 *
 * `totalSavings` is cash savings + ISAs/PEPs/shares — the same figure her
 * 6 Sep `minRepaymentMonthsWithoutFees` formula nets against debt. Equal
 * savings and debt is NOT a cushion (nothing is left over once the debt is
 * cleared), so the boundary falls to the uncushioned variant.
 */
export function savingsVariantFor(totalSavings: number, totalDebt: number): SavingsVariant {
  return totalSavings > totalDebt ? 'SAVINGS_ABOVE_DEBT' : 'SAVINGS_BELOW_DEBT'
}

/**
 * Yearly debt exposure (C124). `ASSUMPTION(CALC-A2)`: the workbook's own
 * cell reference for this row ("C122 − C77") is garbled — C122 doesn't
 * exist and the row's own label says the repayments are "netted off yearly
 * savings", so this reads it as `derivedYearlyDebtRepayments` (C123) minus
 * `adjustedSavings` (C77), per implementation-plan.md §CALC-04 / gap-analysis
 * §3.10. Not floored — a large savings surplus can make exposure negative,
 * which `calculateDebtOverNdiRatio` then floors to 0.
 */
export function calculateYearlyDebtExposure(
  derivedYearlyDebtRepayments: number,
  adjustedSavings: number,
): number {
  return derivedYearlyDebtRepayments - adjustedSavings
}

/**
 * Debt-over-NDI ratio (C125), per Charlotte's respec of 8 Sep 2026:
 *
 *     total debt / 5 / NDI
 *
 * Savings are NO LONGER netted off here. Under the previous formula
 * (`((total debt − total savings) / NDI) × 12`) a household's savings both
 * reduced the ratio AND coloured the wording; now they do only the latter,
 * by selecting which band table to read (`savingsVariantFor`).
 *
 * Her worked examples: Kaluba £8,000 / 5 / £24,907 = 0.0642; the live DW
 * assessment £43,000 / 5 / £5,685 = 1.5127.
 *
 * Because total debt is never negative, the ratio is now always >= 0 — the
 * "open-ended → 0" ZERO DEBT row is reachable only at literally zero debt.
 * That is what makes her 8 Sep 17:41 distinction work: a household with no
 * debt at all reads ZERO DEBT, while one whose savings merely exceed its debt
 * reads the cushioned wording from the SAVINGS_ABOVE_DEBT table. It also
 * closes Q9 (see `reference-bands.ts`) — there is no longer a floor hiding a
 * negative exposure.
 *
 * Guard: when `householdNetIncome` is 0 or negative there is no meaningful
 * ratio (division by zero, or a sign flip that would misrepresent debt
 * burden), so this returns 0 rather than `Infinity`/`NaN`/a negative ratio.
 */
export function calculateDebtOverNdiRatio(totalDebt: number, householdNetIncome: number): number {
  if (householdNetIncome <= 0) return 0
  return Math.max(0, totalDebt) / DEBT_REPAYMENT_YEARS / householdNetIncome
}

/** Result of `classifyDebt` — the Appendix C.4 status label. */
export interface DebtClassification {
  statusLabel: string
}

/**
 * Minimum debt repayment duration in months without school-fees payments —
 * COMPUTED, not a band column, per Charlotte's respec of 6 Sep 2026 ("the
 * number in months should not be used in the Debt-Over-NDI Ratio table"):
 *
 *     ((total debt − total savings) / NDI after notional spend) × 12
 *
 * Negative → `null` ("not applicable" — savings cover the debt outright);
 * positive → rounded to the nearest month. Her examples: Kaluba
 * (8,000 − 9,700) / 24,907 × 12 = −0.8 → n/a; AJ (72,814 − 7,874) /
 * 25,937.50 × 12 = 30.04 → 30. A zero/negative NDI has no meaningful
 * "months of NDI" reading, so that also returns `null`.
 */
export function minRepaymentMonthsWithoutFees(
  totalDebt: number,
  totalSavings: number,
  ndiAfterNotionalSpend: number,
): number | null {
  if (ndiAfterNotionalSpend <= 0) return null
  const months = ((totalDebt - totalSavings) / ndiAfterNotionalSpend) * 12
  return months < 0 ? null : Math.round(months)
}

/**
 * Classifies a debt-over-NDI ratio against the CALC-01 `DebtRatioBand`
 * reference rows (Appendix C.4, normalised to non-overlapping bands per
 * `ASSUMPTION(CALC-A3)`), reading the table variant that matches the
 * household's savings position (`savingsVariantFor`). Delegates to the shared
 * `resolveDebtRatioBand` resolver (`../reference-bands`), which filters to the
 * requested variant before resolving; its ascending-ceiling, first-match
 * convention already matches this table's semantics, including the seeded
 * ZERO DEBT row (`ratioFloor: null, ratioCeiling: 0`) which wins at ratio 0.
 *
 * The variant defaults to SAVINGS_BELOW_DEBT so that pre-respec callers and
 * fixtures keep their existing behaviour.
 *
 * Falls back to the ZERO DEBT label defensively if the bands array doesn't
 * contain a matching row (e.g. an incomplete `ReferenceBundle` in a test) —
 * this should never happen against the real seed data.
 */
export function classifyDebt(
  ratio: number,
  bands: readonly DebtRatioBandRow[],
  savingsVariant: SavingsVariant = 'SAVINGS_BELOW_DEBT',
): DebtClassification {
  const band = resolveDebtRatioBand(bands, ratio, savingsVariant)
  if (!band) {
    return { statusLabel: 'ZERO DEBT, NO CREDIT RISK' }
  }
  return { statusLabel: band.statusLabel }
}
