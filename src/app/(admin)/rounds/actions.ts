"use server";

/**
 * Server actions for assessment round management.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RoundStatus } from "@prisma/client";
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
    // Item 12: round-level default submission-by date. Optional — a round with
    // no default simply has none (applications fall back to closeDate, D-1).
    // No refinement against openDate/closeDate: the Foundation may legitimately
    // want a default before or after closeDate (e.g. a grace period past close),
    // so this is deliberately permissive.
    defaultSubmissionDeadline: z.string().optional(),
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
    defaultSubmissionDeadline:
      (formData.get("defaultSubmissionDeadline") as string) || undefined,
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { academicYear, openDate, closeDate, decisionDate, defaultSubmissionDeadline } =
    parsed.data;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const round = await createRound(tx, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : undefined,
        defaultSubmissionDeadline: defaultSubmissionDeadline
          ? new Date(defaultSubmissionDeadline)
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
          defaultSubmissionDeadline: defaultSubmissionDeadline ?? null,
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
    defaultSubmissionDeadline:
      (formData.get("defaultSubmissionDeadline") as string) || undefined,
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { academicYear, openDate, closeDate, decisionDate, defaultSubmissionDeadline } =
    parsed.data;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await updateRound(tx, id, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : null,
        defaultSubmissionDeadline: defaultSubmissionDeadline
          ? new Date(defaultSubmissionDeadline)
          : null,
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
          defaultSubmissionDeadline: defaultSubmissionDeadline ?? null,
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
