"use server";

/**
 * Server actions for login.
 */

import { isStaffMfaEnforced } from "@/lib/auth/mfa-flag";

/**
 * Whether staff sign-in should be routed through the MFA step. Exposes the
 * server-only STAFF_MFA_ENFORCED / VERCEL_ENV flag (see lib/auth/mfa-flag.ts)
 * to the client login page, which can't read those env vars directly. The
 * middleware enforces the same flag authoritatively; this only controls
 * whether we redirect staff straight to /login/mfa (avoiding an /admin flash).
 */
export async function isStaffMfaEnforcedAction(): Promise<boolean> {
  return isStaffMfaEnforced();
}
