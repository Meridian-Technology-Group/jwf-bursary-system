/**
 * Shared helper for generating Application reference numbers.
 *
 * Format: {schoolPrefix}-{yearSuffix}-{padded sequence}
 * Example: TS-20252026-0001  /  WS-20252026-0042
 *
 * The sequence is 1-based and counts existing applications with the same
 * school prefix, then zero-pads to four digits.
 */

import type { Tx } from "@/lib/db/prisma";

/**
 * Generates the next available Application reference for the given school and
 * academic year.
 *
 * @param tx           - RLS-aware transaction (from withUserContext/withAdminContext)
 * @param school       - Prisma School enum value ("TRINITY" | "WHITGIFT")
 * @param academicYear - Round.academicYear value, e.g. "2025/2026"
 */
export async function generateApplicationReference(
  tx: Tx,
  school: string,
  academicYear: string
): Promise<string> {
  const schoolPrefix = school === "TRINITY" ? "TS" : "WS";
  const yearSuffix = academicYear.replace(/\//g, "");

  const existing = await tx.application.count({
    where: { reference: { startsWith: `${schoolPrefix}-` } },
  });

  return `${schoolPrefix}-${yearSuffix}-${String(existing + 1).padStart(4, "0")}`;
}

// ─── Reference edit validation (item 11) ───────────────────────────────────────

export type ReferenceValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates a candidate bursary reference for an edit (Story 11.1/11.2).
 *
 * References are required and have no format restriction — whitespace and
 * special characters are significant and preserved verbatim, so this only
 * rejects a value that is empty/whitespace-only. It does NOT trim the value
 * for storage; the caller persists `value` exactly as given.
 */
export function validateReferenceInput(value: string): ReferenceValidationResult {
  if (value.trim() === "") {
    return { valid: false, error: "Bursary reference cannot be blank." };
  }
  return { valid: true };
}
