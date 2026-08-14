/**
 * Family Identification — identity-document slots and per-member resolution.
 *
 * The single source of truth for *which storage slot each identity document
 * goes in* and *which blob field holds it*, shared by the Family
 * Identification form and the section-gap rules.
 *
 * ## Why this module exists (F2)
 *
 * The form used to render two different uploads — "UK Passport" (writing
 * `ukPassportDocumentId`) and "Passport" (writing `passportDocumentId`) — into
 * the SAME slot key, `FAMILY_ID_PASSPORT_<index>`. `FileUpload` derives its DOM
 * ids from the slot (`file-upload-<slot>`), and `ConditionalField` collapses
 * with CSS rather than unmounting, so both controls were always in the DOM with
 * the same `id`. A `<label for>` resolves to the FIRST element with that id, so
 * tapping the visible "Passport" label on a non-British member opened the
 * hidden UK-passport control's file input: the file uploaded, was written to
 * `ukPassportDocumentId`, and its success card rendered inside the collapsed
 * branch. To the applicant the upload simply vanished.
 *
 * The resolution is that a family member has ONE passport, not two. There is a
 * single passport document per member; the citizenship answer changes what we
 * call it and whether evidence of Indefinite Leave to Remain is *also*
 * required. `ukPassportDocumentId` is retained read-only for back-compat with
 * applications saved before this fix.
 *
 * Keep every kind's slot distinct — two documents that mean different things
 * must never share a slot key.
 */

/** The kinds of identity document a family member can supply. */
export const FAMILY_ID_DOCUMENT_KINDS = ["PASSPORT", "ILR"] as const;

export type FamilyIdDocumentKind = (typeof FAMILY_ID_DOCUMENT_KINDS)[number];

/** Slot prefix per kind. One prefix per kind — never reuse one. */
const SLOT_PREFIX: Record<FamilyIdDocumentKind, string> = {
  PASSPORT: "FAMILY_ID_PASSPORT",
  ILR: "FAMILY_ID_ILR",
};

/**
 * The storage slot for one family member's identity document.
 *
 * `index` is the member's position in the `familyMembers` array — the same
 * index the section-gap rules use, so a slot computed here and a slot computed
 * there always agree.
 */
export function familyIdSlot(
  kind: FamilyIdDocumentKind,
  index: number
): string {
  return `${SLOT_PREFIX[kind]}_${index}`;
}

/** The shape this module reads off a saved family member. */
export interface FamilyIdDocumentFields {
  passportDocumentId?: string;
  ilrDocumentId?: string;
  /**
   * Legacy: written by the pre-F2 "UK Passport" control. Read-only now — the
   * form resolves it so those documents keep showing, but never writes it.
   */
  ukPassportDocumentId?: string;
}

function asId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The member's passport document, wherever it was filed.
 *
 * Prefers the current field and falls back to the legacy one, so a passport
 * uploaded before this fix — including one misrouted into
 * `ukPassportDocumentId` by the shared-slot bug — is still surfaced instead of
 * being stranded in a branch the form no longer renders.
 */
export function passportDocumentIdOf(
  member: FamilyIdDocumentFields | Record<string, unknown> | null | undefined
): string | undefined {
  if (!member || typeof member !== "object") return undefined;
  const m = member as Record<string, unknown>;
  return asId(m.passportDocumentId) ?? asId(m.ukPassportDocumentId);
}

/** The member's Indefinite-Leave-to-Remain evidence, if any. */
export function ilrDocumentIdOf(
  member: FamilyIdDocumentFields | Record<string, unknown> | null | undefined
): string | undefined {
  if (!member || typeof member !== "object") return undefined;
  return asId((member as Record<string, unknown>).ilrDocumentId);
}

/**
 * Every identity document currently attached to a member, keyed by kind.
 *
 * Independent of the citizenship answer on purpose: a document the applicant
 * uploaded must stay reachable even if they later change that answer.
 */
export function familyIdDocuments(
  member: FamilyIdDocumentFields | Record<string, unknown> | null | undefined
): Partial<Record<FamilyIdDocumentKind, string>> {
  const documents: Partial<Record<FamilyIdDocumentKind, string>> = {};
  const passport = passportDocumentIdOf(member);
  if (passport) documents.PASSPORT = passport;
  const ilr = ilrDocumentIdOf(member);
  if (ilr) documents.ILR = ilr;
  return documents;
}
