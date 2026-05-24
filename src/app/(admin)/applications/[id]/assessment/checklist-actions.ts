"use server";

/**
 * WP-16: Assessment Checklist Server Actions
 *
 * Handles upsert of qualitative checklist notes for a specific tab.
 * Requires ASSESSOR role. Creates audit log entry and revalidates the
 * assessment path so the server component re-fetches fresh data.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import type { ChecklistTab } from "@prisma/client";

// ─── Save Checklist Notes ─────────────────────────────────────────────────────

export async function saveChecklistNotes(
  assessmentId: string,
  tab: ChecklistTab,
  notes: string,
  applicationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await tx.assessmentChecklist.upsert({
        where: {
          assessmentId_tab: {
            assessmentId,
            tab,
          },
        },
        update: {
          notes,
        },
        create: {
          assessmentId,
          tab,
          notes,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_CHECKLIST_SAVE,
        entityType: AUDIT_ENTITY_TYPES.AssessmentChecklist,
        entityId: assessmentId,
        context: `Checklist notes saved for tab ${tab}`,
        metadata: { assessmentId, applicationId, tab, notesLength: notes.length },
      });
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[saveChecklistNotes]", err);
    return { success: false, error: "Failed to save checklist notes." };
  }
}
