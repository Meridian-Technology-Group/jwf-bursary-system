"use server";

/**
 * Server actions for assessment round management.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, Role } from "@/lib/auth/roles";
import { createRound, updateRound, closeRound } from "@/lib/db/queries/rounds";
import { prisma } from "@/lib/db/prisma";

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
  const user = await requireRole([Role.ASSESSOR]);

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
    const round = await createRound({
      academicYear,
      openDate: new Date(openDate),
      closeDate: new Date(closeDate),
      decisionDate: decisionDate ? new Date(decisionDate) : undefined,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_ROUND",
        entityType: "Round",
        entityId: round.id,
        context: `Created round ${academicYear}`,
        metadata: { academicYear, openDate, closeDate },
      },
    });

    revalidatePath("/admin/rounds");
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

  redirect("/admin/rounds");
}

// ---------------------------------------------------------------------------
// updateRoundAction
// ---------------------------------------------------------------------------

export async function updateRoundAction(
  id: string,
  formData: FormData
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ASSESSOR]);

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
    await updateRound(id, {
      academicYear,
      openDate: new Date(openDate),
      closeDate: new Date(closeDate),
      decisionDate: decisionDate ? new Date(decisionDate) : null,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_ROUND",
        entityType: "Round",
        entityId: id,
        context: `Updated round ${academicYear}`,
        metadata: { academicYear, openDate, closeDate },
      },
    });

    revalidatePath("/admin/rounds");
    revalidatePath(`/admin/rounds/${id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update round";
    return { success: false, error: message };
  }

  redirect(`/admin/rounds/${id}`);
}

// ---------------------------------------------------------------------------
// closeRoundAction
// ---------------------------------------------------------------------------

export async function closeRoundAction(
  id: string
): Promise<RoundActionResult> {
  const user = await requireRole([Role.ASSESSOR]);

  try {
    const round = await closeRound(id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CLOSE_ROUND",
        entityType: "Round",
        entityId: id,
        context: `Closed round ${round.academicYear}`,
        metadata: { academicYear: round.academicYear },
      },
    });

    revalidatePath("/admin/rounds");
    revalidatePath(`/admin/rounds/${id}`);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to close round";
    return { success: false, error: message };
  }
}
