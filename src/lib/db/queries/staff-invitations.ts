/**
 * Staff invitation database queries.
 *
 * Mirrors the applicant `invitations.ts` shape: every function takes a
 * Prisma transaction (`tx`) as its first argument so the caller controls
 * the RLS context (typically `withAdminContext` for staff invite work).
 */

import { randomBytes } from "node:crypto";
import { InvitationStatus, type Role, type StaffInvitation } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

/**
 * Generates a URL-safe single-use invitation token.
 * 32 random bytes encoded as base64url = ~43 chars of entropy.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

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
