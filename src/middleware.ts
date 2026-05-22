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
 *
 * MFA (B8 / MSA Schedule 4 §8): staff roles {ADMIN, ASSESSOR, VIEWER}
 * must reach Assurance Level 2 (aal2) before accessing /admin/* routes.
 * The aal claim is read directly from the validated access-token JWT
 * (no extra network round-trip). Staff still at aal1 are funnelled to
 * /login/mfa to enrol or challenge a TOTP factor. APPLICANTs are never
 * gated on aal2 — their portal/apply paths remain single-factor.
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

/**
 * Static asset file extensions served from /public. These must bypass auth
 * because the unauthenticated /login page references them — otherwise the
 * middleware redirects the image request to /login itself and the browser
 * receives HTML in place of the PNG.
 */
const PUBLIC_ASSET_EXT = /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|css|js|map|txt|webmanifest)$/i;

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

/**
 * Decodes the `aal` (Authenticator Assurance Level) claim from a Supabase
 * access-token JWT without verifying the signature. This is safe for
 * routing decisions because:
 *  - identity is already validated upstream by getUser() (which checks the
 *    signature against the Supabase server), and
 *  - the gate is fail-closed: any decode failure yields "aal1", which only
 *    ever forces a staff user toward /login/mfa, never the reverse.
 *
 * Returns "aal2" or "aal1" (treating null/absent as aal1).
 */
function getAalFromJwt(accessToken: string | undefined): "aal1" | "aal2" {
  if (!accessToken) return "aal1";
  const parts = accessToken.split(".");
  if (parts.length < 2) return "aal1";
  try {
    // Base64url → JSON. atob is available in the Edge runtime.
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json) as { aal?: unknown };
    return payload.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, API routes and Next internals.
  if (BYPASS_PATHS.test(pathname) || PUBLIC_ASSET_EXT.test(pathname)) {
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

  // 2a. DELETED role — sign out and redirect to /login. Placed BEFORE the
  //     auth-route allowance so a deleted user cannot land on /login while
  //     still holding a valid session, and BEFORE the portal/admin routing
  //     so a DELETED role can never reach either area. (Audit finding 2.8)
  if (user && role === "DELETED" && !AUTH_ROUTES.test(pathname)) {
    await mw.supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "account_deleted");
    return redirect(loginUrl);
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

  // 5. Admin routes — ADMIN, ASSESSOR, or VIEWER only, AND at aal2 (MFA).
  if (ADMIN_PREFIX.test(pathname)) {
    if (!user || !role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return redirect(loginUrl);
    }
    if (role !== "ADMIN" && role !== "ASSESSOR" && role !== "VIEWER") {
      return redirect("/");
    }

    // MFA gate (B8 / MSA Schedule 4 §8): staff must be at aal2. Read the
    // aal claim from the validated access-token JWT. getSession() is used
    // only to obtain the token string for the claim — the user identity is
    // already validated above via getUser().
    const {
      data: { session },
    } = await mw.supabase.auth.getSession();
    const aal = getAalFromJwt(session?.access_token);
    if (aal !== "aal2") {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", pathname);
      return redirect(mfaUrl);
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
