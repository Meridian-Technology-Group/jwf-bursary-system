/**
 * Responding to a missing-documents request (audit 20 Nov 2026, finding 6).
 *
 * The assessor's request usually names slots that already hold a document —
 * the one that was wrong or unverified. So a slot only counts as answered by a
 * file uploaded AFTER the request; the earlier file stays on the application
 * (Brian, 20 Nov: keep both, so the assessor can compare) but no longer
 * satisfies the request. Shared by the /respond page and the server action so
 * the button and the gate cannot disagree.
 *
 * Pure module: safe for client and server.
 */

import { humaniseSlot } from "@/lib/documents/slots";

export interface SlotDocument {
  slot: string;
  uploadedAt: Date;
}

/** Requested slots with no document uploaded after `requestedAt`, in request order. */
export function slotsStillNeeded(
  requestedSlots: readonly string[],
  documents: readonly SlotDocument[],
  requestedAt: Date
): string[] {
  return requestedSlots.filter(
    (slot) =>
      !documents.some(
        (d) => d.slot === slot && d.uploadedAt.getTime() > requestedAt.getTime()
      )
  );
}

/**
 * A slot's label split into the document name and an optional "Parent N"
 * qualifier, e.g. BANK_STATEMENT_PARENT_1 → "Bank Statement" / "Parent 1".
 */
export function slotLabel(slot: string): { primary: string; qualifier: string | null } {
  const match = slot.match(/_PARENT_(\d)$/);
  if (match) {
    return {
      primary: humaniseSlot(slot.replace(/_PARENT_\d$/, "")),
      qualifier: `Parent ${match[1]}`,
    };
  }
  return { primary: humaniseSlot(slot), qualifier: null };
}

/** "Bank Statement — Parent 1" */
export function slotDisplayName(slot: string): string {
  const { primary, qualifier } = slotLabel(slot);
  return qualifier ? `${primary} — ${qualifier}` : primary;
}

/** The refusal shown when Send is pressed before every slot has a new file. */
export function stillNeededMessage(slots: readonly string[]): string {
  return `Please upload a new copy of: ${slots
    .map(slotDisplayName)
    .join(", ")}. The documents you sent earlier are still on file, but the assessor has asked for new ones.`;
}
