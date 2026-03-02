"use server";

/**
 * Server actions for staff user management.
 *
 * All actions are restricted to ADMIN role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/roles";
import { createProfile } from "@/lib/auth/create-profile";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export interface StaffActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// inviteStaffAction
// ---------------------------------------------------------------------------

const InviteStaffSchema = z.object({
  email: z.string().email("A valid email address is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["ASSESSOR", "VIEWER"], {
    message: "Role must be ASSESSOR or VIEWER",
  }),
});

/**
 * Invites a new staff user (ASSESSOR or VIEWER).
 * Creates the Supabase auth user and the Profile row.
 */
export async function inviteStaffAction(
  formData: FormData
): Promise<StaffActionResult> {
  const admin = await requireRole([Role.ADMIN]);

  const raw = {
    email: formData.get("email") as string,
    firstName: (formData.get("firstName") as string) || undefined,
    lastName: (formData.get("lastName") as string) || undefined,
    role: formData.get("role") as string,
  };

  const parsed = InviteStaffSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, firstName, lastName, role } = parsed.data;

  try {
    // 1. Create Supabase auth user via invite
    const supabase = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { role },
        redirectTo: `${appUrl}/login`,
      });

    if (inviteError) {
      return { success: false, error: inviteError.message };
    }

    const authUserId = inviteData.user.id;

    // 2. Set app_metadata.role (belt-and-suspenders — DB trigger also fires)
    await supabase.auth.admin.updateUserById(authUserId, {
      app_metadata: { role },
    });

    // 3. Create Profile row
    const profileResult = await createProfile({
      id: authUserId,
      email,
      role: role as Role,
      firstName,
      lastName,
    });

    if (!profileResult.success) {
      return { success: false, error: profileResult.error };
    }

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "INVITE_STAFF",
        entityType: "Profile",
        entityId: authUserId,
        context: `Invited ${email} as ${role}`,
        metadata: { email, role },
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to invite staff user";
    console.error("[users] inviteStaffAction error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// updateStaffRoleAction
// ---------------------------------------------------------------------------

const UpdateRoleSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  newRole: z.enum(["ADMIN", "ASSESSOR", "VIEWER"], {
    message: "New role is required",
  }),
});

/**
 * Changes a staff user's role.
 * The DB trigger auto-syncs to Supabase auth app_metadata.
 */
export async function updateStaffRoleAction(
  formData: FormData
): Promise<StaffActionResult> {
  const admin = await requireRole([Role.ADMIN]);

  const parsed = UpdateRoleSchema.safeParse({
    userId: formData.get("userId") as string,
    newRole: formData.get("newRole") as string,
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { userId, newRole } = parsed.data;

  // Prevent changing own role
  if (userId === admin.id) {
    return { success: false, error: "You cannot change your own role." };
  }

  try {
    const previous = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!previous) {
      return { success: false, error: "User not found." };
    }

    await prisma.profile.update({
      where: { id: userId },
      data: { role: newRole as Role },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE_STAFF_ROLE",
        entityType: "Profile",
        entityId: userId,
        context: `Changed ${previous.email} role from ${previous.role} to ${newRole}`,
        metadata: { previousRole: previous.role, newRole },
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update role";
    console.error("[users] updateStaffRoleAction error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// deactivateStaffAction
// ---------------------------------------------------------------------------

const DeactivateSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

/**
 * Deactivates a staff user by setting their role to DELETED.
 * Unassigns all applications from this user.
 */
export async function deactivateStaffAction(
  formData: FormData
): Promise<StaffActionResult> {
  const admin = await requireRole([Role.ADMIN]);

  const parsed = DeactivateSchema.safeParse({
    userId: formData.get("userId") as string,
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { userId } = parsed.data;

  if (userId === admin.id) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  try {
    const target = await prisma.profile.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    if (!target) {
      return { success: false, error: "User not found." };
    }

    // Set role to DELETED and unassign applications in a transaction
    await prisma.$transaction([
      prisma.profile.update({
        where: { id: userId },
        data: { role: Role.DELETED },
      }),
      prisma.application.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "DEACTIVATE_STAFF",
        entityType: "Profile",
        entityId: userId,
        context: `Deactivated ${target.email} (was ${target.role})`,
        metadata: { email: target.email, previousRole: target.role },
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to deactivate user";
    console.error("[users] deactivateStaffAction error:", err);
    return { success: false, error: message };
  }
}
