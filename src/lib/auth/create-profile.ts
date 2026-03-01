/**
 * Server-side utility for creating a Profile row in Postgres.
 *
 * Called after a new user registers via Supabase Auth. The Profile id must
 * match the Supabase auth.users id so that the two records stay in sync.
 *
 * This file is safe to import from Server Actions and Route Handlers only.
 * Never import in Client Components.
 */

"use server";

import { Role, type Profile } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface CreateProfileInput {
  /** Must match the Supabase auth.users UUID for this user. */
  id: string;
  email: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export type CreateProfileResult =
  | { success: true; profile: Profile }
  | { success: false; error: string };

/**
 * Creates a Profile row for a newly registered user.
 *
 * Idempotent — if the profile already exists (duplicate registration attempt)
 * it returns the existing row rather than throwing.
 */
export async function createProfile(
  input: CreateProfileInput
): Promise<CreateProfileResult> {
  const { id, email, role = Role.APPLICANT, firstName, lastName, phone } = input;

  try {
    // Use upsert so concurrent registration attempts are safe.
    const profile = await prisma.profile.upsert({
      where: { id },
      create: {
        id,
        email,
        role,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        phone: phone ?? null,
      },
      update: {
        // Only update mutable fields on conflict — do not overwrite role.
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        phone: phone ?? undefined,
      },
    });

    return { success: true, profile };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error creating profile.";
    return { success: false, error: message };
  }
}
