"use server";

/**
 * Server actions for assessment round management.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RoundStatus } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { createRound, updateRound, closeRound } from "@/lib/db/queries/rounds";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";

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
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { academicYear, openDate, closeDate, decisionDate } = parsed.data;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const round = await createRound(tx, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : undefined,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: "CREATE_ROUND",
        entityType: "Round",
        entityId: round.id,
        context: `Created round ${academicYear}`,
        metadata: { academicYear, openDate, closeDate },
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

  redirect("/rounds");
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
  };

  const parsed = RoundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { academicYear, openDate, closeDate, decisionDate } = parsed.data;

  try {
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      await updateRound(tx, id, {
        academicYear,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        decisionDate: decisionDate ? new Date(decisionDate) : null,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: "UPDATE_ROUND",
        entityType: "Round",
        entityId: id,
        context: `Updated round ${academicYear}`,
        metadata: { academicYear, openDate, closeDate },
      });
    });

    revalidatePath("/rounds");
    revalidatePath(`/rounds/${id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update round";
    return { success: false, error: message };
  }

  redirect(`/rounds/${id}`);
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
 * - Refuses if another round is already OPEN. This invariant ("only one OPEN
 *   at a time") is enforced at the action layer via an explicit findFirst,
 *   not via a DB unique partial index. The action-layer guard is a smaller,
 *   reversible change appropriate for MVP; revisit if concurrent admin
 *   activity becomes a real concern (then promote to a DB constraint).
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

      const existingOpen = await tx.round.findFirst({
        where: { status: RoundStatus.OPEN, NOT: { id } },
        select: { academicYear: true },
      });

      if (existingOpen) {
        throw new Error(
          `Cannot open: round ${existingOpen.academicYear} is already OPEN. Close it first.`
        );
      }

      const updated = await updateRound(tx, id, {
        status: RoundStatus.OPEN,
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: "ROUND_OPENED",
        entityType: "Round",
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
        action: "ROUND_CLOSED",
        entityType: "Round",
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
