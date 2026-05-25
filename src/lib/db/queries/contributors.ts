/**
 * ApplicationContributor database queries (dual-parent feature, backlog #20).
 *
 * All functions return plain objects safe for Server → Client prop passing.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  ApplicationContributorRole,
  ApplicationContributorStatus,
} from "@prisma/client";

export interface SecondaryContributorSummary {
  id: string;
  status: ApplicationContributorStatus;
  email: string;
  firstName: string | null;
  lastName: string | null;
  invitedAt: Date | null;
  submittedAt: Date | null;
}

/**
 * Returns the SECONDARY contributor for an application (the second parent),
 * or null if no second parent has been added. Includes the linked profile's
 * contact name/email so the admin UI can show who was invited and their
 * current status (invited / in-progress / submitted).
 */
export async function getSecondaryContributor(
  tx: Tx,
  applicationId: string
): Promise<SecondaryContributorSummary | null> {
  const contributor = await tx.applicationContributor.findUnique({
    where: {
      applicationId_role: {
        applicationId,
        role: ApplicationContributorRole.SECONDARY,
      },
    },
    select: {
      id: true,
      status: true,
      invitedAt: true,
      submittedAt: true,
      profile: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!contributor) return null;

  return {
    id: contributor.id,
    status: contributor.status,
    email: contributor.profile.email,
    firstName: contributor.profile.firstName,
    lastName: contributor.profile.lastName,
    invitedAt: contributor.invitedAt,
    submittedAt: contributor.submittedAt,
  };
}

/**
 * Idempotently ensures the PRIMARY contributor row exists for an application
 * and returns its id (dual-parent foundation, PR 4a).
 *
 * Every application has exactly one PRIMARY contributor (the lead applicant) —
 * existing applications were backfilled in PR 1, and the section-owner NOT NULL
 * migration backfills any created in between. Newly-created applications must
 * call this immediately after `application.create` (within the SAME
 * transaction) so the "every section is owned by a contributor" invariant holds
 * from the first write.
 *
 * Keyed on `UNIQUE(application_id, role=PRIMARY)`: a concurrent or repeated call
 * is a no-op `update: {}`. The lead applicant's contributor starts IN_PROGRESS
 * (they are actively filling in the application, unlike an INVITED secondary).
 *
 * @returns the PRIMARY contributor id.
 */
export async function ensurePrimaryContributor(
  tx: Tx,
  applicationId: string,
  leadApplicantId: string
): Promise<string> {
  const contributor = await tx.applicationContributor.upsert({
    where: {
      applicationId_role: {
        applicationId,
        role: ApplicationContributorRole.PRIMARY,
      },
    },
    create: {
      applicationId,
      profileId: leadApplicantId,
      role: ApplicationContributorRole.PRIMARY,
      status: ApplicationContributorStatus.IN_PROGRESS,
      invitedAt: new Date(),
    },
    update: {},
    select: { id: true },
  });

  return contributor.id;
}

/**
 * Resolves the contributor id that the given profile owns on an application
 * (PRIMARY or SECONDARY), or null if the profile is not a contributor.
 *
 * Used by the section write path to tag the right owner: for the lead applicant
 * this resolves to their PRIMARY contributor; for the second parent (PR 4b) it
 * resolves to their SECONDARY contributor. Relies on
 * `UNIQUE(application_id, profile_id)` — a profile is linked at most once.
 */
export async function resolveOwningContributorId(
  tx: Tx,
  applicationId: string,
  profileId: string
): Promise<string | null> {
  const contributor = await tx.applicationContributor.findUnique({
    where: {
      applicationId_profileId: {
        applicationId,
        profileId,
      },
    },
    select: { id: true },
  });

  return contributor?.id ?? null;
}

/**
 * The application a given profile is the SECONDARY contributor of, resolved
 * from the session (NOT a client-supplied applicationId).
 *
 * A SECONDARY contributor is not a lead applicant and owns no application of
 * their own; they were invited to supply their financials on a child's
 * application owned by the PRIMARY parent. This helper finds that single
 * application + the caller's own SECONDARY contributor id, plus the read-only
 * child context the secondary is allowed to see (name + school).
 *
 * It is the secondary-side analogue of `getOwnedApplicationContext` in
 * apply/actions.ts and underpins the IDOR-hardening of every /contribute
 * action: the application is derived from the authenticated profile, never
 * trusted from the request.
 *
 * MUST be called inside a `withUserContext(profileId, "APPLICANT", …)`
 * transaction. Under RLS the secondary may SELECT their own contributor row
 * and (via applications_secondary_select) the child-context application row —
 * both reads are allowed. Returns null if the profile is not a SECONDARY
 * contributor of any application.
 */
export interface SecondaryContributorContext {
  applicationId: string;
  contributorId: string;
  status: ApplicationContributorStatus;
  childName: string;
  school: string;
  /** The round's academic year (e.g. "2026-2027"), for email copy. */
  roundYear: string | null;
}

export async function getSecondaryContributorContext(
  tx: Tx,
  profileId: string
): Promise<SecondaryContributorContext | null> {
  const contributor = await tx.applicationContributor.findFirst({
    where: {
      profileId,
      role: ApplicationContributorRole.SECONDARY,
    },
    select: {
      id: true,
      status: true,
      application: {
        select: {
          id: true,
          childName: true,
          school: true,
          round: { select: { academicYear: true } },
        },
      },
    },
    orderBy: { invitedAt: "desc" },
  });

  if (!contributor) return null;

  return {
    applicationId: contributor.application.id,
    contributorId: contributor.id,
    status: contributor.status,
    childName: contributor.application.childName,
    school: contributor.application.school,
    roundYear: contributor.application.round?.academicYear ?? null,
  };
}
