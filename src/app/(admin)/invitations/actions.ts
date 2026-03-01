"use server";

/**
 * Server actions for invitation management.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { School } from "@prisma/client";
import { requireRole, Role } from "@/lib/auth/roles";
import {
  createInvitation,
  getActiveBursaryHolders,
} from "@/lib/db/queries/invitations";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/db/prisma";
import { prepopulateReassessment, getPreviousYearApplication } from "@/lib/db/queries/reassessment";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const InvitationSchema = z.object({
  email: z.string().email("A valid email address is required"),
  applicantName: z.string().optional(),
  childName: z.string().optional(),
  school: z.nativeEnum(School).optional(),
  roundId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface InvitationActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface BatchInviteResult {
  sent: number;
  failed: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// createInvitationAction
// ---------------------------------------------------------------------------

/**
 * Creates an invitation record, fires the Supabase invite, and sends the
 * branded invitation email.
 */
export async function createInvitationAction(
  formData: FormData
): Promise<InvitationActionResult> {
  const user = await requireRole([Role.ASSESSOR]);

  const raw = {
    email: formData.get("email") as string,
    applicantName: (formData.get("applicantName") as string) || undefined,
    childName: (formData.get("childName") as string) || undefined,
    school: (formData.get("school") as string) || undefined,
    roundId: (formData.get("roundId") as string) || undefined,
  };

  const parsed = InvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, applicantName, childName, school, roundId } = parsed.data;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  try {
    // 1. Create the invitation record
    const invitation = await createInvitation({
      email,
      applicantName,
      childName,
      school,
      roundId,
      createdBy: user.id,
      expiresAt,
    });

    // 2. Invite via Supabase Auth (creates auth account + Supabase's own email)
    const supabase = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { error: supabaseError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/register?invitationId=${invitation.id}`,
      }
    );

    if (supabaseError) {
      console.error("[invitations] Supabase invite error:", supabaseError);
      // Non-fatal: log but continue so our branded email still sends
    }

    // 3. Retrieve round academic year for merge data (if roundId provided)
    let academicYear = "";
    if (roundId) {
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        select: { academicYear: true },
      });
      academicYear = round?.academicYear ?? "";
    }

    // 4. Send branded invitation email via Resend
    await sendEmail(email, "INVITATION", {
      applicant_name: applicantName ?? email,
      child_name: childName ?? "",
      academic_year: academicYear,
      invitation_link: `${appUrl}/register?invitationId=${invitation.id}`,
      expiry_date: expiresAt.toLocaleDateString("en-GB"),
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_INVITATION",
        entityType: "Invitation",
        entityId: invitation.id,
        context: `Sent invitation to ${email}`,
        metadata: { email, roundId: roundId ?? null },
      },
    });

    revalidatePath("/admin/invitations");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send invitation";
    console.error("[invitations] createInvitationAction error:", err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// batchReassessmentInviteAction
// ---------------------------------------------------------------------------

/**
 * Sends reassessment invitations to all active bursary holders that have not
 * yet been invited for the specified round.
 */
export async function batchReassessmentInviteAction(
  roundId: string
): Promise<BatchInviteResult> {
  const user = await requireRole([Role.ASSESSOR]);

  const result: BatchInviteResult = { sent: 0, failed: 0, errors: [] };

  try {
    const holders = await getActiveBursaryHolders(roundId);

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { academicYear: true },
    });
    const academicYear = round?.academicYear ?? "";

    const supabase = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    for (let i = 0; i < holders.length; i++) {
      const holder = holders[i];
      const { email, firstName, lastName } = holder.leadApplicant;
      const applicantName =
        [firstName, lastName].filter(Boolean).join(" ") || email;

      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Create invitation record
        const invitation = await createInvitation({
          email,
          applicantName,
          childName: holder.childName,
          school: holder.school,
          roundId,
          bursaryAccountId: holder.id,
          createdBy: user.id,
          expiresAt,
        });

        // Supabase Auth invite
        const { error: supabaseError } =
          await supabase.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${appUrl}/register?invitationId=${invitation.id}`,
          });

        if (supabaseError) {
          console.warn(
            `[batch-invite] Supabase invite warning for ${email}:`,
            supabaseError
          );
        }

        // Send branded reassessment email
        const emailResult = await sendEmail(email, "REASSESSMENT", {
          applicant_name: applicantName,
          child_name: holder.childName,
          school: holder.school,
          academic_year: academicYear,
          invitation_link: `${appUrl}/register?invitationId=${invitation.id}`,
          expiry_date: expiresAt.toLocaleDateString("en-GB"),
        });

        if (emailResult.success) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`${email}: ${emailResult.error}`);
        }

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "BATCH_REASSESSMENT_INVITE",
            entityType: "Invitation",
            entityId: invitation.id,
            context: `Sent reassessment invitation to ${email}`,
            metadata: {
              email,
              roundId,
              bursaryAccountId: holder.id,
            },
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        result.failed++;
        result.errors.push(`${email}: ${message}`);
        console.error(`[batch-invite] Error for ${email}:`, err);
      }

      // Rate-limit delay between sends (100 ms), skip after last item
      if (i < holders.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    revalidatePath("/admin/invitations");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Batch invite failed";
    console.error("[batch-invite] Fatal error:", err);
    result.errors.push(message);
  }

  return result;
}

// ---------------------------------------------------------------------------
// createReassessmentApplicationAction
// ---------------------------------------------------------------------------

const ReassessmentApplicationSchema = z.object({
  bursaryAccountId: z.string().uuid("A valid bursary account ID is required"),
  roundId: z.string().uuid("A valid round ID is required"),
});

export interface ReassessmentApplicationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

/**
 * Creates a re-assessment application and pre-populates it with personal
 * section data from the previous year.
 *
 * Called after an applicant registers via a re-assessment invitation.
 * Links the application to the existing BursaryAccount with isReassessment: true.
 */
export async function createReassessmentApplicationAction(
  bursaryAccountId: string,
  roundId: string
): Promise<ReassessmentApplicationResult> {
  await requireRole([Role.ASSESSOR]);

  const parsed = ReassessmentApplicationSchema.safeParse({
    bursaryAccountId,
    roundId,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  try {
    // Load bursary account details
    const account = await prisma.bursaryAccount.findUnique({
      where: { id: bursaryAccountId },
      include: { leadApplicant: true },
    });

    if (!account) {
      return { success: false, error: "Bursary account not found." };
    }

    // Generate reference
    const reference = `REA-${account.reference}-${roundId.slice(0, 8).toUpperCase()}`;

    // Create the re-assessment application
    const application = await prisma.application.create({
      data: {
        reference,
        roundId,
        bursaryAccountId,
        leadApplicantId: account.leadApplicantId,
        school: account.school,
        childName: account.childName,
        childDob: account.childDob,
        entryYear: account.entryYear,
        isReassessment: true,
        status: "PRE_SUBMISSION",
      },
    });

    // Pre-populate from the most recent previous year application
    const previous = await getPreviousYearApplication(bursaryAccountId, roundId);
    if (previous) {
      await prepopulateReassessment(application.id, previous.id);
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE_REASSESSMENT_APPLICATION",
        entityType: "Application",
        entityId: application.id,
        context: `Re-assessment application created for ${account.childName}`,
        metadata: {
          bursaryAccountId,
          roundId,
          previousApplicationId: previous?.id ?? null,
        },
      },
    });

    revalidatePath("/admin/applications");
    return { success: true, applicationId: application.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create re-assessment application";
    console.error("[createReassessmentApplicationAction] error:", err);
    return { success: false, error: message };
  }
}
