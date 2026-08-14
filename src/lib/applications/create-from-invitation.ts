/**
 * Shared "create a first-year application from an invitation" helper (Epic 04).
 *
 * Three paths used to duplicate this create logic — the registration accept
 * path (`register/actions.ts`), the portal onboarding card
 * (`(portal)/actions.ts`), and now the from-contact invite. Duplication risked
 * the locked-school/year invariant (D1) drifting between them. This is the ONE
 * place a first-year (NEW) application is created from invitation/contact data,
 * so the lock is enforced in exactly one place:
 *
 *   school, entryYear and entryYearGroup are written from the SOURCE (the
 *   invitation, which itself was seeded from the contact). The parent never
 *   supplies them. `contactId` ties the application back to its contact.
 *
 * Returns the created application id, or null when the required locked fields
 * are absent (caller decides whether that's an error or a fall-through to the
 * onboarding card).
 */

import type {
  ApplicationType,
  CustodyArrangement,
  EntryYearGroup,
  School,
} from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { generateApplicationReference } from "@/lib/applications/reference";
import { applicationCreateData } from "@/lib/applications/status";
import { ensurePrimaryContributor } from "@/lib/db/queries/contributors";

export interface FirstYearApplicationSource {
  leadApplicantId: string;
  roundId: string | null;
  school: School | null;
  childName: string | null;
  /** Locked entry-year, carried from the contact via the invitation (D1). */
  entryYear?: number | null;
  /**
   * Locked entry year-group, carried from the contact via the invitation (D1).
   * REQUIRED as of Q1 (Brian, 2026-08-14): the applicant can no longer supply
   * an entry year-group anywhere, so the column set here is the SOLE source for
   * the assessment engine, reports and exports. Declared non-optional (though
   * nullable) so every call site has to pass it explicitly; a null is rejected
   * at runtime by `canCreateFirstYearApplication` below.
   */
  entryYearGroup: EntryYearGroup | null;
  /** The contact this application is seeded from, when invited from a contact. */
  contactId?: string | null;
}

/**
 * True when the source carries the minimum set to create the application here
 * (school + childName + roundId + entryYearGroup). Without it the caller falls
 * back to the portal onboarding card, where the applicant supplies the missing
 * pieces — EXCEPT school/entry-year, which remain locked once the contact fixes
 * them and which the applicant can never supply.
 */
export function canCreateFirstYearApplication(
  source: FirstYearApplicationSource
): boolean {
  return Boolean(
    source.school &&
      source.childName &&
      source.roundId &&
      source.entryYearGroup
  );
}

/**
 * Creates the NEW first-year application with LOCKED school / entry-year from
 * the source, ensures its PRIMARY contributor, and returns the new id. Throws
 * if called without the required locked fields (guard with
 * `canCreateFirstYearApplication` first). Idempotency (one app per lead per
 * round) is the caller's responsibility — every caller already checks for an
 * existing application first.
 */
export async function createFirstYearApplicationFromSource(
  tx: Tx,
  source: FirstYearApplicationSource
): Promise<string> {
  if (!canCreateFirstYearApplication(source)) {
    throw new Error(
      "Cannot create application: invitation/contact is missing school, child name, round or entry year group."
    );
  }

  const round = await tx.round.findUnique({
    where: { id: source.roundId! },
    select: { academicYear: true },
  });

  const reference = generateApplicationReference({
    childName: source.childName,
    school: source.school,
    entryYearGroup: source.entryYearGroup,
    academicYear: round?.academicYear,
  });

  const application = await tx.application.create({
    data: {
      reference,
      roundId: source.roundId!,
      leadApplicantId: source.leadApplicantId,
      school: source.school!,
      childName: source.childName!,
      // LOCKED entry-year (D1): set from the source, never the parent. Both are
      // now MANDATORY admin-side (Q1) — the guard above rejects a source without
      // an entry year-group, so the column can never be left null on a
      // freshly-created application.
      entryYear: source.entryYear ?? null,
      entryYearGroup: source.entryYearGroup,
      contactId: source.contactId ?? null,
      isReassessment: false,
      ...applicationCreateData("NEW"),
    },
  });

  // Every application must have a PRIMARY contributor from creation so the
  // section write path can tag the owner (dual-parent foundation).
  await ensurePrimaryContributor(tx, application.id, source.leadApplicantId);

  return application.id;
}

// ───────────────────────────────────────────────────────────────────────────
// Full Rejection — hard-delete + recreate ("void + new")
// ───────────────────────────────────────────────────────────────────────────

/**
 * The carry-over identity of the application being restarted. These are the
 * fields the fresh application inherits verbatim from the rejected one — the
 * child/round identity, the locked entry-year/school (D1), and the bursary-
 * account link (for a ROLLING_OVER re-assessment). NOT carried: any form data,
 * documents, or assessment — the new application starts blank ("from scratch").
 */
export interface RejectedApplicationSource {
  id: string;
  reference: string;
  roundId: string;
  leadApplicantId: string;
  school: School;
  childName: string;
  childDob: Date | null;
  entryYear: number | null;
  entryYearGroup: EntryYearGroup | null;
  contactId: string | null;
  isReassessment: boolean;
  applicationType: ApplicationType;
  bursaryAccountId: string | null;
  custodyArrangement: CustodyArrangement;
}

/**
 * Voids a rejected application and creates a fresh blank one in its place
 * ("Full Rejection" → restart). Because of the
 * `@@unique([roundId, leadApplicantId, childName, childDob])` constraint, the
 * rejected application cannot coexist with its replacement, so it is
 * hard-deleted (the row's cascades remove its sections, contributors,
 * documents, assessment and invitations) and the new application REUSES the old
 * `reference`. The reuse is deliberate continuity, not a uniqueness workaround:
 * since D13-1a the reference is a non-unique label, so a restart could equally
 * regenerate one — but the applicant has already been told this reference, and
 * a restart is the same child in the same round.
 *
 * Storage objects are NOT removed here — the DB cascade only drops the Document
 * rows. The caller captures each `storagePath` BEFORE calling this and deletes
 * the Storage objects after the transaction commits (non-fatal cleanup).
 *
 * Runs inside the caller's transaction: the delete precedes the insert so the
 * unique tuple is free when the new row is written. Returns the new app id.
 */
export async function restartApplicationFromRejection(
  tx: Tx,
  source: RejectedApplicationSource
): Promise<string> {
  // Delete the rejected application first — cascades clear its sections,
  // contributors, documents, assessment and invitations, and free both the
  // unique child/round tuple and the reference for reuse below.
  await tx.application.delete({ where: { id: source.id } });

  const application = await tx.application.create({
    data: {
      reference: source.reference,
      roundId: source.roundId,
      leadApplicantId: source.leadApplicantId,
      school: source.school,
      childName: source.childName,
      childDob: source.childDob,
      entryYear: source.entryYear,
      entryYearGroup: source.entryYearGroup,
      contactId: source.contactId,
      bursaryAccountId: source.bursaryAccountId,
      isReassessment: source.isReassessment,
      custodyArrangement: source.custodyArrangement,
      ...applicationCreateData(source.applicationType),
    },
  });

  await ensurePrimaryContributor(tx, application.id, source.leadApplicantId);

  return application.id;
}
