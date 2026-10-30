/**
 * Epic 22 P4 — the family's ACTIVE bursary accounts, for the home page's
 * children list and the active-bursary count (P5's schedule headings reuse it).
 *
 * Runs under the parent's own RLS context: an applicant reads only accounts
 * they lead. CLOSED accounts are left out, as on every parent page.
 */

import type { Tx } from "@/lib/db/prisma";

export async function getFamilyAccountsForUser(tx: Tx, userId: string) {
  return tx.bursaryAccount.findMany({
    where: { leadApplicantId: userId, status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      childName: true,
      school: true,
      entryYearGroup: true,
      firstAssessmentYear: true,
    },
  });
}

export type FamilyAccount = Awaited<ReturnType<typeof getFamilyAccountsForUser>>[number];
