/**
 * Secondary-contributor GDPR helpers (dual-parent feature, backlog #20, PR 6).
 *
 * These functions extend the existing single-applicant GDPR cascade
 * (`gdprDeleteApplicantAction`) to a SECONDARY contributor (the second parent
 * in a separated/divorced application).
 *
 * The crux is the **shared-profile guard**: a SECONDARY parent's Profile may be
 * DEDUPED across applications (the same person can be a lead applicant on
 * another child's application, or a secondary on another application — see
 * `addSecondParentAction`). Erasing a profile/auth user that is still lawfully
 * linked elsewhere would destroy unrelated records and access. So before we
 * anonymise the secondary's Profile and delete their Supabase auth user we must
 * confirm the profile is linked to NOTHING beyond the application being erased.
 *
 * All functions take a transaction client and MUST run inside
 * `withAdminContext` — the GDPR cascade bypasses RLS for full visibility.
 */

import type { Tx } from "@/lib/db/prisma";
import { ApplicationContributorRole } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The SECONDARY contributor of an application, resolved for the GDPR cascade.
 * Carries the contributor row id (to delete its sections/docs/link) and the
 * linked profileId (to decide whether the Profile/auth user can be erased).
 */
export interface SecondaryContributorForGdpr {
  contributorId: string;
  profileId: string;
  email: string;
}

/**
 * The outcome of the shared-profile guard: whether the secondary's Profile +
 * Supabase auth user may be erased, and why.
 */
export interface SecondaryProfileLinkDecision {
  /**
   * True → the profile is linked ONLY to the application being erased, so it is
   * safe to anonymise the Profile and delete the Supabase auth user (mirroring
   * the lead-applicant treatment). False → the profile is lawfully linked
   * elsewhere and MUST be retained.
   */
  canErase: boolean;
  /** Other ApplicationContributor links (different applications). */
  otherContributorLinks: number;
  /** Applications where this profile is the leadApplicant. */
  leadApplicantApplications: number;
  /** BursaryAccounts owned by this profile (as lead applicant). */
  bursaryAccounts: number;
}

// ─── getSecondaryContributorForGdpr ────────────────────────────────────────────

/**
 * Returns the SECONDARY contributor of an application (id + linked profile),
 * or null if the application has no second parent. Used by the GDPR cascade to
 * decide whether secondary erasure is required at all.
 */
export async function getSecondaryContributorForGdpr(
  tx: Tx,
  applicationId: string
): Promise<SecondaryContributorForGdpr | null> {
  const contributor = await tx.applicationContributor.findUnique({
    where: {
      applicationId_role: {
        applicationId,
        role: ApplicationContributorRole.SECONDARY,
      },
    },
    select: {
      id: true,
      profileId: true,
      profile: { select: { email: true } },
    },
  });

  if (!contributor) return null;

  return {
    contributorId: contributor.id,
    profileId: contributor.profileId,
    email: contributor.profile.email,
  };
}

// ─── decideSecondaryProfileErasure (the shared-profile guard) ──────────────────

/**
 * Decides whether the secondary parent's Profile + Supabase auth user may be
 * erased as part of erasing ONE application, or whether they must be retained
 * because the profile is lawfully linked elsewhere.
 *
 * The profile is considered "linked elsewhere" — and therefore RETAINED — if
 * ANY of the following hold, scoped to exclude the application being erased:
 *
 *   1. They are a contributor (PRIMARY or SECONDARY) on a DIFFERENT application
 *      (`ApplicationContributor.applicationId != applicationId`). This catches
 *      the deduped case where S is a second parent on App1 AND a lead applicant
 *      (hence PRIMARY contributor) on App2, and the case where S is a second
 *      parent on two different children's applications.
 *   2. They are the `leadApplicantId` of a DIFFERENT application. (Belt-and-
 *      braces alongside (1): every lead applicant also has a PRIMARY contributor
 *      row, but we check the application table directly so the guard does not
 *      depend on the PRIMARY-contributor backfill invariant.)
 *   3. They own a BursaryAccount (active or closed) — a long-lived per-child
 *      account that grants them re-assessment access in future rounds.
 *
 * Only when NONE of these hold is the profile linked solely to the application
 * being erased, and erasure (anonymise Profile + delete auth user) is safe.
 *
 * MUST run under `withAdminContext` so the counts are not narrowed by RLS.
 */
export async function decideSecondaryProfileErasure(
  tx: Tx,
  profileId: string,
  applicationIdBeingErased: string
): Promise<SecondaryProfileLinkDecision> {
  const [otherContributorLinks, leadApplicantApplications, bursaryAccounts] =
    await Promise.all([
      tx.applicationContributor.count({
        where: {
          profileId,
          applicationId: { not: applicationIdBeingErased },
        },
      }),
      tx.application.count({
        where: {
          leadApplicantId: profileId,
          id: { not: applicationIdBeingErased },
        },
      }),
      tx.bursaryAccount.count({
        where: { leadApplicantId: profileId },
      }),
    ]);

  const canErase =
    otherContributorLinks === 0 &&
    leadApplicantApplications === 0 &&
    bursaryAccounts === 0;

  return {
    canErase,
    otherContributorLinks,
    leadApplicantApplications,
    bursaryAccounts,
  };
}
