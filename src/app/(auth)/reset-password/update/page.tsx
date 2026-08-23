/**
 * Set-new-password page (CI-01 / Epic 15 G1; scanner-proofed 2026-08-23).
 *
 * Server Component shell. Mirrors register/page.tsx: read the token out of
 * the query string here, hand it to a client component that spends it only
 * on submit.
 *
 * The recovery email links directly here with Supabase's `token_hash`; it no
 * longer routes through /auth/callback. Two reasons:
 *
 *  1. The PKCE hop consumed the single-use token on the first GET of the
 *     link, so corporate link scanners (Microsoft Defender Safe Links)
 *     burned it before the recipient ever clicked.
 *  2. Landing here with a live session, rather than a token, meant the form
 *     trusted whoever was signed in — a reset link for one account could
 *     change another account's password.
 *
 * See update-password-form.tsx for the detail.
 */

import type { Metadata } from "next";
import { pickRecoveryToken } from "@/lib/auth/reset-password-helpers";
import { ExpiredLink, UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

// Never cache: the page is keyed on a single-use token in the query string.
export const dynamic = "force-dynamic";

interface UpdatePasswordPageProps {
  searchParams: {
    token_hash?: string | string[];
    type?: string | string[];
  };
}

export default function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const tokenHash = pickRecoveryToken(
    searchParams.token_hash,
    searchParams.type
  );

  // No token — a direct visit, a truncated link, or a non-recovery hash.
  // Deliberately NOT a fallback to the current session (see file header).
  if (!tokenHash) {
    return <ExpiredLink />;
  }

  return <UpdatePasswordForm tokenHash={tokenHash} />;
}
