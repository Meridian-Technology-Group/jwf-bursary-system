"use server";

/**
 * WP-19: Admin Settings Server Actions
 *
 * All actions follow the same pattern:
 *   1. requireRole(["ASSESSOR"]) — admin-only gate
 *   2. Validate + mutate via Prisma
 *   3. createAuditLog()
 *   4. revalidatePath("/admin/settings")
 *   5. Return { success: true } | { success: false; error: string }
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import type { School, EmailTemplateType } from "@prisma/client";

// ─── Result type ──────────────────────────────────────────────────────────────

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── Family Type Config ───────────────────────────────────────────────────────

/**
 * Upserts a FamilyTypeConfig for a given category.
 * Creates a new versioned row (insert, never update existing rows).
 */
export async function upsertFamilyTypeConfigAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const category = parseInt(formData.get("category") as string, 10);
    const notionalRent = parseFloat(formData.get("notionalRent") as string);
    const utilityCosts = parseFloat(formData.get("utilityCosts") as string);
    const foodCosts = parseFloat(formData.get("foodCosts") as string);
    const description = (formData.get("description") as string)?.trim();

    if (
      isNaN(category) ||
      isNaN(notionalRent) ||
      isNaN(utilityCosts) ||
      isNaN(foodCosts) ||
      !description
    ) {
      return { success: false, error: "Invalid or missing fields." };
    }

    const effectiveFrom = new Date();
    effectiveFrom.setHours(0, 0, 0, 0);

    const config = await prisma.familyTypeConfig.create({
      data: {
        category,
        description,
        notionalRent,
        utilityCosts,
        foodCosts,
        effectiveFrom,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "settings.family_type_config.upsert",
      entityType: "FamilyTypeConfig",
      entityId: config.id,
      context: `Updated family type config for category ${category}`,
      metadata: { category, notionalRent, utilityCosts, foodCosts },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertFamilyTypeConfigAction]", err);
    return { success: false, error: "Failed to update family type config." };
  }
}

// ─── School Fees ──────────────────────────────────────────────────────────────

/**
 * Upserts SchoolFees for a given school.
 * Creates a new versioned row (insert, never update existing rows).
 */
export async function upsertSchoolFeesAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const school = formData.get("school") as School;
    const annualFees = parseFloat(formData.get("annualFees") as string);

    if (!school || isNaN(annualFees) || annualFees < 0) {
      return { success: false, error: "Invalid or missing fields." };
    }

    const effectiveFrom = new Date();
    effectiveFrom.setHours(0, 0, 0, 0);

    const fees = await prisma.schoolFees.create({
      data: {
        school,
        annualFees,
        effectiveFrom,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "settings.school_fees.upsert",
      entityType: "SchoolFees",
      entityId: fees.id,
      context: `Updated annual fees for ${school}`,
      metadata: { school, annualFees },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertSchoolFeesAction]", err);
    return { success: false, error: "Failed to update school fees." };
  }
}

// ─── Council Tax ──────────────────────────────────────────────────────────────

/**
 * Creates a new CouncilTaxDefault record (versioned insert).
 */
export async function updateCouncilTaxAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const amount = parseFloat(formData.get("amount") as string);
    const description =
      (formData.get("description") as string)?.trim() || "Band D Croydon";

    if (isNaN(amount) || amount < 0) {
      return { success: false, error: "Invalid council tax amount." };
    }

    const effectiveFrom = new Date();
    effectiveFrom.setHours(0, 0, 0, 0);

    const record = await prisma.councilTaxDefault.create({
      data: {
        amount,
        description,
        effectiveFrom,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "settings.council_tax.update",
      entityType: "CouncilTaxDefault",
      entityId: record.id,
      context: `Updated council tax default to £${amount}`,
      metadata: { amount, description },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[updateCouncilTaxAction]", err);
    return { success: false, error: "Failed to update council tax." };
  }
}

// ─── Reason Codes ─────────────────────────────────────────────────────────────

/**
 * Upserts a reason code (create new or update existing by id).
 * Also handles deprecation via the isDeprecated field.
 */
export async function upsertReasonCodeAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const id = (formData.get("id") as string) || null;
    const codeRaw = formData.get("code") as string;
    const label = (formData.get("label") as string)?.trim();
    const isDeprecated = formData.get("isDeprecated") === "true";
    const sortOrderRaw = formData.get("sortOrder") as string;

    const code = parseInt(codeRaw, 10);
    const sortOrder = parseInt(sortOrderRaw, 10);

    if (!label || isNaN(code)) {
      return { success: false, error: "Code and label are required." };
    }

    let reasonCode;

    if (id) {
      // Update existing
      reasonCode = await prisma.reasonCode.update({
        where: { id },
        data: {
          code,
          label,
          isDeprecated,
          sortOrder: isNaN(sortOrder) ? code : sortOrder,
        },
      });
    } else {
      // Create new
      reasonCode = await prisma.reasonCode.create({
        data: {
          code,
          label,
          isDeprecated: false,
          sortOrder: isNaN(sortOrder) ? code : sortOrder,
        },
      });
    }

    await createAuditLog({
      userId: user.id,
      action: id ? "settings.reason_code.update" : "settings.reason_code.create",
      entityType: "ReasonCode",
      entityId: reasonCode.id,
      context: id
        ? `Updated reason code ${code}: ${label}`
        : `Created reason code ${code}: ${label}`,
      metadata: { code, label, isDeprecated },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertReasonCodeAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A reason code with that number already exists." };
    }
    return { success: false, error: "Failed to save reason code." };
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Updates the subject and body for an email template.
 * Uses upsert to ensure the row exists.
 */
export async function upsertEmailTemplateAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ASSESSOR]);

    const type = formData.get("type") as EmailTemplateType;
    const subject = (formData.get("subject") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();

    if (!type || !subject || !body) {
      return { success: false, error: "Template type, subject, and body are required." };
    }

    const template = await prisma.emailTemplate.update({
      where: { type },
      data: {
        subject,
        body,
        updatedBy: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "settings.email_template.update",
      entityType: "EmailTemplate",
      entityId: template.id,
      context: `Updated email template: ${type}`,
      metadata: { type, subject },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertEmailTemplateAction]", err);
    return { success: false, error: "Failed to update email template." };
  }
}
