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
