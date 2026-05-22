"use server";

/**
 * Server actions for login.
 *
 * Wraps Supabase's signInWithPassword so we can enforce IP-based rate
 * limiting before hitting the auth backend. The browser still completes
 * sign-in client-side (to establish the SSR cookie via @supabase/ssr),
 * but this pre-check throttles credential-stuffing attempts.
 */

import { headers } from "next/headers";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { isStaffMfaEnforced } from "@/lib/auth/mfa-flag";

export type LoginRateLimitResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Pre-check the login rate limit for the caller's IP.
 * Returns `{ ok: false, error }` if the IP has exceeded 5 attempts / 15 min.
 */
export async function checkLoginRateLimit(): Promise<LoginRateLimitResult> {
  const ip = getClientIp(headers());
  const result = await checkRateLimit(`login:${ip}`);
  if (!result.success) {
    return { ok: false, error: RATE_LIMIT_MESSAGE };
  }
  return { ok: true };
}

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
