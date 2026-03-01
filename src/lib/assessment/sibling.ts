/**
 * WP-08: Assessment Engine — Sibling Deductions
 *
 * Applies sibling income absorption for sequential bursary assessment.
 * Each older sibling's payable fees are deducted from the family's HNDI
 * before calculating the younger child's bursary.
 * Pure function — no side effects, no DB or UI dependencies.
 */

/**
 * Applies sibling payable fee deductions to the family HNDI.
 *
 * For each sibling (in order): hndiAfterNS = hndiAfterNS - siblingFee
 *
 * This models the sequential income absorption where older siblings'
 * fees reduce the HNDI available for younger siblings' assessment.
 *
 * @param hndiAfterNS       Family HNDI after Stage 3 living costs
 * @param siblingPayableFees Array of payable fees for older siblings, in priority order
 * @returns Adjusted HNDI after all sibling deductions (can be negative)
 */
export function applySiblingDeductions(
  hndiAfterNS: number,
  siblingPayableFees: number[],
): number {
  return siblingPayableFees.reduce((hndi, siblingFee) => hndi - siblingFee, hndiAfterNS)
}
