"use server";

/**
 * Server actions for the applicant portal form sections.
 *
 * saveSection          — validates with Zod, upserts to ApplicationSection.
 * getSection           — loads existing section data.
 * getSectionStatus     — returns completion status for all 10 sections.
 * submitApplication    — validates all sections, marks as SUBMITTED, sends email.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/roles";
import { sectionSchemaMap } from "@/lib/schemas";
import {
  getApplicationForUser,
  getSectionStatusList,
  getSectionData,
  upsertSection,
} from "@/lib/db/queries/applications";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import { getSectionGapStatuses, type SectionGap } from "@/lib/portal/section-gaps";
import { logError } from "@/lib/log";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSectionResult {
  success: boolean;
  errors?: string[];
}

/**
 * Structured payload returned when submission is blocked by gap errors.
 * The client uses this to render the "issues to resolve" panel.
 */
export interface SubmitBlockedByGapsError {
  code: "GAPS_BLOCKING_SUBMISSION";
  gaps: Array<{
    id: string;
    sectionType: string;
    label: string;
    fieldRef?: string;
  }>;
}

export interface SectionDataResult {
  data: unknown;
  isComplete: boolean;
  updatedAt: Date | null;
}

export interface SectionStatusEntry {
  section: ApplicationSectionType;
  isComplete: boolean;
  updatedAt: Date | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveApplicationId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getApplicationForUser(tx, user.id)
  );
  return application?.id ?? null;
}

/**
 * Resolves the current applicant's owned application ID from the session.
 *
 * Intentionally ignores any client-supplied applicationId — every section
 * action must operate exclusively on the caller's own application to
 * prevent IDOR (audit finding 2.3).
 */
async function getOwnedApplicationId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findFirst({
        where: { leadApplicantId: user.id, status: "PRE_SUBMISSION" },
        select: { id: true },
      })
  );
  return application?.id ?? null;
}

/**
 * Resolves both the current user and their owned application ID in one step.
 * Returns nulls if not authenticated or no application exists.
 */
async function getOwnedApplicationContext(): Promise<{
  user: CurrentUser;
  appId: string;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findFirst({
        where: { leadApplicantId: user.id, status: "PRE_SUBMISSION" },
        select: { id: true },
      })
  );
  if (!application) return null;
  return { user, appId: application.id };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Validates and saves a section's data.
 * If an applicationId is not provided it will be resolved from the current user.
 */
export async function saveSection(
  _applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  // Always resolve server-side from the session. The client-supplied
  // applicationId is ignored to prevent IDOR (finding 2.3).
  const ctx = await getOwnedApplicationContext();
  if (!ctx) {
    return { success: false, errors: ["No active application found."] };
  }

  // Validate with the section's Zod schema
  const schema = sectionSchemaMap[section];
  if (!schema) {
    return { success: false, errors: [`Unknown section: ${section}`] };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => e.message
    );
    return { success: false, errors };
  }

  try {
    await withUserContext(ctx.user.id, ctx.user.role as RlsRole, (tx) =>
      upsertSection(tx, ctx.appId, section, result.data, true)
    );
    // Revalidate the portal layout so the sidebar progress stepper + bar
    // pick up the new completion state immediately.
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    logError("saveSection", err);
    return {
      success: false,
      errors: ["Failed to save your data. Please try again."],
    };
  }
}

/**
 * Saves a section as a partial draft (not validated as complete).
 */
export async function saveSectionDraft(
  _applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  const ctx = await getOwnedApplicationContext();
  if (!ctx) {
    return { success: false, errors: ["No active application found."] };
  }

  try {
    await withUserContext(ctx.user.id, ctx.user.role as RlsRole, (tx) =>
      upsertSection(tx, ctx.appId, section, data, false)
    );
    return { success: true };
  } catch (err) {
    logError("saveSectionDraft", err);
    return {
      success: false,
      errors: ["Failed to save draft. Please try again."],
    };
  }
}

/**
 * Loads existing section data.
 */
export async function getSection(
  _applicationId: string | null,
  section: ApplicationSectionType
): Promise<SectionDataResult> {
  const ctx = await getOwnedApplicationContext();
  if (!ctx) {
    return { data: null, isComplete: false, updatedAt: null };
  }

  const row = await withUserContext(
    ctx.user.id,
    ctx.user.role as RlsRole,
    (tx) => getSectionData(tx, ctx.appId, section)
  );
  return {
    data: row?.data ?? null,
    isComplete: row?.isComplete ?? false,
    updatedAt: row?.updatedAt ?? null,
  };
}

/**
 * Returns completion status for all 10 sections of the current user's application.
 */
export async function getSectionStatus(
  _applicationId: string | null
): Promise<SectionStatusEntry[]> {
  const ctx = await getOwnedApplicationContext();
  if (!ctx) return [];

  const rows = await withUserContext(
    ctx.user.id,
    ctx.user.role as RlsRole,
    (tx) => getSectionStatusList(tx, ctx.appId)
  );

  return rows.map((r) => ({
    section: r.section,
    isComplete: r.isComplete,
    updatedAt: r.updatedAt,
  }));
}

// ─── Submit Application ───────────────────────────────────────────────────────

const ALL_SECTIONS: ApplicationSectionType[] = [
  "CHILD_DETAILS",
  "FAMILY_ID",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
  "OTHER_INFO",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO",
  "DECLARATION",
];

/**
 * Submits the applicant's application.
 *
 * Steps:
 *  1. Verify all 10 sections are marked complete.
 *  2. Guard against double-submission (application must be PRE_SUBMISSION).
 *  3. Set status → SUBMITTED and record submittedAt.
 *  4. Send CONFIRMATION email to the applicant.
 *  5. Write an audit log entry.
 *  6. Redirect to /submitted.
 *
 * Throws an error (which the client submit button will surface) if validation fails.
 */
export async function submitApplication(applicationId: string): Promise<never> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to submit an application.");
  }

  // ── Load application ───────────────────────────────────────────────────────
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          reference: true,
          status: true,
          leadApplicantId: true,
          childName: true,
          school: true,
          sections: {
            select: { section: true, isComplete: true },
          },
        },
      })
  );

  if (!application) {
    throw new Error("Application not found.");
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  if (application.leadApplicantId !== user.id) {
    throw new Error("You do not have permission to submit this application.");
  }

  // ── Guard: already submitted ───────────────────────────────────────────────
  if (application.status === "SUBMITTED") {
    redirect("/submitted");
  }

  // ── Validate all 10 sections are complete ─────────────────────────────────
  const completionMap = new Map(
    application.sections.map((s) => [s.section, s.isComplete])
  );

  const incompleteSections = ALL_SECTIONS.filter(
    (s) => completionMap.get(s) !== true
  );

  if (incompleteSections.length > 0) {
    const labels = incompleteSections.join(", ");
    throw new Error(
      `The following sections are not yet complete: ${labels}. Please complete them before submitting.`
    );
  }

  // ── Validate no error-severity gaps remain (defence-in-depth) ────────────
  // This check catches missing required documents and structural rule failures
  // that isComplete alone does not capture.
  const gapStatuses = await getSectionGapStatuses(applicationId);
  const errorGaps: SectionGap[] = gapStatuses.flatMap((gs) =>
    gs.gaps.filter((g) => g.severity === "error")
  );

  if (errorGaps.length > 0) {
    const payload: SubmitBlockedByGapsError = {
      code: "GAPS_BLOCKING_SUBMISSION",
      gaps: errorGaps.map((g) => ({
        id: g.id,
        sectionType: g.sectionType,
        label: g.label,
        fieldRef: g.fieldRef,
      })),
    };
    // Encode the structured payload as a JSON string inside the Error message
    // so the client-side catch block can parse and display it.
    throw new Error(JSON.stringify(payload));
  }

  // ── Mark as SUBMITTED + audit log ─────────────────────────────────────────
  await withUserContext(user.id, user.role as RlsRole, async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    await createAuditLog(tx, {
      userId: user.id,
      action: "APPLICATION_SUBMITTED",
      entityType: "Application",
      entityId: applicationId,
      context: `Reference: ${application.reference}`,
      metadata: {
        reference: application.reference,
        submittedAt: new Date().toISOString(),
      },
    });
  });

  // ── Send confirmation email (non-blocking on failure) ─────────────────────
  const schoolLabel = application.school === "TRINITY" ? "Trinity School" : "Whitgift School";
  const emailResult = await sendEmail(user.email, "CONFIRMATION", {
    applicant_name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
    child_name: application.childName,
    school: schoolLabel,
    reference: application.reference,
    submission_date: new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  if (!emailResult.success) {
    console.warn(
      "[submitApplication] Confirmation email failed to send:",
      emailResult.error
    );
    // Non-fatal — the submission itself succeeded.
  }

  revalidatePath("/apply/review");
  revalidatePath("/submitted");
  revalidatePath("/status");

  redirect("/submitted");
}
