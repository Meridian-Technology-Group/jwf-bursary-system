"use server";

/**
 * Assessment qualitative-notes server actions.
 *
 * Epic 06 collapses the six checklist tabs + the recommendation
 * familySynopsis/summary into a single `Assessment.synopsis`. `saveSynopsis`
 * is the new writer. `saveChecklistNotes` is retained for one release for any
 * in-flight saves and is removed at the Epic 08 cutover.
 *
 * Both require ADMIN/ASSESSOR, write an audit entry, and revalidate the
 * assessment path. Neither carries a status guard — the synopsis is
 * deliberately EDITABLE AFTER the assessment is COMPLETED (plan §5.2 / §5.3);
 * the read-only behaviour lives entirely in the client.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import type { ChecklistTab } from "@prisma/client";

// ─── Save Synopsis (Epic 06) ──────────────────────────────────────────────────

/**
 * Upserts the single `Assessment.synopsis` narrative. Permissive by design:
 * there is NO status guard, so the synopsis can be edited even after the
 * assessment is COMPLETED. An empty/whitespace-only value is stored as NULL.
 */
export async function saveSynopsis(
  assessmentId: string,
  applicationId: string,
  synopsis: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    const value = synopsis.trim().length > 0 ? synopsis : null;

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await tx.assessment.update({
        where: { id: assessmentId },
        data: { synopsis: value },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ASSESSMENT_SYNOPSIS_SAVE,
        entityType: AUDIT_ENTITY_TYPES.Assessment,
        entityId: assessmentId,
        context: "Assessment synopsis saved",
        metadata: {
          assessmentId,
          applicationId,
          synopsisLength: value?.length ?? 0,
        },
      });
    });

    // The synopsis renders in both the assessment workspace and on the
    // recommendation screen, so revalidate both.
    revalidatePath(`/applications/${applicationId}/assessment`);
    revalidatePath(`/applications/${applicationId}/recommendation`);

    return { success: true };
  } catch (err) {
    console.error("[saveSynopsis]", err);
    return { success: false, error: "Failed to save synopsis." };
  }
}

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
