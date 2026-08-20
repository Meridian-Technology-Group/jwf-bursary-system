/**
 * Pure helpers for the password-reset flow (request → email link →
 * /auth/callback → /reset-password/update).
 *
 * Kept free of Supabase imports so they can be unit-tested directly.
 */

import { validatePasswordStrength } from "./password-policy";

export type NewPasswordValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a new password + confirmation pair for the update form.
 * Mirrors the applicant registration rules (12-char minimum + HIBP).
 */
export async function validateNewPassword(
  password: string,
  confirmPassword: string
): Promise<NewPasswordValidation> {
  if (password !== confirmPassword) {
    return { ok: false, reason: "The passwords do not match." };
  }
  const strength = await validatePasswordStrength(password);
  if (!strength.ok) {
    return { ok: false, reason: strength.reason };
  }
  return { ok: true };
}

/**
 * Map the /auth/callback error codes (surfaced as /login?error=…) to a
 * human message. Unknown codes return null so nothing leaks to the UI.
 */
export function mapAuthCallbackError(code: string | null): string | null {
  switch (code) {
    case "missing_code":
    case "session_exchange_failed":
      return "That link was invalid or has expired. If you were resetting your password, request a new link below via “Forgot password?”.";
    default:
      return null;
  }
}

/**
 * Post-update destination by role (mirrors the login page's routing:
 * staff land on /admin — middleware still enforces MFA where configured —
 * applicants land on the portal home).
 */
export function postUpdateDestination(role: string | undefined): string {
  return role === "ADMIN" || role === "ASSESSOR" || role === "VIEWER"
    ? "/admin"
    : "/";
}
