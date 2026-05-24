/**
 * Shared invitation-token primitive.
 *
 * Both the applicant (`invitations.ts`) and staff (`staff-invitations.ts`)
 * flows issue single-use tokens with an identical shape. Keeping the
 * generator in one place removes the drift risk called out in
 * docs/backlog/shared-generateInvitationToken-helper.md (#4): tuning the byte
 * count or encoding here updates both flows at once.
 */

import { randomBytes } from "node:crypto";

/**
 * Generates a URL-safe single-use invitation token.
 * 32 random bytes encoded as base64url ≈ 43 chars of entropy.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}
