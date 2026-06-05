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

import type { EntryYearGroup, School } from "@prisma/client";
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
  entryYearGroup?: EntryYearGroup | null;
  /** The contact this application is seeded from, when invited from a contact. */
  contactId?: string | null;
}

/**
 * True when the source carries the minimum set to create the application here
 * (school + childName + roundId). Without it the caller falls back to the
 * portal onboarding card, where the applicant supplies the missing pieces —
 * EXCEPT school/entryYear, which remain locked once the contact fixes them.
 */
export function canCreateFirstYearApplication(
  source: FirstYearApplicationSource
): boolean {
  return Boolean(source.school && source.childName && source.roundId);
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
      "Cannot create application: invitation/contact is missing school, child name or round."
    );
  }

  const round = await tx.round.findUnique({
    where: { id: source.roundId! },
    select: { academicYear: true },
  });

  const reference = await generateApplicationReference(
    tx,
    source.school!,
    round?.academicYear ?? ""
  );

  const application = await tx.application.create({
    data: {
      reference,
      roundId: source.roundId!,
      leadApplicantId: source.leadApplicantId,
      school: source.school!,
      childName: source.childName!,
      // LOCKED entry-year (D1): set from the source, never the parent. Null
      // when the contact did not capture a year-group (entryYear is required on
      // a contact, but entryYearGroup is optional).
      entryYear: source.entryYear ?? null,
      entryYearGroup: source.entryYearGroup ?? null,
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
