/**
 * ApplicationContributor database queries (dual-parent feature, backlog #20).
 *
 * All functions return plain objects safe for Server → Client prop passing.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  ApplicationContributorRole,
  type ApplicationContributorStatus,
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
