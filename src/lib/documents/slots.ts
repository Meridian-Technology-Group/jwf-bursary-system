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
  "CERTIFIED_ACCOUNTS_PARENT_1",
  "CERTIFIED_ACCOUNTS_PARENT_2",
  "BANK_STATEMENT_PARENT_1",
  "BANK_STATEMENT_PARENT_2",
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
