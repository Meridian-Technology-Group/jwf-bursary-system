"use server";

/**
 * Epic 21 #6 (rework, 14 Oct 2026) — the account's main synopsis.
 *
 *   - saveMainSynopsisAction — ADMIN or ASSESSOR saves the one editable
 *     "Main synopsis" of the application's bursary account (creates it when
 *     the account has none).
 *
 * Every save is audited against the BURSARY ACCOUNT, so it appears on the
 * History tab of every year of that account (`getAuditLogsForApplicationHistory`).
 * The audit row records lengths, not the text: synopsis prose can name the
 * family, and `audit_logs` is append-only, so prose there would outlive an
 * erasure (same rule as ASSESSMENT_SYNOPSIS_SAVE).
 *
 * The first build's staff notes (ACCOUNT_SYNOPSIS_NOTE_ADDED/_EDITED) are
 * retired; their audit keys stay so old History entries keep their labels.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { checkMainSynopsisBody } from "@/lib/bursary-accounts/standing-synopsis";

export type MainSynopsisActionResult =
  | { success: true }
  | { success: false; error: string };

export async function saveMainSynopsisAction(input: {
  applicationId: string;
  body: string;
}): Promise<MainSynopsisActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    const checked = checkMainSynopsisBody(input.body);
    if (!checked.ok) return { success: false, error: checked.error };

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: input.applicationId },
        select: { bursaryAccountId: true },
      });
      const bursaryAccountId = application?.bursaryAccountId;
      if (!bursaryAccountId) {
        return { success: false as const, error: "This application has no bursary account." };
      }

      const existing = await tx.accountSynopsisEntry.findFirst({
        where: { bursaryAccountId, kind: "MAIN" },
        select: { id: true, body: true },
      });
      if (existing && existing.body === checked.body) {
        return { success: true as const, changed: false };
      }

      const entry = existing
        ? await tx.accountSynopsisEntry.update({
            where: { id: existing.id },
            data: { body: checked.body },
            select: { id: true },
          })
        : await tx.accountSynopsisEntry.create({
            data: {
              bursaryAccountId,
              kind: "MAIN",
              body: checked.body,
              createdById: user.id,
            },
            select: { id: true },
          });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ACCOUNT_MAIN_SYNOPSIS_SAVED,
        entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
        entityId: bursaryAccountId,
        context: existing ? "Main synopsis edited" : "Main synopsis written",
        metadata: {
          applicationId: input.applicationId,
          entryId: entry.id,
          previousLength: existing?.body.length ?? 0,
          length: checked.body.length,
        },
      });
      return { success: true as const, changed: true };
    });

    if (!result.success) return result;
    if (result.changed) {
      revalidatePath(`/applications/${input.applicationId}/assessment/admin`);
      revalidatePath(`/applications/${input.applicationId}/history`);
    }
    return { success: true };
  } catch (err) {
    console.error("[saveMainSynopsisAction]", err);
    return { success: false, error: "Failed to save the main synopsis." };
  }
}
