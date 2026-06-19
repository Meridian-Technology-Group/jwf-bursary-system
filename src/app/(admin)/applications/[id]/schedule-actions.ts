"use server";

/**
 * Epic 10 (PR-7) — admin forward-schedule grid actions.
 *
 * Two ADMIN-gated mutations over a rolling account's schedule:
 *   - regenerateScheduleAction  — re-runs generateSchedule (idempotent: only
 *     inserts missing future years, never duplicates or rewrites RECEIVED rows).
 *   - toggleScheduleShowOnPortalAction — flips a single row's Show/Hide-on-portal
 *     flag (the illustration's per-row Action; Epic 05 reads it for the parent).
 *
 * Both run under withUserContext (the actor's RLS), audited, and revalidate the
 * application detail path. `applicationId` is the page the grid is rendered on;
 * the action resolves the owning account from it.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { generateSchedule } from "@/lib/bursary-accounts/schedule";

export type ScheduleActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Regenerate (top-up) the forward schedule for the account linked to this
 * application. ADMIN only. Idempotent — safe to click repeatedly. Resolves the
 * award round's dates from the account's `firstAssessmentYear`.
 */
export async function regenerateScheduleAction(
  applicationId: string
): Promise<ScheduleActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: { bursaryAccountId: true, reference: true },
        });
        if (!application?.bursaryAccountId) {
          return {
            success: false as const,
            error: "This application has no rolling bursary account.",
          };
        }

        const account = await tx.bursaryAccount.findUnique({
          where: { id: application.bursaryAccountId },
          select: {
            id: true,
            entryYearGroup: true,
            firstAssessmentYear: true,
            reference: true,
          },
        });
        if (!account) {
          return {
            success: false as const,
            error: "Bursary account not found.",
          };
        }

        // The award round's dates anchor the date policy. Fall back to nulls
        // (planned dates omitted) when the originating round can't be resolved.
        const round = await tx.round.findUnique({
          where: { academicYear: account.firstAssessmentYear },
          select: { academicYear: true, openDate: true, closeDate: true },
        });

        const gen = await generateSchedule(tx, account, {
          academicYear: account.firstAssessmentYear,
          openDate: round?.openDate ?? null,
          closeDate: round?.closeDate ?? null,
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.SCHEDULE_REGENERATED,
          entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
          entityId: account.id,
          context: `Regenerated schedule for account ${account.reference} (${gen.created} added, ${gen.skipped} kept)`,
          metadata: {
            horizon: gen.horizon,
            created: gen.created,
            skipped: gen.skipped,
          },
        });

        return { success: true as const };
      }
    );

    if (result.success) revalidatePath(`/applications/${applicationId}`);
    return result;
  } catch (err) {
    console.error("[regenerateScheduleAction]", err);
    return { success: false, error: "Failed to regenerate the schedule." };
  }
}

/**
 * Toggle a single schedule row's Show/Hide-on-portal flag. ADMIN only. The
 * entry's account must match the application's account (defence-in-depth so the
 * action can't flip an unrelated account's row).
 */
export async function toggleScheduleShowOnPortalAction(
  applicationId: string,
  scheduleEntryId: string,
  showOnPortal: boolean
): Promise<ScheduleActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const result = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: { bursaryAccountId: true },
        });
        if (!application?.bursaryAccountId) {
          return {
            success: false as const,
            error: "This application has no rolling bursary account.",
          };
        }

        const entry = await tx.bursaryScheduleEntry.findUnique({
          where: { id: scheduleEntryId },
          select: {
            id: true,
            bursaryAccountId: true,
            scheduleYear: true,
            academicYear: true,
          },
        });
        if (!entry || entry.bursaryAccountId !== application.bursaryAccountId) {
          return {
            success: false as const,
            error: "Schedule entry not found for this account.",
          };
        }

        await tx.bursaryScheduleEntry.update({
          where: { id: entry.id },
          data: { showOnPortal },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.SCHEDULE_SHOW_ON_PORTAL_TOGGLED,
          entityType: AUDIT_ENTITY_TYPES.BursaryScheduleEntry,
          entityId: entry.id,
          context: `Schedule year ${entry.scheduleYear} (${entry.academicYear}) set ${
            showOnPortal ? "visible" : "hidden"
          } on the portal`,
          metadata: {
            scheduleYear: entry.scheduleYear,
            academicYear: entry.academicYear,
            showOnPortal,
          },
        });

        return { success: true as const };
      }
    );

    if (result.success) revalidatePath(`/applications/${applicationId}`);
    return result;
  } catch (err) {
    console.error("[toggleScheduleShowOnPortalAction]", err);
    return { success: false, error: "Failed to update portal visibility." };
  }
}
