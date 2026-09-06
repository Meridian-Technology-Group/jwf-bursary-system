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
          select: { id: true, status: true, childName: true },
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
          // Epic 13 (D13-1a): the account no longer carries a reference, so
          // audit context names the child instead — the account's only
          // human-recognisable identifier.
          context: `Bursary account for ${account.childName} withdrawn (closed)`,
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

// ─── updateFeesAccountCodeAction — REMOVED (Epic 13, C4b / D13-1a) ────────────
//
// CALC-10's fees-account code lived on `BursaryAccount.feesAccountCode` so an
// awarded account could be reconciled against the school finance system. That
// job now belongs to `Application.reference`, which C4a made free-text and
// re-editable after award for exactly this purpose — so the column, its editor
// (`components/admin/fees-account-code-field.tsx`) and this action are gone,
// along with the column itself (migration
// `20260814140000_bursary_account_drop_identifiers`).
//
// `AUDIT_ACTIONS.BURSARY_ACCOUNT_FEES_CODE_UPDATED` is deliberately KEPT in
// `src/lib/audit/actions.ts` even though nothing writes it any more: audit_logs
// is append-only, so historic rows still carry the string and would render
// unlabelled in the audit UI without it.

// ─── Epic 18b — the admin-page manual close, with a structured reason ─────────

export interface CloseBursaryAccountInput {
  bursaryAccountId: string;
  /** A live CloseReason id — her April–May leavers window always has one. */
  closeReasonId: string;
  /** The application whose admin page hosted the button (for revalidation). */
  applicationId: string;
}

export type CloseBursaryAccountResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Epic 18b — close an ACTIVE bursary account from the Assessment Admin page,
 * recording a structured close reason ("I need on the admin page, a button to
 * close the 'active bursary account' and I will need to select a closing
 * reason"). ADMIN only, like the application close it mirrors. Closing revokes
 * the parent's portal access via the status-keyed guard; the existing
 * `reopenAccountForAssessmentYear` remains the sanctioned way back.
 */
export async function closeBursaryAccountAction(
  input: CloseBursaryAccountInput
): Promise<CloseBursaryAccountResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const account = await tx.bursaryAccount.findUnique({
          where: { id: input.bursaryAccountId },
          select: { id: true, status: true, childName: true },
        });
        if (!account) {
          return { success: false as const, error: "Bursary account not found." };
        }
        if (account.status === "CLOSED") {
          return { success: false as const, error: "This account is already closed." };
        }

        const reason = await tx.closeReason.findUnique({
          where: { id: input.closeReasonId },
          select: { id: true, label: true, isDeprecated: true },
        });
        if (!reason || reason.isDeprecated) {
          return { success: false as const, error: "Close reason not found." };
        }

        await tx.bursaryAccount.update({
          where: { id: account.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            closeReasonId: reason.id,
          },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.BURSARY_ACCOUNT_CLOSED,
          entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
          entityId: account.id,
          context: `Bursary account for ${account.childName} closed: ${reason.label}`,
          metadata: { accountId: account.id, closeReasonId: reason.id },
        });

        return { success: true as const };
      }
    );

    if (result.success) {
      revalidatePath(`/applications/${input.applicationId}/assessment/admin`);
      revalidatePath(`/applications/${input.applicationId}`);
    }
    return result;
  } catch (err) {
    console.error("[closeBursaryAccountAction]", err);
    return { success: false, error: "Failed to close the bursary account." };
  }
}
