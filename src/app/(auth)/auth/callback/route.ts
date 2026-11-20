/**
 * Supabase Auth Callback — PKCE code exchange.
 *
 * Supabase redirects here after:
 * - Email confirmation (after sign-up)
 * - Magic link sign-in
 * - OAuth provider sign-in
 *
 * NOT password reset. Recovery links go straight to /reset-password/update
 * with a `token_hash`, because the code exchange below spends the token on
 * the first GET — which mail-security link scanners perform on arrival,
 * burning the link before the recipient clicks it.
 *
 * The `code` query param is exchanged for a session via
 * supabase.auth.exchangeCodeForSession(). Cookies are then set by
 * @supabase/ssr and the user is redirected to `next` (or a default).
 *
 * IMPORTANT: This route must use the server client (not the middleware client)
 * so it can write the session cookies to the response.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/lib/auth/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    // No code — something went wrong upstream. Redirect to login with a hint.
    return NextResponse.redirect(
      new URL("/login?error=missing_code", origin)
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Exchange failed — token may be expired or already used.
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "session_exchange_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Exchange succeeded — forward to the intended destination.
  // `next` has already been normalised via safeNext() above.
  return NextResponse.redirect(new URL(next, origin));
}
