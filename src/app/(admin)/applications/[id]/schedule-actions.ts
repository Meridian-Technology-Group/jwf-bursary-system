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
 *
 * Epic 21 #4 adds two more, on the ASSESSMENT ADMIN tab (her conditional
 * bursary: "delete the remaining schedule of scheduled future assessments",
 * and "add back an extra year" if the headmaster changes his mind):
 *   - endScheduleAfterYearAction — deletes the later SCHEDULED years and
 *     records `scheduleEndYear` so nothing regrows them. The account stays
 *     ACTIVE (D-5) and closes as today once its last year completes.
 *   - addScheduleYearAction — re-adds the next year (never past the natural
 *     horizon) and re-opens a CLOSED account.
 * Both require a reason and are audited against the application they were
 * made from, so they show on its History tab.
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  generateSchedule,
  planAddYear,
  planEndAfterYear,
  planSchedule,
  resolveScheduleHorizon,
  roundDatesForAccount,
  findThisYearRow,
} from "@/lib/bursary-accounts/schedule";
import type { Tx } from "@/lib/db/prisma";

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
            school: true,
            entryYearGroup: true,
            firstAssessmentYear: true,
            childName: true,
            // Epic 21 #4 — Regenerate never re-creates an ended year.
            scheduleEndYear: true,
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
        const gen = await generateSchedule(
          tx,
          account,
          await roundDatesForAccount(tx, account)
        );

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.SCHEDULE_REGENERATED,
          entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
          entityId: account.id,
          // Epic 13 (D13-1a): the account carries no reference — name the child.
          context: `Regenerated schedule for ${account.childName} (${gen.created} added, ${gen.skipped} kept)`,
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

// ─── Epic 21 #4 — End after this year / Add a year ──────────────────────────

const REASON_MIN = 3;
const REASON_MAX = 500;

function checkReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < REASON_MIN || r.length > REASON_MAX) {
    return `Please give a reason (${REASON_MIN}–${REASON_MAX} characters).`;
  }
  return null;
}

/** The application's account and schedule, as the two actions need them. */
async function loadScheduleContext(tx: Tx, applicationId: string) {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: { bursaryAccountId: true, round: { select: { academicYear: true } } },
  });
  if (!application?.bursaryAccountId) return null;
  const account = await tx.bursaryAccount.findUnique({
    where: { id: application.bursaryAccountId },
    select: {
      id: true,
      school: true,
      entryYearGroup: true,
      firstAssessmentYear: true,
      status: true,
      closedAt: true,
      closeReasonId: true,
      scheduleEndYear: true,
      scheduleEntries: {
        orderBy: { scheduleYear: "asc" },
        select: { id: true, scheduleYear: true, academicYear: true, status: true, applicationId: true },
      },
    },
  });
  if (!account) return null;
  return { application, account };
}

function revalidateSchedulePages(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/applications/${applicationId}/assessment/admin`);
}

/**
 * End the schedule after the year being viewed: delete every later SCHEDULED
 * year and record `scheduleEndYear` so Regenerate and award locks never bring
 * them back. Refuses when a later year has started. ADMIN only.
 */
export async function endScheduleAfterYearAction(input: {
  applicationId: string;
  reason: string;
}): Promise<ScheduleActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);
    const reasonError = checkReason(input.reason);
    if (reasonError) return { success: false, error: reasonError };

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const ctx = await loadScheduleContext(tx, input.applicationId);
      if (!ctx) {
        return { success: false as const, error: "This application has no rolling bursary account." };
      }
      const { application, account } = ctx;
      const thisRow = findThisYearRow(account.scheduleEntries, input.applicationId, application.round.academicYear);
      if (!thisRow) {
        return { success: false as const, error: "This year is not on the account's schedule." };
      }
      const plan = planEndAfterYear(account.scheduleEntries, thisRow.scheduleYear);
      if (!plan.ok) return { success: false as const, error: plan.reason };

      // Re-check the status in the delete itself: never remove a started year.
      await tx.bursaryScheduleEntry.deleteMany({
        where: { id: { in: plan.deleteIds }, status: "SCHEDULED" },
      });
      await tx.bursaryAccount.update({
        where: { id: account.id },
        data: { scheduleEndYear: thisRow.scheduleYear, scheduleYears: thisRow.scheduleYear },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SCHEDULE_ENDED_AFTER_YEAR,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: input.applicationId,
        context: `Schedule ended after ${thisRow.academicYear}; removed ${plan.removedYears.join(", ")}. Reason: ${input.reason.trim()}`,
        metadata: {
          bursaryAccountId: account.id,
          scheduleYear: thisRow.scheduleYear,
          academicYear: thisRow.academicYear,
          removedYears: plan.removedYears,
          reason: input.reason.trim(),
        },
      });
      return { success: true as const };
    });

    if (result.success) revalidateSchedulePages(input.applicationId);
    return result;
  } catch (err) {
    console.error("[endScheduleAfterYearAction]", err);
    return { success: false, error: "Failed to end the schedule." };
  }
}

/**
 * Add the next year back to the schedule (never past Year 13, or Year 11 at
 * the OP partnering school). A CLOSED account is re-opened — a deliberate
 * ADMIN decision, audited with the close it reverses. ADMIN only.
 */
export async function addScheduleYearAction(input: {
  applicationId: string;
  reason: string;
}): Promise<ScheduleActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);
    const reasonError = checkReason(input.reason);
    if (reasonError) return { success: false, error: reasonError };

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const ctx = await loadScheduleContext(tx, input.applicationId);
      if (!ctx) {
        return { success: false as const, error: "This application has no rolling bursary account." };
      }
      const { account } = ctx;
      const natural = resolveScheduleHorizon(account.entryYearGroup, undefined, account.school);
      const plan = planAddYear(account.scheduleEntries, natural, account.school);
      if (!plan.ok) return { success: false as const, error: plan.reason };

      // Plan the row exactly as generation would, so labels and dates match.
      const dates = await roundDatesForAccount(tx, account);
      const planned = planSchedule({
        awardAcademicYear: dates.academicYear,
        awardOpenDate: dates.openDate,
        awardCloseDate: dates.closeDate,
        horizon: plan.scheduleYear,
      })[plan.scheduleYear - 1];

      await tx.bursaryScheduleEntry.create({
        data: {
          bursaryAccountId: account.id,
          scheduleYear: planned.scheduleYear,
          academicYear: planned.academicYear,
          availableOn: planned.availableOn,
          requiredBy: planned.requiredBy,
          showOnPortal: planned.showOnPortal,
          manuallyCreated: true,
        },
      });

      const reopened = account.status === "CLOSED";
      await tx.bursaryAccount.update({
        where: { id: account.id },
        data: {
          // NULL again once the schedule reaches its natural end.
          scheduleEndYear: plan.scheduleYear >= natural ? null : plan.scheduleYear,
          scheduleYears: plan.scheduleYear,
          ...(reopened ? { status: "ACTIVE" as const, closedAt: null, closeReasonId: null } : {}),
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SCHEDULE_YEAR_ADDED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: input.applicationId,
        context: `Added ${planned.academicYear} to the schedule${reopened ? " and re-opened the account" : ""}. Reason: ${input.reason.trim()}`,
        metadata: {
          bursaryAccountId: account.id,
          scheduleYear: planned.scheduleYear,
          academicYear: planned.academicYear,
          reopened,
          // The close this reverses, so the history is never lost.
          previousClosedAt: reopened ? (account.closedAt?.toISOString() ?? null) : undefined,
          previousCloseReasonId: reopened ? account.closeReasonId : undefined,
          reason: input.reason.trim(),
        },
      });
      return { success: true as const };
    });

    if (result.success) revalidateSchedulePages(input.applicationId);
    return result;
  } catch (err) {
    console.error("[addScheduleYearAction]", err);
    return { success: false, error: "Failed to add a year to the schedule." };
  }
}
