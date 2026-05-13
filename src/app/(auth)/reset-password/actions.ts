"use server";

/**
 * Server actions for the password reset request flow.
 *
 * Performs IP-based rate limiting before the browser triggers
 * supabase.auth.resetPasswordForEmail — preventing abuse of the reset
 * email channel for enumeration or harassment.
 */

import { headers } from "next/headers";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

export type ResetRateLimitResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Pre-check the password-reset rate limit for the caller's IP.
 * Returns `{ ok: false, error }` if the IP has exceeded 5 attempts / 15 min.
 */
export async function checkResetPasswordRateLimit(): Promise<ResetRateLimitResult> {
  const ip = getClientIp(headers());
  const result = await checkRateLimit(`reset-password:${ip}`);
  if (!result.success) {
    return { ok: false, error: RATE_LIMIT_MESSAGE };
  }
  return { ok: true };
}
