"use server";

/**
 * Server actions for the RESTRICTED SECONDARY-PARENT portal (/contribute).
 *
 * The second parent of a separated/divorced family supplies ONLY their own
 * PARENT_DETAILS, PARENTS_INCOME and ASSETS_LIABILITIES (and supporting
 * documents). They are not a lead applicant and own no application; they were
 * invited onto a child's application owned by the PRIMARY parent (PR 3) and
 * their ApplicationContributor row was flipped to IN_PROGRESS on acceptance.
 *
 * These actions mirror apply/actions.ts but resolve the SECONDARY contributor
 * instead of the PRIMARY:
 *   - The application + contributor are resolved SERVER-SIDE from the session
 *     (getSecondaryContributorContext) — a client-supplied applicationId is
 *     never trusted (IDOR hardening, mirrors getOwnedApplicationContext).
 *   - Section reads/writes run under the secondary's withUserContext; PR 2 RLS
 *     permits SELECT/INSERT/UPDATE of ONLY their own owned section rows.
 *   - The submit action flips the contributor → SUBMITTED, which is a write on
 *     application_contributors whose policy is ADMIN-ONLY, so it MUST run under
 *     withAdminContext (an applicant-context write would be RLS-filtered → P2025).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApplicationSectionType, ApplicationContributorStatus } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/roles";
import { sectionSchemaMap } from "@/lib/schemas";
import {
  getSectionStatusList,
  getSectionData,
  upsertSection,
} from "@/lib/db/queries/applications";
import {
  getSecondaryContributorContext,
  type SecondaryContributorContext,
} from "@/lib/db/queries/contributors";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import { getSectionGapStatuses, type SectionGap } from "@/lib/portal/section-gaps";
import { logError } from "@/lib/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSectionResult {
  success: boolean;
  errors?: string[];
}

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

/**
 * The three (and only three) sections a secondary contributor fills, in order.
 * Used by the wizard nav, the completeness gate, and the submit validation.
 */
export const SECONDARY_SECTIONS: ApplicationSectionType[] = [
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
];

// ─── Context helper ─────────────────────────────────────────────────────────

interface SecondaryContext {
  user: CurrentUser;
  ctx: SecondaryContributorContext;
}

/**
 * Resolves the current user and the application they are the SECONDARY
 * contributor of, both from the session. Returns null when the caller is not a
 * secondary contributor of any application. Every contribute action gates on
 * this (so a non-secondary, or an attempt to act on another application, is
 * rejected before any write).
 */
async function getSecondaryContext(): Promise<SecondaryContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const ctx = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getSecondaryContributorContext(tx, user.id)
  );
  if (!ctx) return null;

  return { user, ctx };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Validates and saves one of the secondary's section's data (full / complete).
 * The client-supplied applicationId is ignored — the application is resolved
 * from the session (IDOR hardening).
 */
export async function saveSection(
  _applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  if (!SECONDARY_SECTIONS.includes(section)) {
    return { success: false, errors: ["This section is not available."] };
  }

  const resolved = await getSecondaryContext();
  if (!resolved) {
    return { success: false, errors: ["No active contribution found."] };
  }
  const { user, ctx } = resolved;

  const schema = sectionSchemaMap[section];
  if (!schema) {
    return { success: false, errors: [`Unknown section: ${section}`] };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((e) => e.message) };
  }

  try {
    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      upsertSection(
        tx,
        ctx.applicationId,
        section,
        result.data,
        true,
        ctx.contributorId
      )
    );
    revalidatePath("/contribute", "layout");
    return { success: true };
  } catch (err) {
    logError("contribute/saveSection", err);
    return { success: false, errors: ["Failed to save your data. Please try again."] };
  }
}

/**
 * Saves one of the secondary's sections as a partial draft (not complete).
 */
export async function saveSectionDraft(
  _applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  if (!SECONDARY_SECTIONS.includes(section)) {
    return { success: false, errors: ["This section is not available."] };
  }

  const resolved = await getSecondaryContext();
  if (!resolved) {
    return { success: false, errors: ["No active contribution found."] };
  }
  const { user, ctx } = resolved;

  try {
    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      upsertSection(tx, ctx.applicationId, section, data, false, ctx.contributorId)
    );
    return { success: true };
  } catch (err) {
    logError("contribute/saveSectionDraft", err);
    return { success: false, errors: ["Failed to save draft. Please try again."] };
  }
}

/**
 * Loads one of the secondary's sections' data.
 */
export async function getSection(
  _applicationId: string | null,
  section: ApplicationSectionType
): Promise<SectionDataResult> {
  if (!SECONDARY_SECTIONS.includes(section)) {
    return { data: null, isComplete: false, updatedAt: null };
  }

  const resolved = await getSecondaryContext();
  if (!resolved) {
    return { data: null, isComplete: false, updatedAt: null };
  }
  const { user, ctx } = resolved;

  const row = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    getSectionData(tx, ctx.applicationId, section, ctx.contributorId)
  );
  return {
    data: row?.data ?? null,
    isComplete: row?.isComplete ?? false,
    updatedAt: row?.updatedAt ?? null,
  };
}

// ─── Submit ───────────────────────────────────────────────────────────────────

/**
 * Submits the secondary contributor's portion.
 *
 * Steps:
 *  1. Resolve the secondary's application + contributor from the session.
 *  2. Guard against double-submission (contributor already SUBMITTED).
 *  3. Validate their three sections are complete + free of error-severity gaps
 *     (scoped to THEIR owned rows — never affected by the primary's data).
 *  4. Flip the contributor → SUBMITTED + set submittedAt UNDER ADMIN CONTEXT
 *     (the application_contributors write policy is admin-only).
 *  5. Send SECONDARY_PARENT_RECEIVED to the secondary, write an audit log.
 *  6. Redirect to /contribute/submitted.
 *
 * The client-supplied applicationId is ignored — resolved from the session.
 */
export async function submitContribution(): Promise<never> {
  const resolved = await getSecondaryContext();
  if (!resolved) {
    throw new Error("No active contribution found.");
  }
  const { user, ctx } = resolved;

  // Guard: already submitted → straight to the thank-you page.
  if (ctx.status === ApplicationContributorStatus.SUBMITTED) {
    redirect("/contribute/submitted");
  }

  // ── Validate the three sections are complete (scoped to the secondary) ─────
  const statuses = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    getSectionStatusList(tx, ctx.applicationId, ctx.contributorId)
  );
  const completionMap = new Map(statuses.map((s) => [s.section, s.isComplete]));
  const incomplete = SECONDARY_SECTIONS.filter(
    (s) => completionMap.get(s) !== true
  );
  if (incomplete.length > 0) {
    throw new Error(
      `The following sections are not yet complete: ${incomplete.join(
        ", "
      )}. Please complete them before submitting.`
    );
  }

  // ── Validate no error-severity gaps remain (scoped to the secondary) ──────
  // getSectionGapStatuses returns ALL section types; we only care about the
  // three the secondary owns. Their gap evaluation reads only the secondary's
  // owned section rows + their own uploaded documents (owner-scoped, PR 4b).
  const gapStatuses = await getSectionGapStatuses(
    ctx.applicationId,
    ctx.contributorId
  );
  const errorGaps: SectionGap[] = gapStatuses
    .filter((gs) => SECONDARY_SECTIONS.includes(gs.sectionType))
    .flatMap((gs) => gs.gaps.filter((g) => g.severity === "error"));

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
    throw new Error(JSON.stringify(payload));
  }

  // ── Flip the contributor → SUBMITTED (ADMIN context — write policy is admin-only) ─
  const submittedAt = new Date();
  await withAdminContext((tx) =>
    tx.applicationContributor.update({
      where: { id: ctx.contributorId },
      data: {
        status: ApplicationContributorStatus.SUBMITTED,
        submittedAt,
      },
    })
  );

  // ── Audit log (admin context; non-blocking on failure) ─────────────────────
  await withAdminContext(async (tx) => {
    await createAuditLog(tx, {
      userId: user.id,
      action: AUDIT_ACTIONS.SECONDARY_PARENT_SUBMITTED,
      entityType: AUDIT_ENTITY_TYPES.ApplicationContributor,
      entityId: ctx.contributorId,
      context: `Second parent ${user.email} submitted their financial details`,
      metadata: {
        applicationId: ctx.applicationId,
        submittedAt: submittedAt.toISOString(),
      },
    });
  });

  // ── Send confirmation email to the secondary (non-blocking on failure) ─────
  // Merge fields match the seeded SECONDARY_PARENT_RECEIVED template:
  // secondary_parent_name, child_name, school, round_year.
  const schoolLabel = ctx.school === "TRINITY" ? "Trinity School" : "Whitgift School";
  const emailResult = await sendEmail(user.email, "SECONDARY_PARENT_RECEIVED", {
    secondary_parent_name:
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
    child_name: ctx.childName,
    school: schoolLabel,
    round_year: ctx.roundYear ?? "",
  });
  if (!emailResult.success) {
    console.warn(
      "[submitContribution] SECONDARY_PARENT_RECEIVED email failed to send:",
      emailResult.error
    );
  }

  revalidatePath("/contribute", "layout");
  revalidatePath("/contribute/submitted");

  redirect("/contribute/submitted");
}
