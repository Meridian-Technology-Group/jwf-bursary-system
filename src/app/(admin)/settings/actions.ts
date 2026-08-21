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
import { validateBandSet, type ValidatableBand } from "@/lib/settings/band-set-validation";
import { isDuplicateEffectiveFrom } from "@/lib/settings/reference-versioning";
import type { School, EmailTemplateType, NotionalCostType } from "@prisma/client";
import { NotionalCostType as NotionalCostTypeEnum } from "@prisma/client";

// ─── Result type ──────────────────────────────────────────────────────────────

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── CALC-11 shared helpers ───────────────────────────────────────────────
//
// Every "create new version" action for the CALC-01 reference tables takes
// the same two form fields: `rows` (a JSON-encoded array of the whole
// generation, admin-edited in the settings UI) and `effectiveFrom` (an
// `<input type="date">` value). These helpers parse both, uniformly.

/** Parses the JSON-encoded `rows` field. Returns `null` on any parse failure. */
function parseRowsJson<T>(raw: FormDataEntryValue | null): T[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** Parses an `<input type="date">` value ("YYYY-MM-DD") to a UTC-midnight Date. */
function parseEffectiveFrom(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
}

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
 * Upserts SchoolFees for a given school + academic year (Epic 15 M2 / CH-17).
 * The row is keyed on [school, effectiveFrom] where effectiveFrom is the
 * 1 September the academic year starts — editing the same year updates the
 * existing row; a new year inserts one. `effectiveFrom` arrives as
 * YYYY-MM-DD (the form derives it from the academic-year choice).
 */
export async function upsertSchoolFeesAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const school = formData.get("school") as School;
    const annualFees = parseFloat(formData.get("annualFees") as string);
    const effectiveFromRaw = (formData.get("effectiveFrom") as string) || "";

    if (
      !school ||
      isNaN(annualFees) ||
      annualFees < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFromRaw)
    ) {
      return { success: false, error: "Invalid or missing fields." };
    }

    const effectiveFrom = new Date(`${effectiveFromRaw}T00:00:00.000Z`);

    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const fees = await tx.schoolFees.upsert({
        where: {
          school_effectiveFrom: { school, effectiveFrom },
        },
        create: { school, annualFees, effectiveFrom },
        update: { annualFees },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_SCHOOL_FEES_UPSERT,
        entityType: AUDIT_ENTITY_TYPES.SchoolFees,
        entityId: fees.id,
        context: `Updated annual fees for ${school} (from ${effectiveFromRaw})`,
        metadata: { school, annualFees, effectiveFrom: effectiveFromRaw },
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

// ─── Close Reasons ────────────────────────────────────────────────────────────

/**
 * Upserts a close reason (create new or update existing by id).
 * Also handles the purgeOnClose toggle and deprecation via isDeprecated.
 */
export async function upsertCloseReasonAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const id = (formData.get("id") as string) || null;
    const label = (formData.get("label") as string)?.trim();
    const purgeOnClose = formData.get("purgeOnClose") === "true";
    const isDeprecated = formData.get("isDeprecated") === "true";
    const sortOrderRaw = formData.get("sortOrder") as string;
    const sortOrder = parseInt(sortOrderRaw, 10);

    if (!label) {
      return { success: false, error: "A label is required." };
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      // Case-insensitive duplicate-label guard — the DB unique index is
      // case-sensitive, so this pre-check is what actually stops "Relocation"
      // and "relocation" from coexisting as separate dropdown entries.
      const existing = await tx.closeReason.findFirst({
        where: { label: { equals: label, mode: "insensitive" } },
      });
      if (existing && existing.id !== id) {
        return { success: false, error: "A close reason with that label already exists." } as const;
      }

      let closeReason;
      if (id) {
        closeReason = await tx.closeReason.update({
          where: { id },
          data: {
            label,
            purgeOnClose,
            isDeprecated,
            sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          },
        });
      } else {
        closeReason = await tx.closeReason.create({
          data: {
            label,
            purgeOnClose,
            isDeprecated: false,
            sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          },
        });
      }

      await createAuditLog(tx, {
        userId: user.id,
        action: id
          ? AUDIT_ACTIONS.SETTINGS_CLOSE_REASON_UPDATE
          : AUDIT_ACTIONS.SETTINGS_CLOSE_REASON_CREATE,
        entityType: AUDIT_ENTITY_TYPES.CloseReason,
        entityId: closeReason.id,
        context: id
          ? `Updated close reason: ${label}`
          : `Created close reason: ${label}`,
        metadata: { label, purgeOnClose, isDeprecated },
      });

      return { success: true } as const;
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertCloseReasonAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A close reason with that label already exists." };
    }
    return { success: false, error: "Failed to save close reason." };
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

// ─── CALC-11 — Notional Cost Config (whole-generation version) ───────────
//
// Unlike FamilyTypeConfig/SchoolFees (one row edited at a time), the eight
// notional-cost lines × six family categories are versioned TOGETHER as one
// generation (see `latestGeneration` in reference-tables.ts) — the settings
// UI submits the whole edited matrix and this action inserts it as one new
// `effectiveFrom`, never touching the previous generation's rows.

interface NotionalCostConfigRowInput {
  category: number;
  costType: string;
  amount: number;
}

export async function createNotionalCostConfigVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<NotionalCostConfigRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));

    if (!rows || rows.length === 0) {
      return { success: false, error: "At least one notional cost row is required." };
    }
    if (!effectiveFrom) {
      return { success: false, error: "A valid effective date is required." };
    }

    const validCostTypes = new Set<string>(Object.values(NotionalCostTypeEnum));
    for (const row of rows) {
      if (
        !Number.isInteger(row.category) ||
        row.category < 1 ||
        !validCostTypes.has(row.costType) ||
        typeof row.amount !== "number" ||
        isNaN(row.amount) ||
        row.amount < 0
      ) {
        return { success: false, error: "Every row needs a valid category, cost type, and non-negative amount." };
      }
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.notionalCostConfig.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return {
          success: false,
          error: "A notional cost version already exists for that effective date.",
        } as const;
      }

      await tx.notionalCostConfig.createMany({
        data: rows.map((row) => ({
          category: row.category,
          costType: row.costType as NotionalCostType,
          amount: row.amount,
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_NOTIONAL_COST_CONFIG_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.NotionalCostConfig,
        entityId: user.id,
        context: `Created a new notional cost config version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createNotionalCostConfigVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A notional cost version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create notional cost config version." };
  }
}

// ─── CALC-11 — Family Category Meta (whole-generation version) ───────────

interface FamilyCategoryMetaRowInput {
  category: number;
  familyMembers: number;
  schoolAgeChildren: number;
  description: string;
}

export async function createFamilyCategoryMetaVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<FamilyCategoryMetaRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));

    if (!rows || rows.length === 0) {
      return { success: false, error: "At least one family category row is required." };
    }
    if (!effectiveFrom) {
      return { success: false, error: "A valid effective date is required." };
    }

    for (const row of rows) {
      if (
        !Number.isInteger(row.category) ||
        row.category < 1 ||
        !Number.isInteger(row.familyMembers) ||
        row.familyMembers < 1 ||
        !Number.isInteger(row.schoolAgeChildren) ||
        row.schoolAgeChildren < 0 ||
        !row.description?.trim()
      ) {
        return {
          success: false,
          error: "Every row needs a valid category, family member count, school-age children count, and description.",
        };
      }
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.familyCategoryMeta.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return {
          success: false,
          error: "A family category meta version already exists for that effective date.",
        } as const;
      }

      await tx.familyCategoryMeta.createMany({
        data: rows.map((row) => ({
          category: row.category,
          familyMembers: row.familyMembers,
          schoolAgeChildren: row.schoolAgeChildren,
          description: row.description.trim(),
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_FAMILY_CATEGORY_META_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.FamilyCategoryMeta,
        entityId: user.id,
        context: `Created a new family category meta version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createFamilyCategoryMetaVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A family category meta version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create family category meta version." };
  }
}

// ─── CALC-11 — Benchmark band tables (whole-generation version) ──────────
//
// The six band tables (Appendix B, C.1–C.5) share one shape: every row in
// the new generation is validated as a SET via `validateBandSet` (ceiling ≥
// floor, no duplicate ceilings, contiguous with no gap/overlap) before any
// row is inserted — a single bad row fails the whole version, exactly like
// the existing "insert, never mutate" convention for one-row tables.

/** Runs `validateBandSet` and returns a `SettingsActionResult`-shaped early exit, or null if valid. */
function checkBandSet(
  bands: ValidatableBand[],
  options?: { epsilon?: number }
): SettingsActionResult | null {
  const result = validateBandSet(bands, options);
  if (!result.valid) {
    return { success: false, error: result.errors.join(" ") };
  }
  return null;
}

interface AffordabilityBandRowInput {
  bandFloor: number;
  bandCeiling: number;
  basePct: number;
}

export async function createAffordabilityBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<AffordabilityBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    // Unlike the other five band tables (which touch exactly at the seam —
    // one row's ceiling equals the next row's floor), the affordability grid
    // is discrete whole-pound bands where the next band starts at ceiling+1
    // (Appendix B: …29,000 | 29,001–32,000…) — a wider epsilon accommodates
    // that £1 step without masking a genuine gap of, say, £1,000+.
    const bandError = checkBandSet(
      rows.map((r) => ({ floor: r.bandFloor, ceiling: r.bandCeiling })),
      { epsilon: 1 }
    );
    if (bandError) return bandError;

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.affordabilityBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "An affordability band version already exists for that effective date." } as const;
      }

      await tx.affordabilityBand.createMany({
        data: rows.map((r) => ({
          bandFloor: r.bandFloor,
          bandCeiling: r.bandCeiling,
          basePct: r.basePct,
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_AFFORDABILITY_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.AffordabilityBand,
        entityId: user.id,
        context: `Created a new affordability band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createAffordabilityBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "An affordability band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create affordability band version." };
  }
}

interface IncomeCategoryBandRowInput {
  bandFloor: number | null;
  bandCeiling: number | null;
  category: number;
  feesBenchmarkPct: number;
}

export async function createIncomeCategoryBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<IncomeCategoryBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    const bandError = checkBandSet(rows.map((r) => ({ floor: r.bandFloor, ceiling: r.bandCeiling })));
    if (bandError) return bandError;

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.incomeCategoryBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "An income category band version already exists for that effective date." } as const;
      }

      await tx.incomeCategoryBand.createMany({
        data: rows.map((r) => ({
          bandFloor: r.bandFloor,
          bandCeiling: r.bandCeiling,
          category: r.category,
          feesBenchmarkPct: r.feesBenchmarkPct,
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_INCOME_CATEGORY_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.IncomeCategoryBand,
        entityId: user.id,
        context: `Created a new income category band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createIncomeCategoryBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "An income category band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create income category band version." };
  }
}

interface PropertyEquityBandRowInput {
  bandFloor: number | null;
  bandCeiling: number | null;
  category: number;
}

export async function createPropertyEquityBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<PropertyEquityBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    const bandError = checkBandSet(rows.map((r) => ({ floor: r.bandFloor, ceiling: r.bandCeiling })));
    if (bandError) return bandError;

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.propertyEquityBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "A property equity band version already exists for that effective date." } as const;
      }

      await tx.propertyEquityBand.createMany({
        data: rows.map((r) => ({
          bandFloor: r.bandFloor,
          bandCeiling: r.bandCeiling,
          category: r.category,
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_PROPERTY_EQUITY_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.PropertyEquityBand,
        entityId: user.id,
        context: `Created a new property equity band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createPropertyEquityBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A property equity band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create property equity band version." };
  }
}

interface FinancialEquityBandRowInput {
  bandFloor: number | null;
  bandCeiling: number | null;
  label: string;
}

export async function createFinancialEquityBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<FinancialEquityBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    const bandError = checkBandSet(rows.map((r) => ({ floor: r.bandFloor, ceiling: r.bandCeiling })));
    if (bandError) return bandError;
    if (rows.some((r) => !r.label?.trim())) {
      return { success: false, error: "Every row needs a label." };
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.financialEquityBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "A financial equity band version already exists for that effective date." } as const;
      }

      await tx.financialEquityBand.createMany({
        data: rows.map((r) => ({
          bandFloor: r.bandFloor,
          bandCeiling: r.bandCeiling,
          label: r.label.trim(),
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_FINANCIAL_EQUITY_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.FinancialEquityBand,
        entityId: user.id,
        context: `Created a new financial equity band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createFinancialEquityBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A financial equity band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create financial equity band version." };
  }
}

interface DebtRatioBandRowInput {
  ratioFloor: number | null;
  ratioCeiling: number | null;
  minRepaymentMonths: number | null;
  statusLabel: string;
}

export async function createDebtRatioBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<DebtRatioBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    const bandError = checkBandSet(rows.map((r) => ({ floor: r.ratioFloor, ceiling: r.ratioCeiling })));
    if (bandError) return bandError;
    if (rows.some((r) => !r.statusLabel?.trim())) {
      return { success: false, error: "Every row needs a status label." };
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.debtRatioBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "A debt ratio band version already exists for that effective date." } as const;
      }

      await tx.debtRatioBand.createMany({
        data: rows.map((r) => ({
          ratioFloor: r.ratioFloor,
          ratioCeiling: r.ratioCeiling,
          minRepaymentMonths: r.minRepaymentMonths,
          statusLabel: r.statusLabel.trim(),
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_DEBT_RATIO_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.DebtRatioBand,
        entityId: user.id,
        context: `Created a new debt ratio band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createDebtRatioBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A debt ratio band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create debt ratio band version." };
  }
}

interface LifestyleSqueezeBandRowInput {
  ratioFloor: number | null;
  ratioCeiling: number | null;
  statusLabel: string;
}

export async function createLifestyleSqueezeBandVersionAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const user = await requireRole([Role.ADMIN]);

    const rows = parseRowsJson<LifestyleSqueezeBandRowInput>(formData.get("rows"));
    const effectiveFrom = parseEffectiveFrom(formData.get("effectiveFrom"));
    if (!rows || rows.length === 0) return { success: false, error: "At least one band row is required." };
    if (!effectiveFrom) return { success: false, error: "A valid effective date is required." };

    const bandError = checkBandSet(rows.map((r) => ({ floor: r.ratioFloor, ceiling: r.ratioCeiling })));
    if (bandError) return bandError;
    if (rows.some((r) => !r.statusLabel?.trim())) {
      return { success: false, error: "Every row needs a status label." };
    }

    const result = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const existing = await tx.lifestyleSqueezeBand.findMany({ select: { effectiveFrom: true } });
      if (isDuplicateEffectiveFrom(effectiveFrom, existing.map((e) => e.effectiveFrom))) {
        return { success: false, error: "A lifestyle squeeze band version already exists for that effective date." } as const;
      }

      await tx.lifestyleSqueezeBand.createMany({
        data: rows.map((r) => ({
          ratioFloor: r.ratioFloor,
          ratioCeiling: r.ratioCeiling,
          statusLabel: r.statusLabel.trim(),
          effectiveFrom,
        })),
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SETTINGS_LIFESTYLE_SQUEEZE_BAND_VERSION_CREATE,
        entityType: AUDIT_ENTITY_TYPES.LifestyleSqueezeBand,
        entityId: user.id,
        context: `Created a new lifestyle squeeze band version (${rows.length} rows) effective ${effectiveFrom.toISOString().slice(0, 10)}`,
        metadata: { effectiveFrom: effectiveFrom.toISOString(), rowCount: rows.length },
      });

      return { success: true } as const;
    });

    if (!result.success) return result;
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[createLifestyleSqueezeBandVersionAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A lifestyle squeeze band version already exists for that effective date." };
    }
    return { success: false, error: "Failed to create lifestyle squeeze band version." };
  }
}

// ─── CALC-11 — Gap Reasons ────────────────────────────────────────────────
//
// Mirrors upsertReasonCodeAction exactly: create new or update existing by
// id, soft-deprecate via isDeprecated, never delete.

export async function upsertGapReasonAction(
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
      let gapReason;
      if (id) {
        gapReason = await tx.gapReason.update({
          where: { id },
          data: {
            code,
            label,
            isDeprecated,
            sortOrder: isNaN(sortOrder) ? code : sortOrder,
          },
        });
      } else {
        gapReason = await tx.gapReason.create({
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
          ? AUDIT_ACTIONS.SETTINGS_GAP_REASON_UPDATE
          : AUDIT_ACTIONS.SETTINGS_GAP_REASON_CREATE,
        entityType: AUDIT_ENTITY_TYPES.GapReason,
        entityId: gapReason.id,
        context: id
          ? `Updated gap reason ${code}: ${label}`
          : `Created gap reason ${code}: ${label}`,
        metadata: { code, label, isDeprecated },
      });
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[upsertGapReasonAction]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "A gap reason with that number already exists." };
    }
    return { success: false, error: "Failed to save gap reason." };
  }
}
