/**
 * Invitation database queries.
 *
 * All functions return plain objects safe for Server → Client prop passing.
 */

import { prisma } from "@/lib/db/prisma";
import {
  InvitationStatus,
  BursaryAccountStatus,
  type Invitation,
  type School,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvitationWithCreator extends Invitation {
  creator: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  round: {
    id: string;
    academicYear: string;
  } | null;
}

export interface ActiveBursaryHolder {
  id: string;
  reference: string;
  school: School;
  childName: string;
  leadApplicant: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

// ---------------------------------------------------------------------------
// listInvitations
// ---------------------------------------------------------------------------

/**
 * Returns invitations ordered by creation date descending.
 * Optionally filtered by roundId and/or status.
 */
export async function listInvitations(filters?: {
  roundId?: string;
  status?: InvitationStatus;
}): Promise<InvitationWithCreator[]> {
  return prisma.invitation.findMany({
    where: {
      ...(filters?.roundId ? { roundId: filters.roundId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      round: {
        select: {
          id: true,
          academicYear: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// createInvitation
// ---------------------------------------------------------------------------

/**
 * Creates an invitation record with status PENDING.
 */
export async function createInvitation(data: {
  email: string;
  applicantName?: string;
  childName?: string;
  school?: School;
  roundId?: string;
  bursaryAccountId?: string;
  createdBy: string;
  expiresAt: Date;
}): Promise<Invitation> {
  return prisma.invitation.create({
    data: {
      email: data.email,
      applicantName: data.applicantName ?? null,
      childName: data.childName ?? null,
      school: data.school ?? null,
      roundId: data.roundId ?? null,
      bursaryAccountId: data.bursaryAccountId ?? null,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt,
      status: InvitationStatus.PENDING,
    },
  });
}

// ---------------------------------------------------------------------------
// updateInvitationStatus
// ---------------------------------------------------------------------------

/**
 * Updates the status of an invitation.
 * When status is ACCEPTED, also records acceptedAt timestamp and authUserId.
 */
export async function updateInvitationStatus(
  id: string,
  status: InvitationStatus,
  authUserId?: string
): Promise<Invitation> {
  return prisma.invitation.update({
    where: { id },
    data: {
      status,
      ...(status === InvitationStatus.ACCEPTED
        ? {
            acceptedAt: new Date(),
            ...(authUserId ? { authUserId } : {}),
          }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// getActiveBursaryHolders
// ---------------------------------------------------------------------------

/**
 * Returns all active bursary accounts that do not yet have an invitation for
 * the specified round. Used to populate batch re-assessment invitations.
 */
export async function getActiveBursaryHolders(
  roundId: string
): Promise<ActiveBursaryHolder[]> {
  // Find bursary account IDs that already have an invitation for this round
  const existingInvitations = await prisma.invitation.findMany({
    where: { roundId },
    select: { bursaryAccountId: true },
  });
  const alreadyInvitedIds = new Set(
    existingInvitations
      .map((i) => i.bursaryAccountId)
      .filter((id): id is string => id !== null)
  );

  const accounts = await prisma.bursaryAccount.findMany({
    where: {
      status: BursaryAccountStatus.ACTIVE,
      id: alreadyInvitedIds.size > 0
        ? { notIn: Array.from(alreadyInvitedIds) }
        : undefined,
    },
    include: {
      leadApplicant: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { reference: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    reference: account.reference,
    school: account.school,
    childName: account.childName,
    leadApplicant: account.leadApplicant,
  }));
}
