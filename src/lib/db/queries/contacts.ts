/**
 * Lead-applicant contact register queries (Epic 04).
 *
 * The `contacts` table is the admin-managed, pre-application record of a family
 * (parent + child + school + entry-year + address). It exists independently of
 * any Application and is the source from which an invitation and a
 * school/year-LOCKED application are seeded (D1).
 *
 * All functions return plain objects safe for Server → Client prop passing.
 */

import type { Tx } from "@/lib/db/prisma";
import type { Contact, EntryYearGroup, School } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A contact row plus the derived register state for the table UI. */
export interface ContactListItem {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  childName: string;
  childDob: Date | null;
  school: School;
  entryYear: number;
  entryYearGroup: EntryYearGroup | null;
  profileId: string | null;
  bursaryAccountId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  /** True when this contact has at least one PENDING invitation. */
  hasPendingInvite: boolean;
  /** True when the family has registered (profile bound) or holds an account. */
  hasAccount: boolean;
}

export interface ContactWriteData {
  firstName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  childName: string;
  childDob?: Date | null;
  school: School;
  entryYear: number;
  entryYearGroup?: EntryYearGroup | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  postcode?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// listContacts
// ---------------------------------------------------------------------------

/**
 * Returns contacts (newest first) with derived register state. Excludes
 * archived contacts by default.
 */
export async function listContacts(
  tx: Tx,
  opts?: { includeArchived?: boolean }
): Promise<ContactListItem[]> {
  const rows = await tx.contact.findMany({
    where: opts?.includeArchived ? {} : { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      invitations: { select: { status: true } },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    childName: c.childName,
    childDob: c.childDob,
    school: c.school,
    entryYear: c.entryYear,
    entryYearGroup: c.entryYearGroup,
    profileId: c.profileId,
    bursaryAccountId: c.bursaryAccountId,
    archivedAt: c.archivedAt,
    createdAt: c.createdAt,
    hasPendingInvite: c.invitations.some((i) => i.status === "PENDING"),
    hasAccount: c.profileId !== null || c.bursaryAccountId !== null,
  }));
}

// ---------------------------------------------------------------------------
// getContact
// ---------------------------------------------------------------------------

export async function getContact(
  tx: Tx,
  id: string
): Promise<Contact | null> {
  return tx.contact.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------

export async function createContact(
  tx: Tx,
  data: ContactWriteData,
  createdBy: string
): Promise<Contact> {
  return tx.contact.create({
    data: {
      firstName: data.firstName ?? null,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      childName: data.childName,
      childDob: data.childDob ?? null,
      school: data.school,
      entryYear: data.entryYear,
      entryYearGroup: data.entryYearGroup ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      town: data.town ?? null,
      postcode: data.postcode ?? null,
      notes: data.notes ?? null,
      createdBy,
    },
  });
}

// ---------------------------------------------------------------------------
// updateContact
// ---------------------------------------------------------------------------

export async function updateContact(
  tx: Tx,
  id: string,
  data: ContactWriteData
): Promise<Contact> {
  return tx.contact.update({
    where: { id },
    data: {
      firstName: data.firstName ?? null,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      childName: data.childName,
      childDob: data.childDob ?? null,
      school: data.school,
      entryYear: data.entryYear,
      entryYearGroup: data.entryYearGroup ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      town: data.town ?? null,
      postcode: data.postcode ?? null,
      notes: data.notes ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// archiveContact
// ---------------------------------------------------------------------------

export async function archiveContact(tx: Tx, id: string): Promise<Contact> {
  return tx.contact.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// findDuplicateContact
// ---------------------------------------------------------------------------

/**
 * Detects an existing, non-archived contact for the SAME child (name + DOB)
 * created by the same administrator, so the action can reject a duplicate with
 * a friendly message before binding (D12). Scoped by `createdBy` because the
 * DB unique key (profile_id + child_name + child_dob) treats NULL profile_id as
 * distinct and therefore cannot dedupe not-yet-bound contacts on its own.
 *
 * DOB match is exact (both NULL counts as a match for the "DOB unknown" case);
 * the friendly guard is intentionally conservative to surface likely dupes.
 */
export async function findDuplicateContact(
  tx: Tx,
  params: {
    createdBy: string;
    childName: string;
    childDob: Date | null;
    excludeId?: string;
  }
): Promise<Contact | null> {
  return tx.contact.findFirst({
    where: {
      createdBy: params.createdBy,
      childName: params.childName,
      childDob: params.childDob ?? null,
      archivedAt: null,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  });
}
