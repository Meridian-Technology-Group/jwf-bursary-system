"use server";

/**
 * Server actions for the lead-applicant contact register (Epic 04, PR-2).
 *
 * A contact is the admin-managed, pre-application record of a family. These
 * actions create / edit / archive contacts. Required fields (D1/§5.2):
 * lastName, email, childName, school, entryYear. `childDob` is strongly
 * encouraged (it disambiguates twins, D12) but not hard-required so an admin
 * can still register a family whose DOB is unknown.
 *
 * "Send invitation from a contact" lives in `invite-actions.ts` (PR-3) so this
 * file stays focused on the register CRUD.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EntryYearGroup, InvitationSituation, School } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  archiveContact,
  createContact,
  findDuplicateContact,
  updateContact,
  type ContactWriteData,
} from "@/lib/db/queries/contacts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * Entry year is a calendar year. Constrain to a sane window so a typo can't
 * write 202 or 20255; the contact register is curated by hand, not imported.
 */
const ContactSchema = z.object({
  title: optionalString,
  firstName: optionalString,
  lastName: z.string().trim().min(1, "Parent surname is required").max(120),
  email: z.string().trim().email("A valid email address is required"),
  phone: optionalString,
  childTitle: optionalString,
  childFirstName: optionalString,
  childLastName: z
    .string()
    .trim()
    .min(1, "Child's surname is required")
    .max(120),
  // YYYY-MM-DD from a <input type="date">, optional.
  childDob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  school: z.nativeEnum(School, { error: "A school is required" }),
  // B3 (CG-26, LA-3) — situation chosen at contact creation; the invite path
  // resolves the template variant from it (school half from `school`).
  situation: z.nativeEnum(InvitationSituation).default(InvitationSituation.NEW),
  entryYear: z.coerce
    .number()
    .int()
    .min(2000, "Enter a valid entry year")
    .max(2100, "Enter a valid entry year"),
  // MANDATORY as of Q1 (Brian, 2026-08-14). The applicant can no longer supply
  // an entry year-group anywhere, so the contact — the root of the invite →
  // application chain — must always carry one.
  entryYearGroup: z.nativeEnum(EntryYearGroup, {
    error: () => ({ message: "An entry year group is required" }),
  }),
  addressLine1: optionalString,
  addressLine2: optionalString,
  town: optionalString,
  postcode: optionalString,
  notes: z.string().trim().max(2000).optional(),
});

export interface ContactActionResult {
  success: boolean;
  contactId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rawFromFormData(formData: FormData) {
  return {
    title: (formData.get("title") as string) || undefined,
    firstName: (formData.get("firstName") as string) || undefined,
    lastName: (formData.get("lastName") as string) || "",
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || undefined,
    childTitle: (formData.get("childTitle") as string) || undefined,
    childFirstName: (formData.get("childFirstName") as string) || undefined,
    childLastName: (formData.get("childLastName") as string) || "",
    childDob: (formData.get("childDob") as string) || undefined,
    school: (formData.get("school") as string) || undefined,
    situation: (formData.get("situation") as string) || undefined,
    entryYear: (formData.get("entryYear") as string) || undefined,
    entryYearGroup: (formData.get("entryYearGroup") as string) || undefined,
    addressLine1: (formData.get("addressLine1") as string) || undefined,
    addressLine2: (formData.get("addressLine2") as string) || undefined,
    town: (formData.get("town") as string) || undefined,
    postcode: (formData.get("postcode") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };
}

/** Parse a YYYY-MM-DD string into a UTC-midnight Date (DB column is @db.Date). */
function parseDob(dob: string | undefined): Date | null {
  if (!dob) return null;
  return new Date(`${dob}T00:00:00.000Z`);
}

/** Derive the single-string child name backing store from the split fields. */
function composeChildName(
  firstName: string | undefined,
  lastName: string
): string {
  return [firstName, lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function toWriteData(
  parsed: z.infer<typeof ContactSchema>
): ContactWriteData {
  return {
    title: parsed.title ?? null,
    firstName: parsed.firstName ?? null,
    lastName: parsed.lastName,
    email: parsed.email,
    phone: parsed.phone ?? null,
    childTitle: parsed.childTitle ?? null,
    childFirstName: parsed.childFirstName ?? null,
    childLastName: parsed.childLastName,
    childName: composeChildName(parsed.childFirstName, parsed.childLastName),
    childDob: parseDob(parsed.childDob),
    school: parsed.school,
    entryYear: parsed.entryYear,
    entryYearGroup: parsed.entryYearGroup,
    situation: parsed.situation,
    addressLine1: parsed.addressLine1 ?? null,
    addressLine2: parsed.addressLine2 ?? null,
    town: parsed.town ?? null,
    postcode: parsed.postcode ?? null,
    notes: parsed.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// createContactAction
// ---------------------------------------------------------------------------

export async function createContactAction(
  formData: FormData
): Promise<ContactActionResult> {
  const user = await requireRole([Role.ADMIN]);

  const parsed = ContactSchema.safeParse(rawFromFormData(formData));
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = toWriteData(parsed.data);

  try {
    const result = await withAdminContext(async (tx) => {
      const dupe = await findDuplicateContact(tx, {
        createdBy: user.id,
        childName: data.childName,
        childDob: data.childDob ?? null,
      });
      if (dupe) {
        return {
          success: false as const,
          error:
            "This family already has a contact for that child (same name and date of birth). For twins, enter each child's distinct date of birth.",
        };
      }

      const contact = await createContact(tx, data, user.id);

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.CREATE_CONTACT,
        entityType: AUDIT_ENTITY_TYPES.Contact,
        entityId: contact.id,
        context: `Created contact for ${data.childName}`,
        metadata: {
          email: data.email,
          school: data.school,
          entryYear: data.entryYear,
        },
      });

      return { success: true as const, contactId: contact.id };
    });

    if (!result.success) return result;
    revalidatePath("/contacts");
    return { success: true, contactId: result.contactId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create contact";
    console.error("[contacts] createContactAction error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// updateContactAction
// ---------------------------------------------------------------------------

export async function updateContactAction(
  contactId: string,
  formData: FormData
): Promise<ContactActionResult> {
  const user = await requireRole([Role.ADMIN]);

  if (!contactId || typeof contactId !== "string") {
    return { success: false, error: "Invalid contact id." };
  }

  const parsed = ContactSchema.safeParse(rawFromFormData(formData));
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = toWriteData(parsed.data);

  try {
    const result = await withAdminContext(async (tx) => {
      const dupe = await findDuplicateContact(tx, {
        createdBy: user.id,
        childName: data.childName,
        childDob: data.childDob ?? null,
        excludeId: contactId,
      });
      if (dupe) {
        return {
          success: false as const,
          error:
            "Another contact already exists for that child (same name and date of birth).",
        };
      }

      await updateContact(tx, contactId, data);

      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.UPDATE_CONTACT,
        entityType: AUDIT_ENTITY_TYPES.Contact,
        entityId: contactId,
        context: `Updated contact for ${data.childName}`,
        metadata: { email: data.email, school: data.school },
      });

      return { success: true as const };
    });

    if (!result.success) return result;
    revalidatePath("/contacts");
    return { success: true, contactId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update contact";
    console.error("[contacts] updateContactAction error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// archiveContactAction
// ---------------------------------------------------------------------------

export async function archiveContactAction(
  contactId: string
): Promise<ContactActionResult> {
  const user = await requireRole([Role.ADMIN]);

  if (!contactId || typeof contactId !== "string") {
    return { success: false, error: "Invalid contact id." };
  }

  try {
    await withAdminContext(async (tx) => {
      await archiveContact(tx, contactId);
      await createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.ARCHIVE_CONTACT,
        entityType: AUDIT_ENTITY_TYPES.Contact,
        entityId: contactId,
        context: "Archived contact",
        metadata: {},
      });
    });

    revalidatePath("/contacts");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to archive contact";
    console.error("[contacts] archiveContactAction error:", err);
    return { success: false, error: message };
  }
}
