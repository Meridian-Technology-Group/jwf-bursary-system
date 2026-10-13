"use server";

/**
 * Epic 21 #6 — notes on the account's standing synopsis (D-6).
 *
 *   - addAccountSynopsisNoteAction  — ADMIN or ASSESSOR adds a free-text note.
 *   - editAccountSynopsisNoteAction — ADMIN edits a note.
 *
 * Nobody deletes an entry, and YEAR entries are edited in that year's
 * assessment (their synopsis), never here. Both are audited against the
 * application they were made from, so they show on its History tab.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

export type AccountSynopsisActionResult =
  | { success: true }
  | { success: false; error: string };

const NOTE_MAX = 5000;

function checkBody(body: string): string | null {
  const b = body.trim();
  if (!b) return "Please write the note first.";
  if (b.length > NOTE_MAX) return `Notes are limited to ${NOTE_MAX} characters.`;
  return null;
}

function revalidateAdmin(applicationId: string) {
  revalidatePath(`/applications/${applicationId}/assessment/admin`);
}

export async function addAccountSynopsisNoteAction(input: {
  applicationId: string;
  body: string;
}): Promise<AccountSynopsisActionResult> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    const bodyError = checkBody(input.body);
    if (bodyError) return { success: false, error: bodyError };

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: input.applicationId },
        select: { bursaryAccountId: true },
      });
      if (!application?.bursaryAccountId) {
        return { success: false as const, error: "This application has no bursary account." };
      }
      const entry = await tx.accountSynopsisEntry.create({
        data: {
          bursaryAccountId: application.bursaryAccountId,
          kind: "NOTE",
          body: input.body.trim(),
          createdById: user.id,
        },
        select: { id: true },
      });
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SYNOPSIS_NOTE_ADDED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: input.applicationId,
        context: "Note added to the account synopsis",
        metadata: {
          bursaryAccountId: application.bursaryAccountId,
          entryId: entry.id,
          length: input.body.trim().length,
        },
      });
      return { success: true as const };
    });

    if (result.success) revalidateAdmin(input.applicationId);
    return result;
  } catch (err) {
    console.error("[addAccountSynopsisNoteAction]", err);
    return { success: false, error: "Failed to add the note." };
  }
}

export async function editAccountSynopsisNoteAction(input: {
  applicationId: string;
  entryId: string;
  body: string;
}): Promise<AccountSynopsisActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);
    const bodyError = checkBody(input.body);
    if (bodyError) return { success: false, error: bodyError };

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: input.applicationId },
        select: { bursaryAccountId: true },
      });
      const entry = await tx.accountSynopsisEntry.findUnique({
        where: { id: input.entryId },
        select: { id: true, kind: true, bursaryAccountId: true, body: true },
      });
      // Defence-in-depth: the note must belong to this application's account.
      if (!entry || !application?.bursaryAccountId || entry.bursaryAccountId !== application.bursaryAccountId) {
        return { success: false as const, error: "Note not found for this account." };
      }
      if (entry.kind !== "NOTE") {
        return {
          success: false as const,
          error: "A year's entry is edited in that year's assessment synopsis.",
        };
      }
      await tx.accountSynopsisEntry.update({
        where: { id: entry.id },
        data: { body: input.body.trim() },
      });
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SYNOPSIS_NOTE_EDITED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: input.applicationId,
        context: "Account synopsis note edited",
        metadata: {
          bursaryAccountId: entry.bursaryAccountId,
          entryId: entry.id,
          previousLength: entry.body.length,
          length: input.body.trim().length,
        },
      });
      return { success: true as const };
    });

    if (result.success) revalidateAdmin(input.applicationId);
    return result;
  } catch (err) {
    console.error("[editAccountSynopsisNoteAction]", err);
    return { success: false, error: "Failed to save the note." };
  }
}
