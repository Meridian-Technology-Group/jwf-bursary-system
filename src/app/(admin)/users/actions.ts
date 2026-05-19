"use server";

/**
 * Server actions for staff user management.
 *
 * All actions are restricted to ADMIN role.
 */

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/roles";
import { createProfile } from "@/lib/auth/create-profile";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getAppUrl } from "@/lib/app-url";
import { withAdminContext, withUserContext, type RlsRole } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { createStaffInvitation } from "@/lib/db/queries/staff-invitations";
import { sendEmail } from "@/lib/email/send";

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

  const supabase = createSupabaseAdminClient();
  const appUrl = getAppUrl();

  // 1. Create the Supabase auth user silently. We use email_confirm: true so
  //    Supabase does NOT fire its built-in invite OTP email (which gets eaten
  //    by Gmail/Outlook link scanners). The throwaway password is overwritten
  //    when the invitee completes registration via /register/staff.
  const tempPassword = randomBytes(24).toString("base64url");
  const { data: created, error: supabaseError } =
    await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role },
    });

  if (supabaseError || !created?.user) {
    const message = supabaseError?.message ?? "Failed to create auth user";
    console.error("[users] inviteStaffAction createUser error:", supabaseError);
    return { success: false, error: message };
  }
  const authUserId = created.user.id;

  // 2. Profile + StaffInvitation + audit log, all inside one withAdminContext.
  //    Any failure here triggers an auth-user rollback below (so we never
  //    leave an orphan auth.users row).
  let token: string;
  try {
    const result = await withAdminContext(async (tx) => {
      const profile = await createProfile(tx, {
        id: authUserId,
        email,
        role: role as Role,
        firstName,
        lastName,
      });
      if (!profile.success) {
        return { success: false as const, error: profile.error };
      }

      const inv = await createStaffInvitation(tx, {
        email,
        role: role as Role,
        firstName,
        lastName,
        authUserId,
        createdBy: admin.id,
      });

      await createAuditLog(tx, {
        userId: admin.id,
        action: "INVITE_STAFF",
        entityType: "StaffInvitation",
        entityId: inv.id,
        context: `Invited ${email} as ${role}`,
        metadata: { email, role },
      });

      return { success: true as const, token: inv.token };
    });

    if (!result.success) {
      // Roll back the auth user so we don't leave an orphan.
      await supabase.auth.admin.deleteUser(authUserId).catch((err) => {
        console.error("[users] auth user rollback failed:", err);
      });
      return {
        success: false,
        error: result.error ?? "Failed to create invitation",
      };
    }
    token = result.token;
  } catch (err) {
    // DB work threw — roll back the auth user.
    await supabase.auth.admin.deleteUser(authUserId).catch((rollbackErr) => {
      console.error("[users] auth user rollback failed:", rollbackErr);
    });
    const message =
      err instanceof Error ? err.message : "Failed to invite staff user";
    console.error("[users] inviteStaffAction error:", err);
    return { success: false, error: message };
  }

  // 3. Send the branded Resend email. If this fails, we keep the StaffInvitation
  //    row so the admin can re-send later — but surface the error to the caller.
  const emailResult = await sendEmail(email, "INVITE_STAFF", {
    first_name: firstName ?? email.split("@")[0],
    role,
    registration_link: `${appUrl}/register/staff?token=${token}`,
  });

  if (!emailResult.success) {
    console.error("[users] inviteStaffAction email error:", emailResult.error);
    return {
      success: false,
      error: `Invitation created but email failed to send: ${emailResult.error}`,
    };
  }

  revalidatePath("/users");
  return { success: true };
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
    const result = await withUserContext(
      admin.id,
      admin.role as RlsRole,
      async (tx) => {
        const previous = await tx.profile.findUnique({
          where: { id: userId },
          select: { role: true, email: true },
        });

        if (!previous) {
          return { success: false as const, error: "User not found." };
        }

        await tx.profile.update({
          where: { id: userId },
          data: { role: newRole as Role },
        });

        await createAuditLog(tx, {
          userId: admin.id,
          action: "UPDATE_STAFF_ROLE",
          entityType: "Profile",
          entityId: userId,
          context: `Changed ${previous.email} role from ${previous.role} to ${newRole}`,
          metadata: { previousRole: previous.role, newRole },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

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
    const result = await withUserContext(
      admin.id,
      admin.role as RlsRole,
      async (tx) => {
        const target = await tx.profile.findUnique({
          where: { id: userId },
          select: { email: true, role: true },
        });

        if (!target) {
          return { success: false as const, error: "User not found." };
        }

        // Set role to DELETED and unassign applications
        await tx.profile.update({
          where: { id: userId },
          data: { role: Role.DELETED },
        });
        await tx.application.updateMany({
          where: { assignedToId: userId },
          data: { assignedToId: null },
        });

        await createAuditLog(tx, {
          userId: admin.id,
          action: "DEACTIVATE_STAFF",
          entityType: "Profile",
          entityId: userId,
          context: `Deactivated ${target.email} (was ${target.role})`,
          metadata: { email: target.email, previousRole: target.role },
        });

        return { success: true as const };
      }
    );

    if (!result.success) return result;

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to deactivate user";
    console.error("[users] deactivateStaffAction error:", err);
    return { success: false, error: message };
  }
}
