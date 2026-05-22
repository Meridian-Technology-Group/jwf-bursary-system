/**
 * Shared helper for generating BursaryAccount reference numbers.
 *
 * Format: BA-{academicYearDigits}-{padded sequence}
 * Example: BA-20252026-0001
 *
 * The academic year digits are the round's academicYear with the slash
 * stripped (e.g. "2025/2026" -> "20252026"). The sequence is 1-based and
 * counts existing bursary accounts for that academic year, then zero-pads
 * to four digits. Mirrors generateApplicationReference.
 */

import type { Tx } from "@/lib/db/prisma";

/**
 * Generates the next available BursaryAccount reference for the given
 * academic year.
 *
 * @param tx           - RLS-aware transaction (from withUserContext/withAdminContext)
 * @param academicYear - Round.academicYear value, e.g. "2025/2026"
 */
export async function generateBursaryAccountReference(
  tx: Tx,
  academicYear: string
): Promise<string> {
  const yearDigits = academicYear.replace(/\//g, "");
  const prefix = `BA-${yearDigits}-`;

  const existing = await tx.bursaryAccount.count({
    where: { reference: { startsWith: prefix } },
  });

  return `${prefix}${String(existing + 1).padStart(4, "0")}`;
}
