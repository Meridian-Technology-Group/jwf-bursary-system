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
import { withAdminContext, type Tx } from "@/lib/db/prisma";
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
  const user = await requireRole([Role.ADMIN]);

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
    // 1+2. Load round + find/create profile + create application + invitation
    //      under admin context (the parent may not have a JWT yet).
    const supabase = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // First, look up existing profile (or create the Supabase user) outside
    // the transaction so we don't hold the DB connection while waiting for
    // a network round trip to Supabase.
    type ProfileLite = { id: string; email: string; firstName: string | null; lastName: string | null };

    const existingProfile = await withAdminContext((tx) =>
      tx.profile.findUnique({
        where: { email: parentEmail },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    );

    let profile: ProfileLite | null = existingProfile;
    let isNewUser = false;

    if (!profile) {
      const nameParts = parentName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? parentName;
      const lastName = nameParts.slice(1).join(" ") || null;

      const { data: authData, error: authError } =
        await supabase.auth.admin.inviteUserByEmail(parentEmail, {
          redirectTo: `${appUrl}/register`,
        });

      if (authError && !authError.message.includes("already been registered")) {
        console.warn("[internalRequest] Supabase invite warning:", authError);
      }

      let authUserId: string | undefined = authData?.user?.id;
      if (!authUserId) {
        const existingAuthUser = await supabase.auth.admin.listUsers();
        const found = existingAuthUser.data?.users?.find(
          (u) => u.email === parentEmail
        );
        authUserId = found?.id;
      }

      if (!authUserId) {
        return {
          success: false,
          error: "Could not create user account. Please try again.",
        };
      }

      profile = await withAdminContext((tx) =>
        tx.profile.upsert({
          where: { id: authUserId },
          create: {
            id: authUserId,
            email: parentEmail,
            firstName,
            lastName,
            role: "APPLICANT",
          },
          update: {},
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      );

      isNewUser = true;
    }

    // 3-5. Round lookup + reference + application + invitation in one tx.
    const result = await withAdminContext(async (tx: Tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, academicYear: true, status: true },
      });

      if (!round) {
        return { ok: false as const, error: "Selected round not found." };
      }

      const refPrefix = `INT-${round.academicYear.replace("/", "-")}-`;
      const existing = await tx.application.count({
        where: { reference: { startsWith: refPrefix } },
      });
      const reference = `${refPrefix}${String(existing + 1).padStart(4, "0")}`;

      const application = await tx.application.create({
        data: {
          reference,
          roundId,
          leadApplicantId: profile!.id,
          school,
          childName,
          entryYear,
          isInternal: true,
          status: "PRE_SUBMISSION",
        },
        select: { id: true, reference: true },
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const invitation = await tx.invitation.create({
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

      return {
        ok: true as const,
        application,
        invitation,
        round,
        expiresAt,
      };
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const { application, invitation, round, expiresAt } = result;

    // 6. Send the invitation email
    const schoolLabel = school === "TRINITY" ? "Trinity School" : "Whitgift School";
    const emailResult = await sendEmail(parentEmail, "INVITATION", {
      applicant_name: parentName,
      child_name: childName,
      school: schoolLabel,
      round_year: round.academicYear,
      registration_link: `${appUrl}/register?invitationId=${invitation.id}`,
      deadline: expiresAt.toLocaleDateString("en-GB"),
    });

    if (!emailResult.success) {
      console.warn(
        `[internalRequest] INVITATION email failed for ${parentEmail}: ${emailResult.error}`
      );
    }

    // 7. Audit log
    await withAdminContext((tx) =>
      createAuditLog(tx, {
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
      })
    );

    revalidatePath("/queue");

    return { success: true, reference: application.reference };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create internal request";
    console.error("[createInternalRequestAction]", err);
    return { success: false, error: message };
  }
}
