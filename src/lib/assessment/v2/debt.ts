/**
 * CALC-04 — Engine v2: personal-debt module (workbook rows 101–125).
 *
 * Derives an annualised debt-repayment burden from the assessor's itemised
 * personal debts, nets it off against the household's adjusted savings to
 * get a yearly "debt exposure" figure, expresses that as a ratio of
 * household net income, and classifies the ratio against the CALC-01
 * `DebtRatioBand` reference rows (Appendix C.4) to produce a minimum
 * repayment duration + a 16-band credit-risk status label.
 *
 * The debt-repayment figure this module produces (`derivedYearlyDebtRepayments`)
 * is also an INPUT to `notional-spend.ts`'s savings test (C80/C81) — this
 * module does not import notional-spend.ts; the CALC-06 orchestrator wires
 * the dependency in the right order (debt repayments → notional spend →
 * debt exposure/ratio, since the ratio itself needs `adjustedSavings`, which
 * notional-spend.ts computes).
 *
 * Pure module — no DB, no React. Reference values (debt-ratio bands) arrive
 * via `DebtRatioBandRow[]` (the `ReferenceBundle.debtRatioBands` slice).
 */

import { resolveDebtRatioBand, type DebtRatioBandRow } from '../reference-bands'
import type { DebtsRecord } from '@/types/assessment-v2'

function n(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Derived yearly debt repayments (C123): the sum of every itemised personal
 * debt (credit cards, loans, lease balances, school fees owed/other) spread
 * evenly across the remaining schooling years. Returns 0 when
 * `schoolingYearsRemaining` is 0 or negative — there is no meaningful
 * "per year" split with no years left, and the workbook's own C123 has no
 * defined behaviour for a zero/negative divisor.
 */
export function calculateDerivedYearlyDebtRepayments(
  debts: DebtsRecord,
  schoolingYearsRemaining: number,
): number {
  if (schoolingYearsRemaining <= 0) return 0

  const totalDebt =
    n(debts.creditCards) + n(debts.loans) + n(debts.leaseBalances) + n(debts.schoolFeesOwedOrOther)

  return totalDebt / schoolingYearsRemaining
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
 * Debt-over-NDI ratio (C125). `ASSUMPTION(CALC-A2)`: the workbook's own
 * formula label for this row ("((C124−C74/C76)) divided by C40") has
 * ambiguous bracketing; this implements the plan's stated reading —
 * `max(0, yearlyDebtExposure) / householdNetIncome` — with the denominator
 * being household net income (C40), confirmed by workbook example F125.
 *
 * Guard: when `householdNetIncome` is 0 or negative there is no meaningful
 * ratio (division by zero, or a sign flip that would misrepresent debt
 * burden as a %), so this returns 0 rather than `Infinity`/`NaN`/a negative
 * ratio. Callers needing to distinguish "no income" from "no debt exposure"
 * should check `householdNetIncome` themselves before calling this.
 */
export function calculateDebtOverNdiRatio(
  yearlyDebtExposure: number,
  householdNetIncome: number,
): number {
  if (householdNetIncome <= 0) return 0
  return Math.max(0, yearlyDebtExposure) / householdNetIncome
}

/** Result of `classifyDebt` — the two Appendix C.4 output columns. */
export interface DebtClassification {
  minRepaymentMonths: number | null
  statusLabel: string
}

/**
 * Classifies a debt-over-NDI ratio against the CALC-01 `DebtRatioBand`
 * reference rows (Appendix C.4, normalised to non-overlapping bands per
 * `ASSUMPTION(CALC-A3)`). Delegates to the shared `resolveDebtRatioBand`
 * resolver (`../reference-bands`) — its floor/ceiling inclusivity
 * convention (ascending-ceiling, first-match, inclusive both ends) already
 * matches this table's semantics, including the seeded ZERO DEBT row
 * (`ratioFloor: null, ratioCeiling: 0`) which correctly wins for any
 * `ratio <= 0` (whether truly zero, or negative after the floor above is
 * bypassed by a direct call) ahead of the "0–0.1" band.
 *
 * Falls back to the ZERO DEBT label defensively if the bands array doesn't
 * contain a matching row (e.g. an incomplete `ReferenceBundle` in a test) —
 * this should never happen against the real seed data.
 */
export function classifyDebt(ratio: number, bands: readonly DebtRatioBandRow[]): DebtClassification {
  const band = resolveDebtRatioBand(bands, ratio)
  if (!band) {
    return { minRepaymentMonths: null, statusLabel: 'ZERO DEBT, NO CREDIT RISK' }
  }
  return { minRepaymentMonths: band.minRepaymentMonths, statusLabel: band.statusLabel }
}
