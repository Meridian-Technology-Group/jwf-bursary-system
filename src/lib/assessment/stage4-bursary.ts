/**
 * WP-08: Assessment Engine — Stage 4: Bursary Impact
 *
 * Calculates the required bursary award based on the family's HNDI after
 * Necessary Spend and the annual school fees.
 * Pure function — no side effects, no DB or UI dependencies.
 */

/**
 * Calculates the required bursary award.
 *
 * Formula: requiredBursary = annualFees - hndiAfterNS
 *
 * Clamped to [0, annualFees]:
 *   - If HNDI >= annualFees → requiredBursary = 0 (family can afford full fees)
 *   - If HNDI <= 0 → requiredBursary = annualFees (full bursary needed)
 *   - Otherwise → partial bursary = annualFees - hndiAfterNS
 *
 * @returns Required bursary amount, clamped to [0, annualFees].
 */
export function calculateBursaryImpact(hndiAfterNS: number, annualFees: number): number {
  const required = annualFees - hndiAfterNS

  // Clamp to [0, annualFees]
  if (required < 0) return 0
  if (required > annualFees) return annualFees

  return required
}
