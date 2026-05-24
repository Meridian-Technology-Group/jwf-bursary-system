/**
 * Staff invitation database queries.
 *
 * Mirrors the applicant `invitations.ts` shape: every function takes a
 * Prisma transaction (`tx`) as its first argument so the caller controls
 * the RLS context (typically `withAdminContext` for staff invite work).
 */

import { InvitationStatus, type Role, type StaffInvitation } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { generateInvitationToken } from "@/lib/db/queries/invitation-token";

// ---------------------------------------------------------------------------
// createStaffInvitation
// ---------------------------------------------------------------------------

export interface CreateStaffInvitationInput {
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  authUserId: string;
  createdBy: string;
  /** Time-to-live in hours. Defaults to 72 hours. */
  ttlHours?: number;
}

/**
 * Creates a StaffInvitation row with status PENDING and a fresh token.
 */
export async function createStaffInvitation(
  tx: Tx,
  input: CreateStaffInvitationInput
): Promise<StaffInvitation> {
  const ttl = input.ttlHours ?? 72;
  const expiresAt = new Date(Date.now() + ttl * 3_600_000);

  return tx.staffInvitation.create({
    data: {
      email: input.email.toLowerCase(),
      role: input.role,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      authUserId: input.authUserId,
      createdBy: input.createdBy,
      token: generateInvitationToken(),
      expiresAt,
      status: InvitationStatus.PENDING,
    },
  });
}

// ---------------------------------------------------------------------------
// getStaffInvitationByToken
// ---------------------------------------------------------------------------

/**
 * Looks up a StaffInvitation by its single-use token. Returns null if not
 * found. Status / expiry validation is the caller's responsibility.
 */
export async function getStaffInvitationByToken(
  tx: Tx,
  token: string
): Promise<StaffInvitation | null> {
  return tx.staffInvitation.findUnique({ where: { token } });
}

// ---------------------------------------------------------------------------
// markStaffInvitationAccepted
// ---------------------------------------------------------------------------

/**
 * Marks a StaffInvitation as ACCEPTED and stamps acceptedAt.
 */
export async function markStaffInvitationAccepted(
  tx: Tx,
  id: string
): Promise<StaffInvitation> {
  return tx.staffInvitation.update({
    where: { id },
    data: {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// listPendingStaffInvitations
// ---------------------------------------------------------------------------

/**
 * Returns all PENDING staff invitations ordered by most-recent first, plus
 * the email of the admin who created each one (for the "Sent By" column).
 */
export async function listPendingStaffInvitations(tx: Tx) {
  return tx.staffInvitation.findMany({
    where: { status: InvitationStatus.PENDING },
    orderBy: { createdAt: "desc" },
    include: {
      inviter: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// regenerateStaffInvitationToken
// ---------------------------------------------------------------------------

/**
 * Issues a fresh token and a fresh TTL on an existing PENDING staff
 * invitation. Returns the updated row so the caller can send the new link.
 */
export async function regenerateStaffInvitationToken(
  tx: Tx,
  id: string,
  ttlHours = 72
): Promise<StaffInvitation> {
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  return tx.staffInvitation.update({
    where: { id },
    data: {
      token: generateInvitationToken(),
      expiresAt,
    },
  });
}

// ---------------------------------------------------------------------------
// markStaffInvitationExpired
// ---------------------------------------------------------------------------

/**
 * Revokes a staff invitation by flipping its status to EXPIRED. Returns the
 * updated row (or null when no row matched / not PENDING).
 */
export async function markStaffInvitationExpired(
  tx: Tx,
  id: string
): Promise<StaffInvitation | null> {
  const existing = await tx.staffInvitation.findUnique({ where: { id } });
  if (!existing || existing.status !== InvitationStatus.PENDING) return null;
  return tx.staffInvitation.update({
    where: { id },
    data: { status: InvitationStatus.EXPIRED },
  });
}
