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
  applicantSubmissionErrors,
  DRAFT_DEADLINE_PASSED_MESSAGE,
} from "@/lib/applications/submission-error";
import {
  DEADLINE_ROUND_SELECT,
  isSubmissionDeadlinePassed,
} from "@/lib/rounds/submission-deadline";
import {
  diffSectionPaths,
  clearProvenance,
} from "@/lib/applications/section-diff";
import { logError } from "@/lib/log";
import { getActiveApplicationId } from "@/lib/portal/active-application";

import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { PORTAL_APPLICATION } from "@/lib/applications/migration-source";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSectionResult {
  success: boolean;
  errors?: string[];
}

/** What `submitApplication` returns when it does not redirect to /submitted. */
export interface SubmitApplicationFailure {
  success: false;
  errors: string[];
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

  const activeId = await getActiveApplicationId();
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getApplicationForUser(tx, user.id, activeId)
  );
  return application?.id ?? null;
}

/**
 * Resolves the current user, the application the section form was rendered
 * for, and the contributor id they write/read sections as — in one step.
 * Returns null if not authenticated, or if `applicationId` is not one of the
 * caller's own, still-editable (not SUBMITTED) portal applications.
 *
 * `applicationId` is the id the section page rendered the form for (the
 * client passes it back). It is never trusted on its own: it is folded into
 * the ownership WHERE (`leadApplicantId = user.id`, not SUBMITTED, portal
 * application), so a foreign or stale id matches nothing (IDOR, audit finding
 * 2.3). There is deliberately NO fallback to the active-application cookie or
 * to "any other draft" (audit finding 9): with two children's drafts open in
 * two tabs, each tab's saves must land on the child that tab shows, and a tab
 * left open on an application that has since been submitted must fail rather
 * than write into a sibling's draft.
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
 *
 * `deadlinePassed` is the portal lockout's own rule (`isSubmissionDeadlinePassed`
 * — the same one the section page and the submit guard use). Only the save
 * actions refuse on it; the read paths still load the (read-only) form.
 */
async function getOwnedApplicationContext(
  applicationId: string | null
): Promise<{
  user: CurrentUser;
  appId: string;
  ownerContributorId: string;
  deadlinePassed: boolean;
} | null> {
  const user = await getCurrentUser();
  if (!user || !applicationId) return null;

  const resolved = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const application = await tx.application.findFirst({
        where: {
          id: applicationId,
          leadApplicantId: user.id,
          formStatus: { not: "SUBMITTED" },
          ...PORTAL_APPLICATION,
        },
        select: {
          id: true,
          submissionDeadlineAt: true,
          applicationType: true,
          round: { select: DEADLINE_ROUND_SELECT },
        },
      });
      if (!application) return null;

      const ownerContributorId = await resolveOwningContributorId(
        tx,
        application.id,
        user.id
      );
      return {
        appId: application.id,
        ownerContributorId,
        deadlinePassed: isSubmissionDeadlinePassed(application, application.round),
      };
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
    deadlinePassed: resolved.deadlinePassed,
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
 * Returned when the form's application is not (or no longer) the caller's own
 * editable draft — e.g. a tab left open after the application was submitted.
 */
const NOT_EDITABLE_ERROR =
  "This application can't be changed any more — it may already have been submitted. Please reload the page.";

/**
 * Validates and saves a section's data to the application the form was
 * rendered for (`applicationId`), after verifying the caller owns it, it is
 * not submitted, and its submission deadline has not passed (see
 * `getOwnedApplicationContext`).
 */
export async function saveSection(
  applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  const ctx = await getOwnedApplicationContext(applicationId);
  if (!ctx) {
    return { success: false, errors: [NOT_EDITABLE_ERROR] };
  }
  if (ctx.deadlinePassed) {
    return { success: false, errors: [DRAFT_DEADLINE_PASSED_MESSAGE] };
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
  applicationId: string | null,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  const ctx = await getOwnedApplicationContext(applicationId);
  if (!ctx) {
    return { success: false, errors: [NOT_EDITABLE_ERROR] };
  }
  if (ctx.deadlinePassed) {
    return { success: false, errors: [DRAFT_DEADLINE_PASSED_MESSAGE] };
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
  applicationId: string | null,
  section: ApplicationSectionType
): Promise<SectionDataResult> {
  const ctx = await getOwnedApplicationContext(applicationId);
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
  applicationId: string | null
): Promise<SectionStatusEntry[]> {
  const ctx = await getOwnedApplicationContext(applicationId);
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
 * Redirects to /submitted on success. On failure it RETURNS the applicant copy
 * rather than throwing it: Next.js replaces the message of any error thrown from
 * a server action in production builds ("An error occurred in the Server
 * Components render…"), so a thrown message never reaches the parent (prod,
 * 13 Nov 2026). The sanitising happens here (CF-25) and the real error goes to
 * `logError`.
 */
export async function submitApplication(
  applicationId: string
): Promise<SubmitApplicationFailure> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      errors: ["You must be signed in to submit an application."],
    };
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
  //
  // Ownership is proven FIRST, under the caller's own RLS context: the
  // self-heal below writes under admin context, and the core's ownership check
  // (`expectedLeadApplicantId`) only runs after it. Without this, submitting
  // another family's id created a PRIMARY contributor row for this user on
  // their application before the core refused.
  const owned = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const application = await tx.application.findFirst({
        where: { id: applicationId, leadApplicantId: user.id },
        select: { id: true },
      });
      if (!application) return null;
      return {
        ownerContributorId: await resolveOwningContributorId(tx, applicationId, user.id),
      };
    }
  );
  if (!owned) {
    // The same thing the core's own not-found refusal shows the applicant.
    const notFound = new Error("Application not found.");
    logError("submitApplication", notFound, { applicationId });
    return { success: false, errors: applicantSubmissionErrors(notFound) };
  }
  let ownerContributorId = owned.ownerContributorId;
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, applicationId, user.id)
    );
  }

  // Every gate below throws for whoever is debugging it — a JSON gap payload, a
  // list of section enum values, a Prisma/RLS failure — and the portal's submit
  // handler renders `err.message` straight into the form's error banner. So the
  // diagnostic is logged HERE, in full, and what leaves this action is the plain
  // sentence the applicant can act on (CF-25). The core never redirects, so
  // nothing thrown from it is Next's NEXT_REDIRECT control-flow error; the
  // redirects below stay outside the catch where they belong.
  let result: Awaited<ReturnType<typeof submitApplicationCore>>;
  try {
    result = await submitApplicationCore({
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
  } catch (err) {
    logError("submitApplication", err, { applicationId });
    return { success: false, errors: applicantSubmissionErrors(err) };
  }

  // ── Guard: already submitted ───────────────────────────────────────────────
  if (result.alreadySubmitted) {
    redirect("/submitted");
  }

  revalidatePath("/apply/review");
  revalidatePath("/submitted");
  revalidatePath("/status");

  redirect("/submitted");
}
