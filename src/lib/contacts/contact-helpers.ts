/**
 * Pure helpers for the lead-applicant contact register (Epic 04). No DB / no
 * "use server" — safe to import from both server actions and tests.
 */

import type { EntryYearGroup, School } from "@prisma/client";

/** The minimal shape needed to assess invite-readiness + display. */
export interface ContactCore {
  firstName: string | null;
  lastName: string | null;
  email: string;
  childName: string | null;
  childFirstName: string | null;
  childLastName: string | null;
  childDob: Date | null;
  school: School | null;
  entryYear: number | null;
  entryYearGroup: EntryYearGroup | null;
}

/**
 * The fields that MUST be present before a contact can be invited (D1/§5.2,
 * tightened by Epic 15 G2 / CH-09): a parent surname + email, the child's
 * SPLIT first name + surname and date of birth, and the LOCKED school + entry
 * year + entry year-group. A from-contact invite rejects an incomplete contact
 * rather than sending a half-formed invite.
 */
export function missingRequiredInviteFields(contact: ContactCore): string[] {
  const missing: string[] = [];
  if (!contact.lastName || contact.lastName.trim().length === 0) {
    missing.push("parent surname");
  }
  if (!contact.email || contact.email.trim().length === 0) {
    missing.push("email");
  }
  // CH-09: the recipient record is first name + surname (split), never a
  // single name string. Legacy contacts predating the split fields must be
  // edited before they can be invited.
  if (!contact.childFirstName || contact.childFirstName.trim().length === 0) {
    missing.push("child first name");
  }
  if (!contact.childLastName || contact.childLastName.trim().length === 0) {
    missing.push("child surname");
  }
  if (!contact.childDob) missing.push("child date of birth");
  if (!contact.school) missing.push("school");
  if (contact.entryYear == null) missing.push("entry year");
  // Q1 (Brian, 2026-08-14): the entry year-group is JWF-facing only and the
  // parent can never supply it, so an invite must not go out without one — the
  // application created on acceptance would otherwise have no year-group at all.
  if (!contact.entryYearGroup) missing.push("entry year group");
  return missing;
}

export function isContactInviteReady(contact: ContactCore): boolean {
  return missingRequiredInviteFields(contact).length === 0;
}

/** Single-line parent display name, falling back to the email. */
export function contactDisplayName(contact: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return (
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.email
  );
}

export function schoolLabel(school: School | null | undefined): string {
  if (!school) return "—";
  return school === "TRINITY" ? "Trinity School" : "Whitgift School";
}
