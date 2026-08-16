"use server";

/**
 * Server actions for assessment round management.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RoundScenario, RoundStatus } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { createRound, updateRound, closeRound } from "@/lib/db/queries/rounds";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Reversible safety flag (Epic 03 / D13). Concurrent OPEN rounds are allowed by
 * default; setting `ROUNDS_SINGLE_OPEN_ONLY` to "1"/"true" restores the old
 * "only one OPEN round at a time" guard in {@link openRoundAction} without a
 * code change. Read once at module load.
 */
const SINGLE_OPEN_ONLY =
  process.env.ROUNDS_SINGLE_OPEN_ONLY === "1" ||
  process.env.ROUNDS_SINGLE_OPEN_ONLY === "true";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const RoundSchema = z
  .object({
    academicYear: z
      .string()
      .min(1, "Academic year is required")
      .regex(/^\d{4}\/\d{2}$/, "Format must be YYYY/YY (e.g. 2026/27)"),
    openDate: z.string().min(1, "Open date is required"),
    closeDate: z.string().min(1, "Close date is required"),
    decisionDate: z.string().optional(),
    // Item 12, made type-aware by E1/D13-8: the round carries TWO default
    // submission-by dates — one for new applicants, one for bursary holders
    // rolling over into the annual re-assessment (conventionally April; Q4:
    // one global date per round, not per school). Each is optional — a round
    // with no default for a type simply has none (those applications fall back
    // to closeDate, D-1) — and neither is refined against openDate/closeDate:
    // the Foundation may legitimately want a default before or after closeDate
    // (e.g. a grace period past close), so this is deliberately permissive.
    defaultSubmissionDeadlineNew: z.string().optional(),
    defaultSubmissionDeadlineRolling: z.string().optional(),
  })
  .refine(
    (data) => new Date(data.closeDate) > new Date(data.openDate),
    { message: "Close date must be after open date", path: ["closeDate"] }
  )
  .refine(
    (data) =>
      !data.decisionDate ||
      new Date(data.decisionDate) > new Date(data.closeDate),
    {
      message: "Decision date must be after close date",
      path: ["decisionDate"],
    }
  );

// ---------------------------------------------------------------------------
// createRoundAction
// ---------------------------------------------------------------------------

export interface RoundActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createRoundAction(
  formData: FormData
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ADMIN]);

  const raw = {
    academicYear: formData.get("academicYear") as string,
    openDate: formData.get("openDate") as string,
    closeDate: formData.get("closeDate") as string,
    decisionDate: (formData.get("decisionDate") as string) || undefined,
    defaultSubmissionDeadlineNew:
      (formData.get("defaultSubmissionDeadlineNew") as string) || undefined,
    defaultSubmissionDeadlineRolling:
      (formData.get("defaultSubmissionDeadlineRolling") as string) || undefined,
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    academicYear,
    openDate,
    closeDate,
    decisionDate,
    defaultSubmissionDeadlineNew,
    defaultSubmissionDeadlineRolling,
  } = parsed.data;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const round = await createRound(tx, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : undefined,
        defaultSubmissionDeadlineNew: defaultSubmissionDeadlineNew
          ? new Date(defaultSubmissionDeadlineNew)
          : undefined,
        defaultSubmissionDeadlineRolling: defaultSubmissionDeadlineRolling
          ? new Date(defaultSubmissionDeadlineRolling)
          : undefined,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.CREATE_ROUND,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: round.id,
        context: `Created round ${academicYear}`,
        metadata: {
          academicYear,
          openDate,
          closeDate,
          defaultSubmissionDeadlineNew: defaultSubmissionDeadlineNew ?? null,
          defaultSubmissionDeadlineRolling:
            defaultSubmissionDeadlineRolling ?? null,
        },
      });
    });

    revalidatePath("/rounds");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create round";
    // Unique constraint violation on academicYear
    if (message.includes("Unique constraint")) {
      return {
        success: false,
        error: `A round for ${raw.academicYear} already exists.`,
      };
    }
    return { success: false, error: message };
  }

  // Return success and let the client navigate. Calling redirect() here throws
  // a NEXT_REDIRECT control-flow error that propagates to the client as a
  // rejected promise, which the dialog mis-renders as "An unexpected error
  // occurred" even though the write committed (defect plan §2.3). This mirrors
  // openRoundAction / closeRoundAction, which already return without redirecting.
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateRoundAction
// ---------------------------------------------------------------------------

export async function updateRoundAction(
  id: string,
  formData: FormData
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ADMIN]);

  const raw = {
    academicYear: formData.get("academicYear") as string,
    openDate: formData.get("openDate") as string,
    closeDate: formData.get("closeDate") as string,
    decisionDate: (formData.get("decisionDate") as string) || undefined,
    defaultSubmissionDeadlineNew:
      (formData.get("defaultSubmissionDeadlineNew") as string) || undefined,
    defaultSubmissionDeadlineRolling:
      (formData.get("defaultSubmissionDeadlineRolling") as string) || undefined,
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    academicYear,
    openDate,
    closeDate,
    decisionDate,
    defaultSubmissionDeadlineNew,
    defaultSubmissionDeadlineRolling,
  } = parsed.data;

  const newDeadline = defaultSubmissionDeadlineNew
    ? new Date(defaultSubmissionDeadlineNew)
    : null;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await updateRound(tx, id, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : null,
        defaultSubmissionDeadlineNew: newDeadline,
        defaultSubmissionDeadlineRolling: defaultSubmissionDeadlineRolling
          ? new Date(defaultSubmissionDeadlineRolling)
          : null,
        // Legacy mirror (E1) — no readers left; kept in step with the NEW date
        // so a code-only revert behaves as before. E1b drops the column.
        defaultSubmissionDeadline: newDeadline,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.UPDATE_ROUND,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: id,
        context: `Updated round ${academicYear}`,
        // decisionDate + defaultSubmissionDeadline were missing from this
        // metadata (Item 12 plan note) — added here so the audit trail on an
        // update covers every field the dialog can change, matching 12.1's
        // "audit entry records who changed it and when" AC and 12.3's "single
        // round-level audit entry" (no per-application entries on cascade).
        metadata: {
          academicYear,
          openDate,
          closeDate,
          decisionDate: decisionDate ?? null,
          defaultSubmissionDeadlineNew: defaultSubmissionDeadlineNew ?? null,
          defaultSubmissionDeadlineRolling:
            defaultSubmissionDeadlineRolling ?? null,
        },
      });
    });

    revalidatePath("/rounds");
    revalidatePath(`/rounds/${id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update round";
    return { success: false, error: message };
  }

  // Return success and let the client navigate (same NEXT_REDIRECT pitfall as
  // createRoundAction — see §2.3).
  return { success: true };
}

// ---------------------------------------------------------------------------
// openRoundAction
// ---------------------------------------------------------------------------

/**
 * Transitions a round from DRAFT to OPEN.
 *
 * Guards:
 * - Admin-gated (matches createRoundAction).
 * - Refuses if the target round is not currently DRAFT.
 *
 * Concurrent OPEN rounds (Epic 03, decision D13). The Foundation runs more than
 * one intake at a time, so the old "only one OPEN round at a time" invariant is
 * LIFTED by default — opening a second OPEN round is now allowed. The check is
 * retained ONLY as a reversible, OFF-by-default soft guard behind the
 * `ROUNDS_SINGLE_OPEN_ONLY` env flag (set to "1"/"true" to restore the old
 * single-OPEN behaviour without a code change). It was never a DB constraint;
 * the database stays permissive. Readers no longer assume a single OPEN round
 * (getActiveRound is a *default*-only helper, listOpenRounds enumerates all,
 * and bulk re-assessment takes an explicit roundId).
 *
 * Stamps an audit log entry (action: "ROUND_OPENED") and revalidates the
 * rounds list + detail routes.
 */
export async function openRoundAction(
  id: string
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ADMIN]);

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const target = await tx.round.findUnique({
        where: { id },
        select: { id: true, status: true, academicYear: true },
      });

      if (!target) {
        throw new Error("Round not found.");
      }

      if (target.status !== RoundStatus.DRAFT) {
        throw new Error(
          `Round ${target.academicYear} is ${target.status}; only DRAFT rounds can be opened.`
        );
      }

      // Soft, reversible single-OPEN guard — OFF by default (D13: concurrent
      // rounds are the norm). Only enforced when explicitly opted into via env.
      if (SINGLE_OPEN_ONLY) {
        const existingOpen = await tx.round.findFirst({
          where: { status: RoundStatus.OPEN, NOT: { id } },
          select: { academicYear: true },
        });

        if (existingOpen) {
          throw new Error(
            `Cannot open: round ${existingOpen.academicYear} is already OPEN (ROUNDS_SINGLE_OPEN_ONLY is set). Close it first.`
          );
        }
      }

      const updated = await updateRound(tx, id, {
        status: RoundStatus.OPEN,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ROUND_OPENED,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: id,
        context: `Opened round ${updated.academicYear}`,
        metadata: { academicYear: updated.academicYear },
      });
    });

    revalidatePath("/rounds");
    revalidatePath(`/rounds/${id}`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to open round";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// closeRoundAction
// ---------------------------------------------------------------------------

/**
 * Transitions a round from OPEN to CLOSED.
 *
 * Admin-gated; refuses if the target round is not currently OPEN. Stamps an
 * audit log entry (action: "ROUND_CLOSED") and revalidates the rounds list +
 * detail routes.
 */
export async function closeRoundAction(
  id: string
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ADMIN]);

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const target = await tx.round.findUnique({
        where: { id },
        select: { id: true, status: true, academicYear: true },
      });

      if (!target) {
        throw new Error("Round not found.");
      }

      if (target.status !== RoundStatus.OPEN) {
        throw new Error(
          `Round ${target.academicYear} is ${target.status}; only OPEN rounds can be closed.`
        );
      }

      const round = await closeRound(tx, id);

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ROUND_CLOSED,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: id,
        context: `Closed round ${round.academicYear}`,
        metadata: { academicYear: round.academicYear },
      });
    });

    revalidatePath("/rounds");
    revalidatePath(`/rounds/${id}`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to close round";
    return { success: false, error: message };
  }
}

// ─── Epic 14 D1 (CG-01) — round scenario windows ─────────────────────────────

const RoundWindowInputSchema = z.object({
  scenario: z.nativeEnum(RoundScenario),
  opensOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  submitBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  defaultTaxYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{2}$/, "Tax year must look like 2025/26")
    .nullable(),
});

const RoundWindowsSchema = z.array(RoundWindowInputSchema).max(4);

export interface SaveRoundWindowsResult {
  success: boolean;
  error?: string;
}

/**
 * Upserts the four scenario windows for a round (ADMIN only — mirrors the
 * round create/edit actions). A window with every field null is deleted so
 * the pure resolver's derived defaults apply again.
 */
export async function saveRoundWindowsAction(
  roundId: string,
  windows: unknown
): Promise<SaveRoundWindowsResult> {
  const user = await requireRole([Role.ADMIN]);

  const parsed = RoundWindowsSchema.safeParse(windows);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid window rows.",
    };
  }

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, academicYear: true },
      });
      if (!round) throw new Error("Round not found.");

      for (const w of parsed.data) {
        const empty = !w.opensOn && !w.submitBy && !w.defaultTaxYear;
        if (empty) {
          await tx.roundWindow.deleteMany({
            where: { roundId, scenario: w.scenario },
          });
          continue;
        }
        await tx.roundWindow.upsert({
          where: { roundId_scenario: { roundId, scenario: w.scenario } },
          create: {
            roundId,
            scenario: w.scenario,
            opensOn: w.opensOn ? new Date(`${w.opensOn}T00:00:00.000Z`) : null,
            submitBy: w.submitBy ? new Date(`${w.submitBy}T00:00:00.000Z`) : null,
            defaultTaxYear: w.defaultTaxYear,
          },
          update: {
            opensOn: w.opensOn ? new Date(`${w.opensOn}T00:00:00.000Z`) : null,
            submitBy: w.submitBy ? new Date(`${w.submitBy}T00:00:00.000Z`) : null,
            defaultTaxYear: w.defaultTaxYear,
          },
        });
      }

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.UPDATE_ROUND,
        entityType: AUDIT_ENTITY_TYPES.Round,
        entityId: roundId,
        context: `Round scenario windows updated (${round.academicYear})`,
        metadata: { windows: parsed.data },
      });
    });
  } catch (err) {
    console.error("[saveRoundWindowsAction]", err);
    return { success: false, error: "Failed to save the scenario windows." };
  }

  revalidatePath(`/rounds/${roundId}`);
  return { success: true };
}
