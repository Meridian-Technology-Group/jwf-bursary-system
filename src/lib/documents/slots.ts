/**
 * Document slot utilities — shared between server and client code.
 *
 * Extracted from the "use server" actions file so that synchronous helpers
 * can be imported by client components without violating the Next.js
 * constraint that all exports from a "use server" module must be async.
 */

// ─── Document slot registry ───────────────────────────────────────────────────

/**
 * All document slot identifiers defined in the Prisma schema.
 * Kept here as the canonical source of truth; imported by:
 *   - missing-docs-dialog.tsx  (checkbox list)
 *   - admin-upload.tsx         (slot selector dropdown)
 *   - actions.ts               (email formatting)
 */
export const ALL_DOCUMENT_SLOTS = [
  "BIRTH_CERTIFICATE",
  "UK_PASSPORT_PARENT_1",
  "PASSPORT_PARENT_1",
  "UK_PASSPORT_PARENT_2",
  "PASSPORT_PARENT_2",
  "P60_PARENT_1",
  "P60_PARENT_2",
  "SELF_ASSESSMENT_PARENT_1",
  "SELF_ASSESSMENT_PARENT_2",
  "BENEFITS_EVIDENCE_PARENT_1",
  "BENEFITS_EVIDENCE_PARENT_2",
  "CAPITAL_REPAYMENTS_PARENT_1",
  "CAPITAL_REPAYMENTS_PARENT_2",
  "P45_PARENT_1",
  "P45_PARENT_2",
  "REDUNDANCY_PARENT_1",
  "REDUNDANCY_PARENT_2",
  "EMPLOYMENT_P45_PARENT_1",
  "EMPLOYMENT_P45_PARENT_2",
  "EMPLOYMENT_REDUNDANCY_PARENT_1",
  "EMPLOYMENT_REDUNDANCY_PARENT_2",
  "COUNCIL_TAX",
  // Assets & Liabilities — property
  "MAIN_MORTGAGE_STATEMENT",
  "TENANCY_AGREEMENT",
  "HOUSING_BENEFIT_LETTER",
  "RELATIVE_LETTER",
  // Assets & Liabilities — car
  "CAR_LEASE_AGREEMENT",
  // Assets & Liabilities — financial: bank statements (current + savings) + investments
  "BANK_STATEMENT_CURRENT_PARENT_1",
  "BANK_STATEMENT_CURRENT_PARENT_2",
  "BANK_STATEMENT_SAVINGS_PARENT_1",
  "BANK_STATEMENT_SAVINGS_PARENT_2",
  "INVESTMENT_PARENT_1",
  "INVESTMENT_PARENT_2",
  // Assets & Liabilities — debt
  "CREDIT_CARD_STATEMENT",
  "LOAN_STATEMENT",
  "OTHER_DEBT_DOCUMENT",
] as const;

export type DocumentSlot = (typeof ALL_DOCUMENT_SLOTS)[number];

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Converts a SCREAMING_SNAKE_CASE document slot name to a human-readable label.
 * e.g. "BIRTH_CERTIFICATE" → "Birth Certificate"
 *      "P60_PARENT_1"      → "P60 Parent 1"
 */
export function humaniseSlot(slot: string): string {
  return slot
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
