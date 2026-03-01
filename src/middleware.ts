/**
 * Next.js Edge Middleware — Authentication & Route Protection
 *
 * Runs on every matched request (see config.matcher below).
 *
 * Responsibilities:
 * 1. Refresh the Supabase session so Server Components always see a valid token.
 * 2. Protect route groups:
 *    - /(auth)/*     — public (login, register, reset-password)
 *    - /(portal)/*   — APPLICANT only
 *    - /(admin)/*    — ASSESSOR or VIEWER only
 * 3. Redirect unauthenticated users to /login.
 * 4. Redirect users with the wrong role to their appropriate home.
 *
 * NOTE: Role data is encoded in the JWT claims via a Supabase Database
 * Function / Trigger that stamps app_metadata.role. The middleware reads
 * the role from the JWT so it does NOT perform a Postgres query (Edge
 * Runtime has no Prisma access). The Prisma-backed getCurrentUser() in
 * roles.ts is used only in Server Components for authoritative checks.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/auth/supabase-middleware";

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

const AUTH_ROUTES = /^\/(?:\(auth\)\/)?(?:login|register|reset-password|auth\/callback)/;
const PORTAL_PREFIX = /^\/(?:\(portal\)\/)?(?:portal|my-application|documents)/;
const ADMIN_PREFIX = /^\/(?:\(admin\)\/)?admin/;

/** Paths that do not need any processing. */
const BYPASS_PATHS = /^\/(api\/|_next\/|favicon\.ico|robots\.txt|sitemap\.xml)/;

// ---------------------------------------------------------------------------
// Role helpers (JWT-based, no Postgres)
// ---------------------------------------------------------------------------

type AppRole = "APPLICANT" | "ASSESSOR" | "VIEWER" | "DELETED";

/**
 * Extracts the application role from the Supabase JWT app_metadata.
 * Falls back to "APPLICANT" when the claim is absent (new users who have
 * not yet had their profile stamped).
 */
function getRoleFromSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: { app_metadata?: Record<string, unknown> } | null
): AppRole | null {
  if (!user) return null;
  const role = user.app_metadata?.role as string | undefined;
  if (role === "ASSESSOR") return "ASSESSOR";
  if (role === "VIEWER") return "VIEWER";
  if (role === "DELETED") return "DELETED";
  // Default: treat as APPLICANT (covers newly registered users)
  return "APPLICANT";
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, API routes and Next internals.
  if (BYPASS_PATHS.test(pathname)) {
    return NextResponse.next();
  }

  // 2. Create middleware Supabase client (refreshes session, writes cookies).
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  // IMPORTANT: call getUser() (not getSession()) — getUser() validates the
  // JWT with the Supabase server and is the only safe way to trust the user
  // identity in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = getRoleFromSession(user);

  // 3. Auth routes are always public — let them through (with refreshed cookies).
  if (AUTH_ROUTES.test(pathname)) {
    // If the user is already logged in, redirect them to their home.
    if (user && role && role !== "DELETED") {
      const home = role === "APPLICANT" ? "/" : "/admin";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return response;
  }

  // 4. Portal routes — APPLICANT only.
  if (PORTAL_PREFIX.test(pathname)) {
    if (!user || !role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role !== "APPLICANT") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return response;
  }

  // 5. Admin routes — ASSESSOR or VIEWER only.
  if (ADMIN_PREFIX.test(pathname)) {
    if (!user || !role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role !== "ASSESSOR" && role !== "VIEWER") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // 6. Root and all other paths — require authentication.
  if (!user || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — exclude Next.js internals and static assets
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - robots.txt
     * - sitemap.xml
     * - /api/         (API routes handle their own auth)
     *
     * The negative lookahead keeps the list clean without
     * listing every static extension.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
