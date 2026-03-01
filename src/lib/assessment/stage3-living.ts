/**
 * WP-08: Assessment Engine — Stage 3: Living Costs (HNDI after Necessary Spend)
 *
 * Deducts utility and food costs from net assets to produce the
 * Household Net Disposable Income after Necessary Spend (HNDI-NS).
 * Pure function — no side effects, no DB or UI dependencies.
 */

/**
 * Calculates HNDI after Necessary Spend.
 *
 * Formula: hndiAfterNS = netAssets - utilityCosts - foodCosts
 *
 * A negative result means the family's necessary living costs exceed their
 * available net assets — they require a full bursary.
 *
 * @returns HNDI after necessary spend (can be negative).
 */
export function calculateLivingCosts(
  netAssets: number,
  utilityCosts: number,
  foodCosts: number,
): number {
  return netAssets - utilityCosts - foodCosts
}
