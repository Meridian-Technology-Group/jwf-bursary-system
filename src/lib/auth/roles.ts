/**
 * Role-based access control helpers for Server Components and Route Handlers.
 *
 * All functions in this file run server-side. They read the authenticated
 * Supabase user and cross-reference the Profile row in Postgres to obtain
 * the application role.
 */

import { redirect } from "next/navigation";
import { Role, type Profile } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

// Re-export Role so consumers only need one import path.
export { Role };

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Subset of Profile fields returned by getCurrentUser. */
export type CurrentUser = Pick<
  Profile,
  "id" | "email" | "role" | "firstName" | "lastName" | "phone"
>;

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Profile (with role) for the currently authenticated user.
 * Returns null if there is no active session or no matching profile row.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  return profile;
}

/**
 * Ensures the current user has one of the allowed roles.
 *
 * - Unauthenticated → redirect to /login
 * - Wrong role      → redirect to the role-appropriate home path
 * - Correct role    → returns the CurrentUser (never null)
 *
 * Throws a Next.js redirect, so it never returns when access is denied.
 */
export async function requireRole(allowedRoles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to the user's appropriate home rather than a hard 403.
    if (user.role === Role.APPLICANT) {
      redirect("/");
    } else {
      redirect("/admin");
    }
  }

  return user;
}

// ---------------------------------------------------------------------------
// Narrow role predicates
// ---------------------------------------------------------------------------

/** Returns true when the profile belongs to an applicant. */
export function isApplicant(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.APPLICANT;
}

/** Returns true when the profile belongs to an assessor. */
export function isAssessor(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.ASSESSOR;
}

/**
 * Returns true when the profile belongs to a viewer (read-only admin).
 * Note: ASSESSOR and VIEWER both have access to the admin area.
 */
export function isViewer(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.VIEWER;
}

/** Returns true when the profile belongs to any admin-area role. */
export function isAdminRole(profile: Pick<Profile, "role">): boolean {
  return isAssessor(profile) || isViewer(profile);
}
