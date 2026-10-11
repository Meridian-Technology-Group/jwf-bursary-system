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

// ─── S9 — the account's own annual fee (OP partnering school) ────────────────

/** Annual fees before VAT, in pounds; null clears the override. */
const AnnualFeesSchema = z.number().finite().min(0).max(100_000).nullable();

/**
 * GT migration PR-C (S9): set or clear `BursaryAccount.annualFeesOverride`.
 * The OP partnering school has no fee table, so each account carries its own
 * fee; the assessment reads it for the account's school. ADMIN only; audited
 * with the before and after figures.
 */
export async function saveAnnualFeesOverrideAction(
  bursaryAccountId: string,
  applicationId: string,
  value: unknown
): Promise<SavePreSystemHistoryResult> {
  const user = await requireRole([Role.ADMIN]);

  const parsed = AnnualFeesSchema.safeParse(value);
  if (!parsed.success) {
    return { success: false, error: "Enter annual fees between £0 and £100,000." };
  }
  const fees = parsed.data == null ? null : Math.round(parsed.data * 100) / 100;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const before = await tx.bursaryAccount.findUniqueOrThrow({
        where: { id: bursaryAccountId },
        select: { annualFeesOverride: true },
      });
      await tx.bursaryAccount.update({
        where: { id: bursaryAccountId },
        data: { annualFeesOverride: fees },
      });
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.BURSARY_ACCOUNT_FEES_OVERRIDE_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
        entityId: bursaryAccountId,
        context: "Account annual fees set on the Assessment Admin tab",
        metadata: {
          applicationId,
          before: before.annualFeesOverride == null ? null : Number(before.annualFeesOverride),
          after: fees,
        },
      });
    });
  } catch (err) {
    console.error("[saveAnnualFeesOverrideAction]", err);
    return { success: false, error: "Failed to save the annual fees." };
  }

  revalidatePath(`/applications/${applicationId}/assessment/admin`);
  revalidatePath(`/applications/${applicationId}/assessment`);
  return { success: true };
}
