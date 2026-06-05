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
  school: School | null;
  entryYear: number | null;
  entryYearGroup: EntryYearGroup | null;
}

/**
 * The fields that MUST be present before a contact can be invited (D1/§5.2):
 * a parent surname + email, the child's name, and the LOCKED school + entry
 * year. A from-contact invite rejects an incomplete contact rather than
 * sending a half-formed invite.
 */
export function missingRequiredInviteFields(contact: ContactCore): string[] {
  const missing: string[] = [];
  if (!contact.lastName || contact.lastName.trim().length === 0) {
    missing.push("parent surname");
  }
  if (!contact.email || contact.email.trim().length === 0) {
    missing.push("email");
  }
  if (!contact.childName || contact.childName.trim().length === 0) {
    missing.push("child name");
  }
  if (!contact.school) missing.push("school");
  if (contact.entryYear == null) missing.push("entry year");
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
