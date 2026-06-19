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
import { ApplicationSectionType, type Prisma } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/roles";
import { sectionSchemaMap } from "@/lib/schemas";
import {
  getApplicationForUser,
  getSectionStatusList,
  getSectionData,
  upsertSection,
} from "@/lib/db/queries/applications";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
  type Tx,
} from "@/lib/db/prisma";
import { refreshFormStatus } from "@/lib/applications/status";
import { submitApplicationCore } from "@/lib/applications/submission";
import {
  diffSectionPaths,
  clearProvenance,
} from "@/lib/applications/section-diff";
import { logError } from "@/lib/log";

import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSectionResult {
  success: boolean;
  errors?: string[];
}

/**
 * Structured payload returned when submission is blocked by gap errors.
 * The client uses this to render the "issues to resolve" panel. Defined in the
 * submission core (CR-001 PR B); re-exported here so existing importers keep
 * working — a type-only re-export is erased and so is allowed in a
 * "use server" file.
 */
export type { SubmitBlockedByGapsError } from "@/lib/applications/submission";

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
        where: { leadApplicantId: user.id, formStatus: { not: "SUBMITTED" } },
        select: { id: true },
      })
  );
  return application?.id ?? null;
}

/**
 * Resolves the current user, their owned application ID, and the contributor
 * id they write/read sections as — in one step. Returns null if not
 * authenticated or no application exists.
 *
 * For the lead applicant the owning contributor is their PRIMARY contributor.
 * Every section save/read for the lead applicant is scoped to this contributor
 * (dual-parent foundation, PR 4a), so their experience is identical to before:
 * they see and write exactly their own sections.
 *
 * The PRIMARY contributor is created at application-creation time (all five
 * create paths call `ensurePrimaryContributor` under admin context, and PR 1's
 * migration backfilled every pre-existing application), so on this hot path we
 * only need to RESOLVE it with a SELECT — which the lead applicant is allowed
 * to do under RLS. We must NOT upsert here: the `application_contributors`
 * write policy is admin-only, so an applicant-context write (even the no-op
 * `update: {}`, which `@updatedAt` turns into a real UPDATE) is filtered to
 * zero rows and Prisma throws P2025 — which would break every section save.
 * The admin-context self-heal below only runs for the (should-be-impossible)
 * case of an application with no PRIMARY contributor.
 */
async function getOwnedApplicationContext(): Promise<{
  user: CurrentUser;
  appId: string;
  ownerContributorId: string;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const resolved = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const application = await tx.application.findFirst({
        where: { leadApplicantId: user.id, formStatus: { not: "SUBMITTED" } },
        select: { id: true },
      });
      if (!application) return null;

      const ownerContributorId = await resolveOwningContributorId(
        tx,
        application.id,
        user.id
      );
      return { appId: application.id, ownerContributorId };
    }
  );

  if (!resolved) return null;

  // Self-heal: an application should always have a PRIMARY contributor (created
  // at application creation). If one is missing (a legacy row), create it under
  // admin context — the applicant-scoped transaction above cannot, by policy.
  let ownerContributorId = resolved.ownerContributorId;
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, resolved.appId, user.id)
    );
  }

  return {
    user,
    appId: resolved.appId,
    ownerContributorId,
  };
}

/**
 * CR-001 edit-on-behalf: when the APPLICANT re-edits a field an assessor
 * previously entered on their behalf, the assessor-entered stamp for that path
 * must go — the applicant reclaims ownership of it.
 *
 * Returns the cleared provenance map to pass as `upsertSection`'s optional
 * provenance arg, or undefined when there is nothing to clear. The extra read
 * selects only the two fields the diff needs, and when the stored provenance
 * is empty (the overwhelmingly common case — no assessor has ever edited the
 * section) we skip the diff entirely and return undefined, so the upsert
 * payload is byte-identical to the pre-CR-001 save.
 */
async function clearedProvenanceForApplicantSave(
  tx: Tx,
  applicationId: string,
  section: ApplicationSectionType,
  ownerContributorId: string,
  newData: unknown
): Promise<Prisma.InputJsonValue | undefined> {
  const existing = await tx.applicationSection.findUnique({
    where: {
      applicationId_section_ownerContributorId: {
        applicationId,
        section,
        ownerContributorId,
      },
    },
    select: { data: true, assessorProvenance: true },
  });

  const stored = existing?.assessorProvenance;
  const hasProvenance =
    typeof stored === "object" &&
    stored !== null &&
    !Array.isArray(stored) &&
    Object.keys(stored).length > 0;
  if (!hasProvenance) return undefined;

  const changedPaths = diffSectionPaths(existing?.data ?? {}, newData);
  return clearProvenance(stored, changedPaths) as unknown as Prisma.InputJsonValue;
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
    await withUserContext(ctx.user.id, ctx.user.role as RlsRole, async (tx) => {
      // CR-001: an applicant edit reclaims any assessor-stamped fields it
      // changes (undefined when no provenance is stored — see helper).
      const clearedProvenance = await clearedProvenanceForApplicantSave(
        tx,
        ctx.appId,
        section,
        ctx.ownerContributorId,
        result.data
      );
      await upsertSection(
        tx,
        ctx.appId,
        section,
        result.data,
        true,
        ctx.ownerContributorId,
        clearedProvenance
      );
      // Re-derive form_status from section completion (IN_PROGRESS once a
      // section is complete, FILLED_IN once all required are). Scoped to the
      // lead applicant's PRIMARY contributor, matching the submit gate.
      await refreshFormStatus(tx, ctx.appId, ctx.ownerContributorId);
    });
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
    await withUserContext(ctx.user.id, ctx.user.role as RlsRole, async (tx) => {
      // CR-001: a draft save reclaims assessor-stamped fields too — the
      // applicant has re-entered them, complete or not.
      const clearedProvenance = await clearedProvenanceForApplicantSave(
        tx,
        ctx.appId,
        section,
        ctx.ownerContributorId,
        data
      );
      await upsertSection(
        tx,
        ctx.appId,
        section,
        data,
        false,
        ctx.ownerContributorId,
        clearedProvenance
      );
      // Keep form_status in lockstep with completion (no-op while still 0
      // complete; corrects it if a section was un-completed).
      await refreshFormStatus(tx, ctx.appId, ctx.ownerContributorId);
    });
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
    (tx) => getSectionData(tx, ctx.appId, section, ctx.ownerContributorId)
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
    (tx) => getSectionStatusList(tx, ctx.appId, ctx.ownerContributorId)
  );

  return rows.map((r) => ({
    section: r.section,
    isComplete: r.isComplete,
    updatedAt: r.updatedAt,
  }));
}

// ─── Submit Application ───────────────────────────────────────────────────────

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
 * Steps 1–5 live in `submitApplicationCore` (CR-001 PR B extracted them so the
 * staff submit-on-behalf path reuses the same gates/transition); this action
 * keeps the portal-specific shell: session auth, contributor resolution, the
 * ownership check (`expectedLeadApplicantId`), the enforced deadline, and the
 * redirects.
 *
 * Throws an error (which the client submit button will surface) if validation fails.
 */
export async function submitApplication(applicationId: string): Promise<never> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to submit an application.");
  }

  // ── Resolve the lead applicant's PRIMARY contributor ──────────────────────
  // The core scopes the completeness check to ONLY their sections (dual-parent
  // foundation, PR 4a). For a single-parent application this is every section,
  // so behaviour is unchanged; once a SECONDARY can own its own section copies
  // (PR 4b) the primary's submit gate must not be affected by the secondary's
  // rows.
  // Resolve the PRIMARY contributor (SELECT) — never upsert on this path; the
  // contributor write policy is admin-only and an applicant-context write would
  // be RLS-filtered (P2025). Self-heal under admin context only if missing.
  let ownerContributorId = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => resolveOwningContributorId(tx, applicationId, user.id)
  );
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, applicationId, user.id)
    );
  }

  const result = await submitApplicationCore({
    actor: { id: user.id, role: user.role as RlsRole },
    applicationId,
    ownerContributorId,
    expectedLeadApplicantId: user.id,
    enforceDeadline: true,
    auditAction: AUDIT_ACTIONS.APPLICATION_SUBMITTED,
    confirmation: {
      to: user.email,
      applicantName:
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
    },
  });

  // ── Guard: already submitted ───────────────────────────────────────────────
  if (result.alreadySubmitted) {
    redirect("/submitted");
  }

  revalidatePath("/apply/review");
  revalidatePath("/submitted");
  revalidatePath("/status");

  redirect("/submitted");
}
