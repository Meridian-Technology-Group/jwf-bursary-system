/**
 * CALC-03 — Engine v2: notional spend (workbook rows 43–87).
 *
 * Deducts (and, per the workbook's own rules, partially adds back) six
 * notional cost-of-living blocks from household net income, runs the
 * savings test, and applies the school-fees-insurance add-back — producing
 * `totalNotionalSpend` (C85) and `ndiAfterNotionalSpend` (C87).
 *
 * Sign convention: every `NotionalSpendLine.amount` is a non-negative
 * magnitude (the "auto value" the assessor sees); `direction` says whether
 * it deducts from or adds back to NDI, and `signedAmount` carries the
 * workbook's own "±" column (`-amount` for a deduction, `+amount` for an
 * add-back). `totalNotionalSpend` is the sum of every line's `signedAmount`,
 * so `ndiAfterNotionalSpend = netIncome + totalNotionalSpend` directly (no
 * extra negation needed by callers).
 *
 * Pure module — no DB, no React. Reference values arrive via `ReferenceBundle`.
 */

import { calculateDerivedSavings } from '../stage2-assets'
import { getNotionalCostAmount, getFamilyCategoryMeta } from '../reference-bands'
import type { NotionalSpendInput, NotionalSpendLine, NotionalSpendResult, ReferenceBundle } from './types'

/** Looks up a notional cost, throwing if the reference bundle is missing the row (a data-integrity bug, not a business case). */
function requireNotionalCost(
  ref: ReferenceBundle,
  category: number,
  costType: Parameters<typeof getNotionalCostAmount>[2],
): number {
  const amount = getNotionalCostAmount(ref.notionalCosts, category, costType)
  if (amount === null) {
    throw new Error(
      `ReferenceBundle is missing NotionalCostConfig for category ${category}, costType ${costType}`,
    )
  }
  return amount
}

function deduction(key: NotionalSpendLine['key'], label: string, amount: number): NotionalSpendLine {
  return { key, label, direction: 'DEDUCTION', amount, signedAmount: -amount }
}

function addBack(key: NotionalSpendLine['key'], label: string, amount: number): NotionalSpendLine {
  return { key, label, direction: 'ADD_BACK', amount, signedAmount: amount }
}

/**
 * Calculates the full notional-spend block for one assessment.
 *
 * Line order mirrors the workbook (C56 → C83):
 *   1. Notional rent (C56) — deduction.
 *   2. Rent add-back (C57) — +100% for FULL_MORTGAGE_FREE / FULL_RENT_FREE,
 *      +25% for PARTIAL_LOWER_RENT, £0 for NONE.
 *   3. Multi-property rent add-back (C58) — independent +100%, assessor-judged
 *      boolean (assumption CALC-A7 — the three OR-conditions are UI helper
 *      text, not computed here).
 *   4. Notional council tax (C59) — deduction.
 *   5. Council-tax-support add-back (C60) — +100% when `councilTaxSupport`.
 *   6. Notional essentials (C62) — deduction.
 *   7. Notional car (C65/66) — deduction, only when `usesCar`.
 *   8. Notional public transport (C67/68) — deduction, only when `usesPublicTransport`.
 *   9. JWF Bursary Recipient Allowance (C70) — deduction, always applied.
 *   10. Notional savings benchmark (C78) — deduction, always applied.
 *   11. Savings test add-back (C80/C81) — `max(0, adjustedSavings −
 *       derivedYearlyDebtRepayments − notionalSavingsBenchmark)`.
 *   12. Fee-insurance add-back (C83) — the full `feeInsuranceAnnual`.
 */
export function calculateNotionalSpend(
  input: NotionalSpendInput,
  ref: ReferenceBundle,
): NotionalSpendResult {
  const { familyTypeCategory: category } = input

  const rentAmount = requireNotionalCost(ref, category, 'RENT')
  const councilTaxAmount = requireNotionalCost(ref, category, 'COUNCIL_TAX')
  const essentialsAmount = requireNotionalCost(ref, category, 'ESSENTIALS')
  const carAmount = requireNotionalCost(ref, category, 'CAR')
  const publicTransportAmount = requireNotionalCost(ref, category, 'PUBLIC_TRANSPORT')
  const jwfAllowanceAmount = requireNotionalCost(ref, category, 'JWF_ALLOWANCE')
  const notionalSavingsBenchmarkAmount = requireNotionalCost(ref, category, 'NOTIONAL_SAVINGS')

  // ── C56/C57 — rent + primary add-back ──────────────────────────────────
  const rentLine = deduction('rent', 'Notional rent (C56)', rentAmount)
  let rentAddBackAmount = 0
  switch (input.rentAddBackType) {
    case 'FULL_MORTGAGE_FREE':
    case 'FULL_RENT_FREE':
      rentAddBackAmount = rentAmount
      break
    case 'PARTIAL_LOWER_RENT':
      rentAddBackAmount = rentAmount * 0.25
      break
    case 'NONE':
    default:
      rentAddBackAmount = 0
  }
  const rentAddBackLine = addBack('rentAddBack', 'Rent add-back (C57)', rentAddBackAmount)

  // ── C58 — independent multi-property add-back ──────────────────────────
  const multiPropertyAddBackAmount = input.multiPropertyRentAddBack ? rentAmount : 0
  const multiPropertyRentAddBackLine = addBack(
    'multiPropertyRentAddBack',
    'Multi-property rent add-back (C58)',
    multiPropertyAddBackAmount,
  )

  // ── C59/C60 — council tax + support add-back ────────────────────────────
  const councilTaxLine = deduction('councilTax', 'Notional council tax (C59)', councilTaxAmount)
  const councilTaxAddBackAmount = input.councilTaxSupport ? councilTaxAmount : 0
  const councilTaxAddBackLine = addBack(
    'councilTaxAddBack',
    'Council tax support add-back (C60)',
    councilTaxAddBackAmount,
  )

  // ── C62 — essentials ─────────────────────────────────────────────────────
  const essentialsLine = deduction('essentials', 'Notional essentials (C62)', essentialsAmount)

  // ── C65–C68 — transportation, only when the relevant flag is set ───────
  const carLine = deduction('car', 'Notional car (C65/66)', input.usesCar ? carAmount : 0)
  const publicTransportLine = deduction(
    'publicTransport',
    'Notional public transport (C67/68)',
    input.usesPublicTransport ? publicTransportAmount : 0,
  )

  // ── C70 — JWF Bursary Recipient Allowance, always applied ──────────────
  const jwfAllowanceLine = deduction(
    'jwfAllowance',
    'JWF Bursary Recipient Allowance (C70)',
    jwfAllowanceAmount,
  )

  // ── C72–C81 — savings adjustment ────────────────────────────────────────
  const schoolAgeChildrenCount =
    input.schoolAgeChildrenCount ?? getFamilyCategoryMeta(ref.familyCategoryMetas, category)?.schoolAgeChildren ?? 0

  const adjustedSavings = calculateDerivedSavings(
    input.cashSavings,
    input.isasPepsShares,
    schoolAgeChildrenCount,
    input.schoolingYearsRemaining,
  )

  const notionalSavingsBenchmarkLine = deduction(
    'notionalSavingsBenchmark',
    'Notional savings benchmark (C78)',
    notionalSavingsBenchmarkAmount,
  )

  // C80 — signed, NOT floored (kept for the `savingsTestNumber` snapshot column).
  const savingsTestNumber =
    adjustedSavings - input.derivedYearlyDebtRepayments - notionalSavingsBenchmarkAmount
  // C81 — add back only if positive.
  const savingsTestAddBackLine = addBack(
    'savingsTestAddBack',
    'Savings test add-back (C81)',
    Math.max(0, savingsTestNumber),
  )

  // ── C83 — school-fees insurance, added back in full ─────────────────────
  const feeInsuranceAddBackLine = addBack(
    'feeInsuranceAddBack',
    'School-fees insurance add-back (C83)',
    Math.max(0, input.feeInsuranceAnnual),
  )

  const lines: NotionalSpendLine[] = [
    rentLine,
    rentAddBackLine,
    multiPropertyRentAddBackLine,
    councilTaxLine,
    councilTaxAddBackLine,
    essentialsLine,
    carLine,
    publicTransportLine,
    jwfAllowanceLine,
    notionalSavingsBenchmarkLine,
    savingsTestAddBackLine,
    feeInsuranceAddBackLine,
  ]

  // C85 — signed total.
  const totalNotionalSpend = lines.reduce((sum, line) => sum + line.signedAmount, 0)
  // C87.
  const ndiAfterNotionalSpend = input.netIncome + totalNotionalSpend

  return {
    lines,
    adjustedSavings,
    savingsTestNumber,
    totalNotionalSpend,
    ndiAfterNotionalSpend,
  }
}
