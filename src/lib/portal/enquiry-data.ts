/**
 * Epic 22 P2 — the "Which child is this about?" options for a login, read
 * under the parent's own RLS context (their accounts and applications only).
 * Used by both the page and the send action, so the action can only ever
 * accept one of the parent's own children.
 */

import "server-only";

import type { CurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { enquiryChildOptions, type EnquiryChildOption } from "@/lib/portal/enquiry";

export async function loadEnquiryChildOptions(
  user: CurrentUser
): Promise<EnquiryChildOption[]> {
  return withUserContext(user.id, user.role as RlsRole, async (tx) => {
    const [accounts, applications] = await Promise.all([
      tx.bursaryAccount.findMany({
        where: { leadApplicantId: user.id, status: "ACTIVE" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, childName: true },
      }),
      tx.application.findMany({
        // Migrated applications included on purpose: their reference is the
        // family's fees code.
        where: { leadApplicantId: user.id, archivedAt: null },
        orderBy: { updatedAt: "asc" },
        select: {
          id: true,
          childName: true,
          reference: true,
          bursaryAccountId: true,
          updatedAt: true,
          round: { select: { academicYear: true } },
        },
      }),
    ]);
    return enquiryChildOptions(
      accounts,
      applications.map((a) => ({
        id: a.id,
        childName: a.childName,
        reference: a.reference,
        bursaryAccountId: a.bursaryAccountId,
        academicYear: a.round?.academicYear ?? null,
        updatedAt: a.updatedAt,
      }))
    );
  });
}
