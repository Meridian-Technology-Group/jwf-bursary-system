/**
 * WP-08: Assessment Engine — Stage 2: Net Assets Yearly Valuation
 *
 * Applies housing, council tax, and savings adjustments to household income.
 * Pure function — no side effects, no DB or UI dependencies.
 */

import type { SavingsInput } from './types'

/**
 * Calculates the annualised derived savings contribution.
 *
 * Formula: (cashSavings + isasPepsShares) / schoolAgeChildrenCount / schoolingYearsRemaining
 *
 * Returns 0 if either divisor is zero or negative to prevent division by zero.
 */
export function calculateDerivedSavings(
  cashSavings: number,
  isasPepsShares: number,
  schoolAgeChildrenCount: number,
  schoolingYearsRemaining: number,
): number {
  if (schoolAgeChildrenCount <= 0 || schoolingYearsRemaining <= 0) {
    return 0
  }
  return (cashSavings + isasPepsShares) / schoolAgeChildrenCount / schoolingYearsRemaining
}

/**
 * Calculates the Net Assets Yearly Valuation (Stage 2).
 *
 * Step-by-step:
 *  1. Start with total household income from Stage 1.
 *  2. Deduct notional rent.
 *  3. If mortgage-free, add notional rent back (effectively no rent deduction).
 *  4. If additional property income, add it.
 *  5. Deduct council tax.
 *  6. Calculate annualised savings and add to result.
 *
 * @returns Net assets yearly valuation (can be negative).
 */
export function calculateNetAssets(
  income: number,
  notionalRent: number,
  isMortgageFree: boolean,
  additionalPropertyIncome: number,
  councilTax: number,
  savings: SavingsInput,
): number {
  let result = income

  // Deduct notional rent
  result = result - notionalRent

  // Mortgage-free families add the rent back (they have no rent obligation)
  if (isMortgageFree) {
    result = result + notionalRent
  }

  // Additional property income
  if (additionalPropertyIncome > 0) {
    result = result + additionalPropertyIncome
  }

  // Deduct council tax
  result = result - councilTax

  // Annualised savings contribution
  const derivedSavings = calculateDerivedSavings(
    savings.cashSavings,
    savings.isasPepsShares,
    savings.schoolAgeChildrenCount,
    savings.schoolingYearsRemaining,
  )
  result = result + derivedSavings

  return result
}
