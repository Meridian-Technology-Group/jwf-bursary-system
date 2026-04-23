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
const ADMIN_PREFIX = /^\/(?:\(admin\)\/)?(?:admin|queue|rounds|invitations|reports|exports|audit|settings|users|applications)/;

/** Paths that do not need any processing. */
const BYPASS_PATHS = /^\/(api\/|_next\/|favicon\.ico|robots\.txt|sitemap\.xml)/;

// ---------------------------------------------------------------------------
// Role helpers (JWT-based, no Postgres)
// ---------------------------------------------------------------------------

type AppRole = "APPLICANT" | "ADMIN" | "ASSESSOR" | "VIEWER" | "DELETED";

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
  if (role === "ADMIN") return "ADMIN";
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
  const mw = createSupabaseMiddlewareClient(request);

  // IMPORTANT: call getUser() (not getSession()) — getUser() validates the
  // JWT with the Supabase server and is the only safe way to trust the user
  // identity in middleware.
  const {
    data: { user },
  } = await mw.supabase.auth.getUser();

  const role = getRoleFromSession(user);

  // Helper: redirect with session cookies preserved so the browser
  // keeps the refreshed session across the redirect.
  function redirect(url: URL | string) {
    const target = typeof url === "string" ? new URL(url, request.url) : url;
    return mw.applySessionCookies(NextResponse.redirect(target));
  }

  // 3. Auth routes are always public — let them through (with refreshed cookies).
  //    We intentionally do NOT redirect authenticated users away from /login.
  //    The middleware only has JWT-level info; if a Server Component (which has
  //    Prisma access) decided to redirect here, overriding that would cause a
  //    redirect loop between middleware ↔ server component.
  if (AUTH_ROUTES.test(pathname)) {
    return mw.response;
  }

  // 4. Portal routes — APPLICANT only.
  if (PORTAL_PREFIX.test(pathname)) {
    if (!user || !role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return redirect(loginUrl);
    }
    if (role !== "APPLICANT") {
      return redirect("/admin");
    }
    return mw.response;
  }

  // 5. Admin routes — ADMIN, ASSESSOR, or VIEWER only.
  if (ADMIN_PREFIX.test(pathname)) {
    if (!user || !role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return redirect(loginUrl);
    }
    if (role !== "ADMIN" && role !== "ASSESSOR" && role !== "VIEWER") {
      return redirect("/");
    }
    return mw.response;
  }

  // 6. Root and all other paths — require authentication.
  if (!user || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirect(loginUrl);
  }

  // Staff users landing on the portal root (/) should be sent to /admin.
  if (pathname === "/" && role !== "APPLICANT") {
    return redirect("/admin");
  }

  return mw.response;
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
