"use server";

/**
 * WP-19: Admin Settings Server Actions
 *
 * All actions follow the same pattern:
 *   1. requireRole(["ASSESSOR"]) — admin-only gate
 *   2. Validate + mutate via Prisma
 *   3. createAuditLog()
 *   4. revalidatePath("/settings")
 *   5. Return { success: true } | { success: false; error: string }
 */

import { revalidatePath } from "next/cache";
import { requireRole, Role } from "@/lib/auth/roles";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { isLockedEmailTemplateType } from "@/lib/email/locked-types";
import { DEFAULT_CUSTOM_TEMPLATE_MERGE_FIELDS } from "@/lib/email/template-defaults";
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
    const user = await requireRole([Role.ADMIN]);

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

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const config = await tx.familyTypeConfig.create({
        data: {
          category,
          description,
          notionalRent,
          utilityCosts,
          foodCosts,
          effectiveFrom,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_FAMILY_TYPE_CONFIG_UPSERT,
        entityType: AUDIT_ENTITY_TYPES.FamilyTypeConfig,
        entityId: config.id,
        context: `Updated family type config for category ${category}`,
        metadata: { category, notionalRent, utilityCosts, foodCosts },
      });
    });

    revalidatePath("/settings");
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
    const user = await requireRole([Role.ADMIN]);

    const school = formData.get("school") as School;
    const annualFees = parseFloat(formData.get("annualFees") as string);

    if (!school || isNaN(annualFees) || annualFees < 0) {
      return { success: false, error: "Invalid or missing fields." };
    }

    const effectiveFrom = new Date();
    effectiveFrom.setHours(0, 0, 0, 0);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const fees = await tx.schoolFees.create({
        data: {
          school,
          annualFees,
          effectiveFrom,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_SCHOOL_FEES_UPSERT,
        entityType: AUDIT_ENTITY_TYPES.SchoolFees,
        entityId: fees.id,
        context: `Updated annual fees for ${school}`,
        metadata: { school, annualFees },
      });
    });

    revalidatePath("/settings");
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
    const user = await requireRole([Role.ADMIN]);

    const amount = parseFloat(formData.get("amount") as string);
    const description =
      (formData.get("description") as string)?.trim() || "Band D Croydon";

    if (isNaN(amount) || amount < 0) {
      return { success: false, error: "Invalid council tax amount." };
    }

    const effectiveFrom = new Date();
    effectiveFrom.setHours(0, 0, 0, 0);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const record = await tx.councilTaxDefault.create({
        data: {
          amount,
          description,
          effectiveFrom,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_COUNCIL_TAX_UPDATE,
        entityType: AUDIT_ENTITY_TYPES.CouncilTaxDefault,
        entityId: record.id,
        context: `Updated council tax default to £${amount}`,
        metadata: { amount, description },
      });
    });

    revalidatePath("/settings");
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
    const user = await requireRole([Role.ADMIN]);

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

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      let reasonCode;
      if (id) {
        reasonCode = await tx.reasonCode.update({
          where: { id },
          data: {
            code,
            label,
            isDeprecated,
            sortOrder: isNaN(sortOrder) ? code : sortOrder,
          },
        });
      } else {
        reasonCode = await tx.reasonCode.create({
          data: {
            code,
            label,
            isDeprecated: false,
            sortOrder: isNaN(sortOrder) ? code : sortOrder,
          },
        });
      }

      await createAuditLog(tx, {
        userId: user.id,
        action: id
          ? AUDIT_ACTIONS.SETTINGS_REASON_CODE_UPDATE
          : AUDIT_ACTIONS.SETTINGS_REASON_CODE_CREATE,
        entityType: AUDIT_ENTITY_TYPES.ReasonCode,
        entityId: reasonCode.id,
        context: id
          ? `Updated reason code ${code}: ${label}`
          : `Created reason code ${code}: ${label}`,
        metadata: { code, label, isDeprecated },
      });
    });

    revalidatePath("/settings");
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
 * Resolves the `where` clause used to address a single email template row.
 * System templates are still keyed by `type` (the enum invariant every
 * `findUnique({ where: { type } })` send-path call relies on); custom
 * templates have `type: null` so they must be addressed by `id` instead.
 * Prefers `id` when both are present.
 */
function emailTemplateWhere(
  id: string | null,
  type: string | null
): { id: string } | { type: EmailTemplateType } {
  if (id) return { id };
  return { type: type as EmailTemplateType };
}

export type CreateEmailTemplateResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Creates a new custom (admin-authored) email template. System templates are
 * never created this way — they come from the `*_seed_email_templates`
 * migrations (Story 9.4).
 */
export async function createEmailTemplateAction(
  formData: FormData
): Promise<CreateEmailTemplateResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const name = (formData.get("name") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();

    if (!name || !subject || !body) {
      return { success: false, error: "Name, subject, and body are required." };
    }

    let createdId: string | null = null;

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      // Case-insensitive duplicate-name pre-check among active custom templates.
      const existing = await tx.emailTemplate.findFirst({
        where: {
          isSystem: false,
          deletedAt: null,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (existing) {
        throw new Error("DUPLICATE_TEMPLATE_NAME");
      }

      const template = await tx.emailTemplate.create({
        data: {
          name,
          type: null,
          isSystem: false,
          subject,
          body,
          enabled: true,
          mergeFields: DEFAULT_CUSTOM_TEMPLATE_MERGE_FIELDS,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      createdId = template.id;

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_EMAIL_TEMPLATE_CREATE,
        entityType: AUDIT_ENTITY_TYPES.EmailTemplate,
        entityId: template.id,
        context: `Created custom email template: ${name}`,
        metadata: { id: template.id, name },
      });
    });

    revalidatePath("/settings");
    return { success: true, id: createdId! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "DUPLICATE_TEMPLATE_NAME" || msg.includes("Unique constraint")) {
      return {
        success: false,
        error: "A template with that name already exists.",
      };
    }
    console.error("[createEmailTemplateAction]", err);
    return { success: false, error: "Failed to create email template." };
  }
}

/**
 * Soft-deletes a custom email template (sets `deletedAt`). System templates
 * can never be deleted here — Story 9.3's guard is enforced server-side
 * regardless of what the UI shows, keyed off the row's own `isSystem` flag
 * (not client-supplied data).
 */
export async function deleteEmailTemplateAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const id = (formData.get("id") as string)?.trim();
    if (!id) {
      return { success: false, error: "Template id is required." };
    }

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.emailTemplate.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) {
        throw new Error("TEMPLATE_NOT_FOUND");
      }
      if (existing.isSystem) {
        throw new Error("SYSTEM_TEMPLATE_UNDELETABLE");
      }

      const deleted = await tx.emailTemplate.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: user.id },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_EMAIL_TEMPLATE_DELETE,
        entityType: AUDIT_ENTITY_TYPES.EmailTemplate,
        entityId: deleted.id,
        context: `Deleted custom email template: ${deleted.name ?? deleted.id}`,
        metadata: { id: deleted.id, name: deleted.name },
      });
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "SYSTEM_TEMPLATE_UNDELETABLE") {
      return {
        success: false,
        error: "System templates cannot be deleted.",
      };
    }
    if (msg === "TEMPLATE_NOT_FOUND") {
      return { success: false, error: "Template not found." };
    }
    console.error("[deleteEmailTemplateAction]", err);
    return { success: false, error: "Failed to delete email template." };
  }
}

/**
 * Updates the subject and body for an email template. Addresses the row by
 * `id` when provided (required for custom, type-less templates) and falls
 * back to `type` otherwise (system templates — preserves prior call sites).
 */
export async function upsertEmailTemplateAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const id = (formData.get("id") as string) || null;
    const type = (formData.get("type") as string) || null;
    const subject = (formData.get("subject") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();

    if ((!id && !type) || !subject || !body) {
      return { success: false, error: "Template, subject, and body are required." };
    }

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const template = await tx.emailTemplate.update({
        where: emailTemplateWhere(id, type),
        data: {
          subject,
          body,
          updatedBy: user.id,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_EMAIL_TEMPLATE_UPDATE,
        entityType: AUDIT_ENTITY_TYPES.EmailTemplate,
        entityId: template.id,
        context: `Updated email template: ${template.type ?? template.name}`,
        metadata: { type: template.type, name: template.name, subject },
      });
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertEmailTemplateAction]", err);
    return { success: false, error: "Failed to update email template." };
  }
}

/**
 * Enables or disables a single email template.
 *
 * When disabled, the send chokepoint (`src/lib/email/send.ts`) short-circuits
 * to a success-shaped no-op for that type. Locked types (INVITATION /
 * INVITE_STAFF / APPLICATION_RESTART_REQUIRED) carry functional links and may
 * never be disabled — rejected here (defense-in-depth) using the shared
 * LOCKED_EMAIL_TEMPLATE_TYPES set, the same source of truth the UI uses to
 * render their switches as locked. Custom (type-less) templates are never
 * locked, so the check is skipped when only `id` is supplied.
 */
export async function setEmailTemplateEnabledAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const id = (formData.get("id") as string) || null;
    const type = (formData.get("type") as string) || null;
    const enabled = formData.get("enabled") === "true";

    if (!id && !type) {
      return { success: false, error: "Template is required." };
    }

    // Defense-in-depth: never persist a disabled state for a locked type.
    if (!enabled && type && isLockedEmailTemplateType(type as EmailTemplateType)) {
      return {
        success: false,
        error: `${type} is required and cannot be disabled — it carries the registration link.`,
      };
    }

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const template = await tx.emailTemplate.update({
        where: emailTemplateWhere(id, type),
        data: {
          enabled,
          updatedBy: user.id,
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.UPDATE_EMAIL_TEMPLATE_ENABLED,
        entityType: AUDIT_ENTITY_TYPES.EmailTemplate,
        entityId: template.id,
        context: `${enabled ? "Enabled" : "Disabled"} email template: ${template.type ?? template.name}`,
        metadata: { type: template.type, name: template.name, enabled },
      });
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[setEmailTemplateEnabledAction]", err);
    return { success: false, error: "Failed to update email template status." };
  }
}
