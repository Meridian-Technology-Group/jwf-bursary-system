"use server";

/**
 * Queue server actions — internal bursary request creation.
 *
 * createInternalRequestAction:
 *   - ASSESSOR role required
 *   - Creates (or finds) a Profile for the parent
 *   - Creates an Application with isInternal=true, status=PRE_SUBMISSION
 *   - Creates an Invitation record
 *   - Sends the INVITATION email via Resend
 *   - Writes an audit log entry
 *   - Revalidates /queue
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { School } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

// ─── Validation schema ────────────────────────────────────────────────────────

const InternalRequestSchema = z.object({
  parentEmail: z.string().email("A valid parent email address is required"),
  parentName: z.string().min(1, "Parent name is required").max(200),
  childName: z.string().min(1, "Child name is required").max(200),
  school: z.nativeEnum(School, {
    error: () => ({ message: "Please select a school" }),
  }),
  roundId: z.string().uuid("Please select an assessment round"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional(),
  entryYear: z.coerce
    .number()
    .int()
    .min(2020, "Entry year must be 2020 or later")
    .max(2040, "Entry year must be 2040 or earlier"),
});

// ─── Result type ──────────────────────────────────────────────────────────────

export interface InternalRequestResult {
  success: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ─── createInternalRequestAction ─────────────────────────────────────────────

export async function createInternalRequestAction(
  formData: FormData
): Promise<InternalRequestResult> {
  const user = await requireRole([Role.ASSESSOR]);

  const raw = {
    parentEmail: (formData.get("parentEmail") as string | null) ?? "",
    parentName: (formData.get("parentName") as string | null) ?? "",
    childName: (formData.get("childName") as string | null) ?? "",
    school: (formData.get("school") as string | null) ?? "",
    roundId: (formData.get("roundId") as string | null) ?? "",
    reason: (formData.get("reason") as string | null) ?? undefined,
    entryYear: (formData.get("entryYear") as string | null) ?? "",
  };

  const parsed = InternalRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { parentEmail, parentName, childName, school, roundId, reason, entryYear } =
    parsed.data;

  try {
    // 1. Load the round to get academicYear and verify it exists
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, academicYear: true, status: true },
    });

    if (!round) {
      return { success: false, error: "Selected round not found." };
    }

    // 2. Find or create a Profile for the parent email
    let profile = await prisma.profile.findUnique({
      where: { email: parentEmail },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    let isNewUser = false;

    if (!profile) {
      // Split parentName into first/last for the profile
      const nameParts = parentName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? parentName;
      const lastName = nameParts.slice(1).join(" ") || null;

      // Create the Supabase Auth user via invite (so they can set a password)
      const supabase = createSupabaseAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const { data: authData, error: authError } =
        await supabase.auth.admin.inviteUserByEmail(parentEmail, {
          redirectTo: `${appUrl}/register`,
        });

      if (authError && !authError.message.includes("already been registered")) {
        console.warn("[internalRequest] Supabase invite warning:", authError);
      }

      // Create the Profile row
      const authUserId = authData?.user?.id;

      if (authUserId) {
        profile = await prisma.profile.create({
          data: {
            id: authUserId,
            email: parentEmail,
            firstName,
            lastName,
            role: "APPLICANT",
          },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
      } else {
        // Fallback: create profile with a generated UUID if Supabase didn't return one
        // (e.g. user already existed in Supabase but not in our DB)
        const existingAuthUser = await supabase.auth.admin.listUsers();
        const found = existingAuthUser.data?.users?.find(
          (u) => u.email === parentEmail
        );

        if (found) {
          profile = await prisma.profile.upsert({
            where: { id: found.id },
            create: {
              id: found.id,
              email: parentEmail,
              firstName,
              lastName,
              role: "APPLICANT",
            },
            update: {},
            select: { id: true, email: true, firstName: true, lastName: true },
          });
        } else {
          return {
            success: false,
            error: "Could not create user account. Please try again.",
          };
        }
      }

      isNewUser = true;
    }

    // 3. Generate a unique application reference
    const refPrefix = `INT-${round.academicYear.replace("/", "-")}-`;
    const existing = await prisma.application.count({
      where: { reference: { startsWith: refPrefix } },
    });
    const reference = `${refPrefix}${String(existing + 1).padStart(4, "0")}`;

    // 4. Create the internal application
    const application = await prisma.application.create({
      data: {
        reference,
        roundId,
        leadApplicantId: profile.id,
        school,
        childName,
        entryYear,
        isInternal: true,
        status: "PRE_SUBMISSION",
      },
      select: { id: true, reference: true },
    });

    // 5. Create an Invitation record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invitation = await prisma.invitation.create({
      data: {
        email: parentEmail,
        applicantName: parentName,
        childName,
        school,
        roundId,
        status: "PENDING",
        expiresAt,
        createdBy: user.id,
      },
      select: { id: true },
    });

    // 6. Send the invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const emailResult = await sendEmail(parentEmail, "INVITATION", {
      applicant_name: parentName,
      child_name: childName,
      academic_year: round.academicYear,
      invitation_link: `${appUrl}/register?invitationId=${invitation.id}`,
      expiry_date: expiresAt.toLocaleDateString("en-GB"),
    });

    if (!emailResult.success) {
      console.warn(
        `[internalRequest] INVITATION email failed for ${parentEmail}: ${emailResult.error}`
      );
    }

    // 7. Audit log
    await createAuditLog({
      userId: user.id,
      action: "INTERNAL_REQUEST_CREATED",
      entityType: "Application",
      entityId: application.id,
      context: `Internal bursary request created for ${childName} (${parentEmail})`,
      metadata: {
        reference: application.reference,
        school,
        roundId,
        entryYear,
        reason: reason ?? null,
        invitationId: invitation.id,
        isNewUser,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId ?? null,
      },
    });

    revalidatePath("/queue");

    return { success: true, reference: application.reference };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create internal request";
    console.error("[createInternalRequestAction]", err);
    return { success: false, error: message };
  }
}
