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

export async function POST(_request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", _request.url), {
    // 303 See Other — use GET for the redirect target after a POST.
    status: 303,
  });
}
