/**
 * Invitation database queries.
 *
 * All functions return plain objects safe for Server → Client prop passing.
 */

import type { Tx } from "@/lib/db/prisma";
import {
  InvitationStatus,
  BursaryAccountStatus,
  type Invitation,
  type School,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

/**
 * Re-exported from the shared `invitation-token` module so the applicant and
 * staff flows share a single token primitive (see #4). Kept as a named
 * re-export here to avoid churning existing import sites.
 */
export { generateInvitationToken } from "@/lib/db/queries/invitation-token";
import { generateInvitationToken } from "@/lib/db/queries/invitation-token";

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
export async function listInvitations(
  tx: Tx,
  filters?: {
    roundId?: string;
    status?: InvitationStatus;
  }
): Promise<InvitationWithCreator[]> {
  return tx.invitation.findMany({
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
 *
 * `token` is auto-generated via `generateInvitationToken()` when the caller
 * does not supply one. `firstName`, `lastName`, and `authUserId` are
 * optional: callers that only know the email can omit them, while the
 * hardened path passes all three so the acceptance flow can skip the
 * `auth.users` paged scan. The applicant display name is derived from
 * `firstName`/`lastName`; the legacy `applicantName` column is no longer
 * written and is being retired (backlog #9).
 */
export async function createInvitation(
  tx: Tx,
  data: {
    email: string;
    firstName?: string;
    lastName?: string;
    childName?: string;
    school?: School;
    roundId?: string;
    bursaryAccountId?: string;
    applicationId?: string;
    authUserId?: string;
    token?: string;
    createdBy: string;
    expiresAt: Date;
  }
): Promise<Invitation> {
  return tx.invitation.create({
    data: {
      email: data.email,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      childName: data.childName ?? null,
      school: data.school ?? null,
      roundId: data.roundId ?? null,
      bursaryAccountId: data.bursaryAccountId ?? null,
      applicationId: data.applicationId ?? null,
      authUserId: data.authUserId ?? null,
      token: data.token ?? generateInvitationToken(),
      createdBy: data.createdBy,
      expiresAt: data.expiresAt,
      status: InvitationStatus.PENDING,
    },
  });
}

// ---------------------------------------------------------------------------
// getInvitationByToken
// ---------------------------------------------------------------------------

/**
 * Looks up an Invitation by its single-use token. Returns null if not
 * found. Status / expiry validation is the caller's responsibility, mirroring
 * `getStaffInvitationByToken`.
 */
export async function getInvitationByToken(
  tx: Tx,
  token: string
): Promise<Invitation | null> {
  return tx.invitation.findUnique({ where: { token } });
}

// ---------------------------------------------------------------------------
// markInvitationAccepted
// ---------------------------------------------------------------------------

/**
 * Marks an Invitation as ACCEPTED and stamps `acceptedAt`. Optionally writes
 * `authUserId` when the caller has just provisioned (or confirmed) the
 * Supabase auth user. Mirrors `markStaffInvitationAccepted`.
 */
export async function markInvitationAccepted(
  tx: Tx,
  id: string,
  authUserId?: string
): Promise<Invitation> {
  return tx.invitation.update({
    where: { id },
    data: {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
      ...(authUserId ? { authUserId } : {}),
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
  tx: Tx,
  id: string,
  status: InvitationStatus,
  authUserId?: string
): Promise<Invitation> {
  return tx.invitation.update({
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
// getLatestAcceptedInvitationForUser
// ---------------------------------------------------------------------------

/**
 * Returns the most-recently-accepted invitation for the given Supabase auth
 * user ID, or null if none exists.
 *
 * Used by the portal dashboard to decide whether to render the onboarding
 * card (invitation present but Application not yet created) versus the
 * no-invitation fallback state.
 */
export async function getLatestAcceptedInvitationForUser(
  tx: Tx,
  userId: string
): Promise<Invitation | null> {
  return tx.invitation.findFirst({
    where: {
      authUserId: userId,
      status: InvitationStatus.ACCEPTED,
    },
    orderBy: { acceptedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// getOrAcceptLatestInvitationForUser
// ---------------------------------------------------------------------------

/**
 * Self-healing variant for the portal dashboard. Returns the most recent
 * invitation for the user regardless of status, and auto-flips a PENDING
 * row to ACCEPTED on read so a returning applicant who logs in directly
 * (without using the /register?token=… link) does not see "No invitation
 * found" on their dashboard.
 *
 * Why: applicants whose auth user was pre-provisioned (intake creates the
 * Supabase user up front, see queue/actions.ts) can sign in with a known
 * password before they ever click the invitation link. Without this
 * auto-accept the dashboard query (ACCEPTED-only) returns null and the
 * onboarding card never appears.
 *
 * IMPORTANT — re-assessment invitations are NOT auto-accepted here. A
 * re-assessment invite (identified by a non-null `bursaryAccountId`) is
 * consumed lazily by the "Begin re-assessment" card, which both creates the
 * application AND pre-populates it from the previous year. If we flipped it
 * to ACCEPTED on login the card's accept step (which only acts on PENDING
 * rows) would refuse, leaving the holder with no way to start — the exact
 * dead-end documented in the walkthrough backlog. So we leave re-assessment
 * rows PENDING and return them as-is for the dashboard to surface.
 *
 * Must be called from an admin context — writes to invitations.status are
 * not granted to the app_user role under RLS.
 */
export async function getOrAcceptLatestInvitationForUser(
  tx: Tx,
  userId: string
): Promise<Invitation | null> {
  const invitation = await tx.invitation.findFirst({
    where: { authUserId: userId },
    orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!invitation) return null;
  if (invitation.status === InvitationStatus.ACCEPTED) return invitation;
  if (invitation.status !== InvitationStatus.PENDING) return null;

  // Re-assessment invites stay PENDING — consumed by the Begin card instead.
  if (invitation.bursaryAccountId) return invitation;

  // Secondary-parent invites (applicationId set) must be accepted through the
  // /register?token=… flow so the matching SECONDARY contributor is flipped to
  // IN_PROGRESS (see acceptApplicantInvitationAction). Auto-accepting on a bare
  // login here would mark the invitation ACCEPTED without advancing the
  // contributor, stranding them. Leave it PENDING and return as-is.
  if (invitation.applicationId) return invitation;

  return tx.invitation.update({
    where: { id: invitation.id },
    data: {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
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
  tx: Tx,
  roundId: string
): Promise<ActiveBursaryHolder[]> {
  // Find bursary account IDs that already have an invitation for this round
  const existingInvitations = await tx.invitation.findMany({
    where: { roundId },
    select: { bursaryAccountId: true },
  });
  const alreadyInvitedIds = new Set(
    existingInvitations
      .map((i) => i.bursaryAccountId)
      .filter((id): id is string => id !== null)
  );

  const accounts = await tx.bursaryAccount.findMany({
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
