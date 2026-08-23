/**
 * Pure helpers for the password-reset flow (request → email link →
 * /reset-password/update?token_hash=…).
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
 * Pull the recovery token out of the reset link's query string.
 *
 * The recovery email links straight here carrying Supabase's `token_hash`
 * (see the template in docs/operations/password-reset-email-template.md).
 * Returns null when the token is absent, empty or carries a `type` other
 * than `recovery` — an invite or email-change hash must not be spendable
 * on the set-a-new-password form.
 *
 * Next passes repeated query params as arrays; take the first value.
 */
export function pickRecoveryToken(
  tokenHash: string | string[] | undefined,
  type: string | string[] | undefined
): string | null {
  const hash = (Array.isArray(tokenHash) ? tokenHash[0] : tokenHash)?.trim();
  if (!hash) return null;

  const linkType = (Array.isArray(type) ? type[0] : type)?.trim();
  // Supabase omits `type` on some template variants; absent is treated as
  // recovery because this route is only ever linked from the reset email.
  if (linkType && linkType !== "recovery") return null;

  return hash;
}

/**
 * Map the /auth/callback error codes (surfaced as /login?error=…) to a
 * human message. Unknown codes return null so nothing leaks to the UI.
 *
 * Recovery no longer runs through /auth/callback (see pickRecoveryToken),
 * but the callback still serves magic-link and OAuth sign-in, so these
 * codes remain reachable.
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
