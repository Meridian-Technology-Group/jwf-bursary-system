/**
 * Logout API route — signs the user out of Supabase and redirects to /login.
 *
 * This is a POST route handler (not a Server Action) so it can be called
 * from a <form action="/api/auth/logout" method="POST"> in any layout,
 * or via fetch() from a client component.
 *
 * Using a Route Handler (rather than a Server Action) means the sign-out
 * request clears the session cookies before the redirect, which is the
 * correct order of operations for Supabase SSR.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function POST(request: NextRequest) {
  // ── CSRF defence ──────────────────────────────────────────────────────────
  // Reject the logout if Origin (or Referer as a fallback) does not match the
  // deployment origin. This prevents a hostile site from silently logging the
  // user out via <form action> or <img> tricks. See docs/security-audit.md §2.20.
  const requestOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  const sourceOrigin =
    originHeader ??
    (refererHeader ? safeOrigin(refererHeader) : null);

  if (!sourceOrigin || sourceOrigin !== requestOrigin) {
    return NextResponse.json(
      { error: "Forbidden — cross-origin logout requests are not permitted" },
      { status: 403 }
    );
  }

  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    // 303 See Other — use GET for the redirect target after a POST.
    status: 303,
  });
}

/** Extract the origin portion of a Referer header, or null if malformed. */
function safeOrigin(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
