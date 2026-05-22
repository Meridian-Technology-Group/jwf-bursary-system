"use server";

/**
 * Server actions for the staff MFA (TOTP) enrolment / challenge flow (B8).
 *
 * Both actions run against the SSR Supabase client, so a successful
 * verification elevates the *current browser session* to aal2 by writing
 * refreshed cookies. The caller (client component) then router.refresh()es
 * and navigates to the originally requested admin route.
 */

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export interface MfaActionResult {
  success: boolean;
  error?: string;
}

/** Six ASCII digits. */
const CODE_RE = /^\d{6}$/;

function normaliseCode(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/\s+/g, "");
  return CODE_RE.test(code) ? code : null;
}

/**
 * Confirms a freshly-enrolled TOTP factor.
 *
 * `factorId` comes from the enroll() call rendered on the setup page. We
 * create a challenge for it, then verify with the user's 6-digit code.
 */
export async function verifyEnrolmentAction(
  formData: FormData
): Promise<MfaActionResult> {
  const factorId = formData.get("factorId");
  const code = normaliseCode(formData.get("code"));

  if (typeof factorId !== "string" || factorId.length === 0) {
    return { success: false, error: "Missing enrolment factor. Reload and try again." };
  }
  if (!code) {
    return { success: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return {
      success: false,
      error: challengeError?.message ?? "Could not start the verification challenge.",
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    return {
      success: false,
      error: verifyError.message ?? "That code did not match. Try again.",
    };
  }

  return { success: true };
}

/**
 * Challenges an already-enrolled TOTP factor and verifies the code,
 * elevating the session to aal2.
 */
export async function challengeAndVerifyAction(
  formData: FormData
): Promise<MfaActionResult> {
  const factorId = formData.get("factorId");
  const code = normaliseCode(formData.get("code"));

  if (typeof factorId !== "string" || factorId.length === 0) {
    return { success: false, error: "Missing MFA factor. Reload and try again." };
  }
  if (!code) {
    return { success: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return {
      success: false,
      error: challengeError?.message ?? "Could not start the MFA challenge.",
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    return {
      success: false,
      error: verifyError.message ?? "That code did not match. Try again.",
    };
  }

  return { success: true };
}
