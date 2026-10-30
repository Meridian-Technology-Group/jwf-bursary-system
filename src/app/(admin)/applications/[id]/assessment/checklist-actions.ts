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
 * assessment path. The synopsis is deliberately EDITABLE AFTER the assessment
 * is COMPLETED (plan §5.2 / §5.3), but since Epic 21 #6 (rework, 14 Oct 2026)
 * it LOCKS with the assessment: `saveSynopsis` refuses once the assessment is
 * in a post-assessment final state (`isSynopsisLocked`). The account's main
 * synopsis is the box that stays editable across years.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import type { ChecklistTab } from "@prisma/client";
import {
  isSynopsisLocked,
  SYNOPSIS_LOCKED_MESSAGE,
} from "@/lib/bursary-accounts/standing-synopsis";

// ─── Save Synopsis (Epic 06) ──────────────────────────────────────────────────

/**
 * Upserts the single `Assessment.synopsis` narrative. Editable while the
 * assessment is worked and once stored as complete; refused once it is locked
 * (NEW_AWARD, ROLLED_OVER, WAITING_LIST, CLOSED_ARCHIVED — Epic 21 #6 rework).
 * The client renders the box read-only then; this is the rule. An
 * empty/whitespace-only value is stored as NULL.
 */
export async function saveSynopsis(
  assessmentId: string,
  applicationId: string,
  synopsis: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
    const value = synopsis.trim().length > 0 ? synopsis : null;

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const current = await tx.assessment.findUnique({
        where: { id: assessmentId },
        select: { status: true },
      });
      if (!current) {
        return { success: false as const, error: "Assessment not found." };
      }
      if (isSynopsisLocked(current.status)) {
        return { success: false as const, error: SYNOPSIS_LOCKED_MESSAGE };
      }

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
      return { success: true as const };
    });
    if (!result.success) return result;

    // The synopsis renders in both the assessment workspace and on the
    // recommendation screen, so revalidate both.
    revalidatePath(`/applications/${applicationId}/assessment`);
    revalidatePath(`/applications/${applicationId}/recommendation`);
    revalidatePath(`/applications/${applicationId}/assessment/admin`);

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
