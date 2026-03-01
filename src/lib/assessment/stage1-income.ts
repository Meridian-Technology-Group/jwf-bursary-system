/**
 * WP-08: Assessment Engine — Stage 1: Household Income
 *
 * Sums applicable income fields across all earners.
 * benefitsExcluded is NOT added to income (recorded for reference only).
 * Pure function — no side effects, no DB or UI dependencies.
 */

import type { EarnerInput } from './types'

/**
 * Calculates the total household net income across all earners.
 *
 * For each earner the included income streams are:
 *   netPay + netDividends + netSelfEmployedProfit + pensionAmount + benefitsIncluded
 *
 * NOTE: benefitsExcluded (child disability benefits) is explicitly excluded.
 *
 * @returns Total household net income, clamped to a minimum of 0.
 */
export function calculateHouseholdIncome(earners: EarnerInput[]): number {
  const total = earners.reduce((sum, earner) => {
    const earnerIncome =
      earner.netPay +
      earner.netDividends +
      earner.netSelfEmployedProfit +
      earner.pensionAmount +
      earner.benefitsIncluded
    return sum + earnerIncome
  }, 0)

  return Math.max(0, total)
}
