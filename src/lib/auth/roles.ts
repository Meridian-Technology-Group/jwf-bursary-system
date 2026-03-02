/**
 * Role-based access control helpers for Server Components and Route Handlers.
 *
 * All functions in this file run server-side. They read the authenticated
 * Supabase user and cross-reference the Profile row in Postgres to obtain
 * the application role.
 */

import { redirect } from "next/navigation";
import { Role, type Profile, type Application } from "@prisma/client";
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

/** Minimal application shape required by access-check helpers. */
type ApplicationWithAssignee = Pick<Application, "assignedToId">;

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
      // ADMIN, ASSESSOR, VIEWER, and DELETED all redirect to /admin.
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

/** Returns true when the profile belongs to a full administrator. */
export function isAdmin(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.ADMIN;
}

/** Returns true when the profile belongs to an assessor. */
export function isAssessor(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.ASSESSOR;
}

/**
 * Returns true when the profile belongs to a viewer (read-only admin).
 * Note: ADMIN, ASSESSOR, and VIEWER all have access to the admin area.
 */
export function isViewer(profile: Pick<Profile, "role">): boolean {
  return profile.role === Role.VIEWER;
}

/** Returns true when the profile belongs to any admin-area role. */
export function isAdminRole(profile: Pick<Profile, "role">): boolean {
  return isAdmin(profile) || isAssessor(profile) || isViewer(profile);
}

// ---------------------------------------------------------------------------
// Application-level access helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the profile is permitted to view/act on the given
 * application.
 *
 * - ADMIN / VIEWER  → always permitted (they see everything)
 * - ASSESSOR        → permitted only when the application is assigned to them
 * - All others      → denied
 */
export function canAccessApplication(
  profile: Pick<Profile, "id" | "role">,
  application: ApplicationWithAssignee
): boolean {
  if (isAdmin(profile) || isViewer(profile)) return true;
  if (isAssessor(profile)) return application.assignedToId === profile.id;
  return false;
}

/**
 * Enforces application-level access in Server Components / Route Handlers.
 *
 * - ADMIN / VIEWER  → returns immediately without a DB query
 * - ASSESSOR        → fetches the application and checks assignedToId;
 *                     redirects to /admin if the application is not assigned
 *                     to this user or does not exist
 * - All others      → redirects to /admin
 *
 * Throws a Next.js redirect, so it never returns when access is denied.
 */
export async function requireApplicationAccess(
  profile: CurrentUser,
  applicationId: string
): Promise<void> {
  if (isAdmin(profile) || isViewer(profile)) return;

  if (isAssessor(profile)) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { assignedToId: true },
    });

    if (application?.assignedToId === profile.id) return;

    redirect("/admin");
  }

  redirect("/admin");
}
