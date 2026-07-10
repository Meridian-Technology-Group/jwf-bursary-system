"use server";

/**
 * F1 — admin/assessor manual bursary-account withdrawal (canonical model §5/§7.7).
 *
 * An assessor or admin may close (withdraw) a bursary account at any time, at
 * the account level, with NO documents required and NO schedule/state gate. This
 * is the manual counterpart to the automatic `closeAccountIfComplete`
 * (lib/bursary-accounts/lifecycle.ts) — the docstring there points here.
 *
 * Closing sets `status = CLOSED` + `closedAt = now`, which in turn revokes the
 * parent's portal access via the access guard (lib/bursary-accounts/access.ts):
 * a parent whose only account is CLOSED, with no in-flight application, loses
 * access automatically. The transition is idempotent — withdrawing an already-
 * CLOSED account is a no-op that does NOT rewrite `closedAt`.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

export interface WithdrawBursaryAccountInput {
  accountId: string;
  /** Required free-text reason — captured in the confirm dialog, stored in audit. */
  reason: string;
  /** The application detail page the control was triggered from (for revalidation). */
  applicationId: string;
}

export type WithdrawBursaryAccountResult =
  | { success: true; alreadyClosed: boolean }
  | { success: false; error: string };

/**
 * Close (withdraw) a bursary account at account level. ADMIN/ASSESSOR only.
 * Allowed in ANY state — no schedule, document, or lifecycle gate. Idempotent:
 * a CLOSED account stays CLOSED and `closedAt` is never rewritten.
 */
/**
 * @deprecated Item 2 (unified close): the UI affordances that called this were
 * replaced by `closeApplication` / CloseApplicationDialog, which closes the
 * application AND its live account under a structured close reason. Kept for
 * any in-flight callers; do not add new call sites.
 */
export async function withdrawBursaryAccount(
  input: WithdrawBursaryAccountInput
): Promise<WithdrawBursaryAccountResult> {
  const reason = input.reason?.trim();
  if (!reason) {
    return { success: false, error: "A reason for withdrawal is required." };
  }

  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const account = await tx.bursaryAccount.findUnique({
          where: { id: input.accountId },
          select: { id: true, status: true, reference: true },
        });
        if (!account) {
          return { success: false as const, error: "Bursary account not found." };
        }

        // Idempotent: already CLOSED → no-op, do not rewrite closedAt.
        if (account.status === "CLOSED") {
          return { success: true as const, alreadyClosed: true };
        }

        await tx.bursaryAccount.update({
          where: { id: account.id },
          data: { status: "CLOSED", closedAt: new Date() },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.BURSARY_ACCOUNT_WITHDRAWN,
          entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
          entityId: account.id,
          context: `Bursary account ${account.reference} withdrawn (closed)`,
          metadata: { accountId: account.id, reason },
        });

        return { success: true as const, alreadyClosed: false };
      }
    );

    if (result.success) revalidatePath(`/applications/${input.applicationId}`);
    return result;
  } catch (err) {
    console.error("[withdrawBursaryAccount]", err);
    return { success: false, error: "Failed to withdraw the bursary account." };
  }
}

// ─── updateFeesAccountCodeAction (CALC-10) ────────────────────────────────────

/**
 * CALC-10 — recipient's fees-account code (workbook §3.16 "Assessor's
 * wizard" admin page). A small free-text field on the bursary account,
 * ADMIN/ASSESSOR-editable, no lifecycle-state gate. Also displayed
 * (read-only) on the assessment page's header context. Blank input clears
 * the field (stored as `null`).
 */
export async function updateFeesAccountCodeAction(
  accountId: string,
  applicationId: string,
  feesAccountCode: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    const value = feesAccountCode.trim().length > 0 ? feesAccountCode.trim() : null;

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const account = await tx.bursaryAccount.findUnique({
        where: { id: accountId },
        select: { id: true, reference: true },
      });
      if (!account) {
        return { success: false as const, error: "Bursary account not found." };
      }

      await tx.bursaryAccount.update({
        where: { id: accountId },
        data: { feesAccountCode: value },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.BURSARY_ACCOUNT_FEES_CODE_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
        entityId: account.id,
        context: `Fees account code updated for ${account.reference}`,
        metadata: { accountId: account.id, feesAccountCode: value },
      });

      return { success: true as const };
    });

    if (!result.success) return result;

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[updateFeesAccountCodeAction]", err);
    return { success: false, error: "Failed to update the fees account code." };
  }
}
