"use server";

/**
 * ASSESSMENT ADMIN tab actions — Epic 14 C8.
 *
 * `savePreSystemHistoryAction` writes the LA-7 manual pre-system YoY rows
 * onto the bursary account (`preSystemHistory` JSONB). Display data only —
 * never a calculation input (D14-4). ADMIN/ASSESSOR only; audited.
 */

import { z } from "zod";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { revalidatePath } from "next/cache";

const RowSchema = z.object({
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{2}$/, "Academic year must look like 2023/24"),
  netIncome: z.number().finite().nullable().optional(),
  savings: z.number().finite().nullable().optional(),
  propertyEquity: z.number().finite().nullable().optional(),
  debtExposure: z.number().finite().nullable().optional(),
  livingArrangement: z.string().trim().max(120).nullable().optional(),
  lifestyleSqueeze: z.string().trim().max(200).nullable().optional(),
});

const RowsSchema = z.array(RowSchema).max(30);

export interface SavePreSystemHistoryResult {
  success: boolean;
  error?: string;
}

export async function savePreSystemHistoryAction(
  bursaryAccountId: string,
  applicationId: string,
  rows: unknown
): Promise<SavePreSystemHistoryResult> {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

  const parsed = RowsSchema.safeParse(rows);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid history rows.",
    };
  }

  // Blank rows (a year with no values at all) are dropped rather than stored.
  const cleaned = parsed.data.filter(
    (r) =>
      r.netIncome != null ||
      r.savings != null ||
      r.propertyEquity != null ||
      r.debtExposure != null ||
      (r.livingArrangement ?? "") !== "" ||
      (r.lifestyleSqueeze ?? "") !== ""
  );

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await tx.bursaryAccount.update({
        where: { id: bursaryAccountId },
        data: { preSystemHistory: cleaned.length > 0 ? cleaned : undefined },
      });
      if (cleaned.length === 0) {
        // Explicit clear.
        await tx.bursaryAccount.update({
          where: { id: bursaryAccountId },
          data: { preSystemHistory: [] },
        });
      }
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_SAVE,
        entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
        entityId: bursaryAccountId,
        context: "Pre-system YoY history rows updated (Assessment Admin tab)",
        metadata: { rowCount: cleaned.length, applicationId },
      });
    });
  } catch (err) {
    console.error("[savePreSystemHistoryAction]", err);
    return { success: false, error: "Failed to save the history rows." };
  }

  revalidatePath(`/applications/${applicationId}/assessment/admin`);
  return { success: true };
}
