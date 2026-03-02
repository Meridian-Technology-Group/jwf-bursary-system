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
import { prisma } from "@/lib/db/prisma";
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

    await prisma.assessmentChecklist.upsert({
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

    await createAuditLog({
      userId: user.id,
      action: "assessment.checklist.save",
      entityType: "AssessmentChecklist",
      entityId: assessmentId,
      context: `Checklist notes saved for tab ${tab}`,
      metadata: { assessmentId, applicationId, tab, notesLength: notes.length },
    });

    revalidatePath(`/applications/${applicationId}/assessment`);

    return { success: true };
  } catch (err) {
    console.error("[saveChecklistNotes]", err);
    return { success: false, error: "Failed to save checklist notes." };
  }
}
