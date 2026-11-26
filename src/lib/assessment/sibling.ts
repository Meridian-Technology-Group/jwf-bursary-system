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

/**
 * CH-53 — the sibling fees the assessor typed into the three fixed sibling rows
 * (`Assessment.siblingDetails`). Only positive figures count: unfilled slots
 * arrive as `{}` or with a null fee and must not become £0 deductions.
 */
export function typedSiblingFees(siblingDetails: unknown): number[] {
  if (!Array.isArray(siblingDetails)) return []
  return siblingDetails
    .map((d) => Number((d as { netPayableFees?: unknown } | null)?.netPayableFees ?? 0))
    .filter((fee) => Number.isFinite(fee) && fee > 0)
}

/**
 * CH-53 — what the assessor typed wins when anything is typed; otherwise the
 * LINKED sibling accounts' fees. Never both: a sibling that is linked and typed
 * would be counted twice. Shared by the model form and the sibling-block save
 * so the two can't drift.
 */
export function siblingFeesForCalc(typed: number[], linked: number[]): number[] {
  return typed.length ? typed : linked
}
