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
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import {
  submitApplicationData,
  refreshFormStatus,
  assertSubmittedAtUnset,
} from "@/lib/applications/status";
import { getSectionGapStatuses, type SectionGap } from "@/lib/portal/section-gaps";
import { isSubmissionDeadlinePassed } from "@/lib/rounds/submission-deadline";
import { mirrorApplicationToSchedule } from "@/lib/bursary-accounts/lifecycle";
import { TERMS_AND_CONDITIONS_VERSION } from "@/lib/portal/terms";
import { logError } from "@/lib/log";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

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
        where: { leadApplicantId: user.id, status: "PRE_SUBMISSION" },
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
      await upsertSection(
        tx,
        ctx.appId,
        section,
        result.data,
        true,
        ctx.ownerContributorId
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
      await upsertSection(
        tx,
        ctx.appId,
        section,
        data,
        false,
        ctx.ownerContributorId
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
  // Resolve the lead applicant's PRIMARY contributor first, then scope the
  // completeness check to ONLY their sections (dual-parent foundation, PR 4a).
  // For a single-parent application this is every section, so behaviour is
  // unchanged; once a SECONDARY can own its own section copies (PR 4b) the
  // primary's submit gate must not be affected by the secondary's rows.
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

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      return tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          reference: true,
          status: true,
          submittedAt: true,
          leadApplicantId: true,
          childName: true,
          childDob: true,
          school: true,
          entryYear: true,
          entryYearGroup: true,
          submissionDeadlineAt: true,
          bursaryAccountId: true,
          roundId: true,
          round: { select: { academicYear: true, closeDate: true } },
          sections: {
            where: { ownerContributorId },
            select: { section: true, isComplete: true, data: true },
          },
        },
      });
    }
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

  // ── Invariant: submitted_at is write-once (Epic 01 PR-5) ──────────────────
  // Defence-in-depth on the immutable submission date. The status guard above
  // handles the normal double-submit (redirects to the receipt). This explicit
  // check covers any state where a submission date is already recorded but the
  // fused status is not SUBMITTED — it returns a friendly message BEFORE the
  // write reaches the durable Postgres trigger (trg_submitted_at_immutable).
  assertSubmittedAtUnset(application.submittedAt);

  // ── Deadline lockout (Epic 05 §3.2) ───────────────────────────────────────
  // Server-side enforcement of the per-application submission deadline so a
  // stale tab cannot post after the cut-off. The effective deadline is the ONE
  // source of truth (Epic 03): per-app submissionDeadlineAt ?? round.closeDate
  // end-of-day. The UI also hides the submit control + renders read-only, but
  // this guard is authoritative.
  if (
    isSubmissionDeadlinePassed(
      { submissionDeadlineAt: application.submissionDeadlineAt },
      { closeDate: application.round.closeDate }
    )
  ) {
    throw new Error(
      "The submission deadline for this application has passed, so it can no longer be submitted. Forms submitted late cannot be assessed — please contact the Foundation if you believe this is an error."
    );
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
  // that isComplete alone does not capture. Scoped to the lead applicant's
  // PRIMARY contributor (dual-parent, PR 4b) so the secondary's owned section
  // rows and uploaded documents can never affect the primary's submit gate.
  const gapStatuses = await getSectionGapStatuses(applicationId, ownerContributorId);
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

  // ── Promote entry year-group + entry calendar year onto the columns ───────
  // The applicant picks the entry year-group in CHILD_DETAILS (spec §4); it
  // lives in section JSONB until submit, when we copy it to the first-class
  // `entryYearGroup` column that the assessment engine + reports read. A new
  // entrant's entry *calendar* year is the round they're applying to. We never
  // clobber values already set (e.g. carried into a re-assessment application).
  const childDetailsData = application.sections.find(
    (s) => s.section === "CHILD_DETAILS"
  )?.data as { entryYearGroup?: unknown; dateOfBirth?: unknown } | undefined;
  const VALID_GROUPS = ["Y6", "Y7", "Y9", "Y12", "OTHER"] as const;
  const rawGroup = childDetailsData?.entryYearGroup;
  const childEntryYearGroup =
    typeof rawGroup === "string" &&
    (VALID_GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as (typeof VALID_GROUPS)[number])
      : null;
  const roundStartYear = Number.parseInt(
    application.round.academicYear.slice(0, 4),
    10
  );
  const entryYearGroupToPersist = application.entryYearGroup ?? childEntryYearGroup;
  const entryYearToPersist =
    application.entryYear ?? (Number.isNaN(roundStartYear) ? null : roundStartYear);

  // ── Promote child DOB onto the first-class column (Epic 04, D12) ──────────
  // The DOB lives in CHILD_DETAILS JSONB as a 'YYYY-MM-DD' string. Promoting it
  // to applications.child_dob is what lets the per-child uniqueness key
  // disambiguate twins. Never clobber a DOB already set (e.g. carried into a
  // re-assessment or seeded from a contact at invite).
  const rawDob = childDetailsData?.dateOfBirth;
  const parsedChildDob =
    typeof rawDob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDob)
      ? new Date(`${rawDob}T00:00:00.000Z`)
      : null;
  const childDobToPersist = application.childDob ?? parsedChildDob;

  // ── Promote custody arrangement onto the first-class column (Epic 09, D15) ─
  // The shared-custody split lives in PARENT_DETAILS JSONB; promote it to
  // applications.custody_arrangement so the assessor decision aid + lifecycle
  // read it from the column. Defaults to SOLE when absent (a sole / single
  // two-resident-parent household). Only the PRIMARY's parent-details carry the
  // household-level answer (the secondary fills their own subset).
  const parentDetailsData = application.sections.find(
    (s) => s.section === "PARENT_DETAILS"
  )?.data as { custodyArrangement?: unknown } | undefined;
  const VALID_CUSTODY = ["SOLE", "SHARED_5050", "SHARED_MAIN_LIMITED"] as const;
  const rawCustody = parentDetailsData?.custodyArrangement;
  const custodyToPersist =
    typeof rawCustody === "string" &&
    (VALID_CUSTODY as readonly string[]).includes(rawCustody)
      ? (rawCustody as (typeof VALID_CUSTODY)[number])
      : "SOLE";

  // ── Mark as SUBMITTED ─────────────────────────────────────────────────────
  // The status update is committed in its own transaction so that a subsequent
  // audit-log failure can never roll it back. (The audit INSERT runs inside a
  // Prisma create() which issues INSERT ... RETURNING *; if the SELECT policy
  // on audit_logs filtered the RETURNING row, Prisma would throw, abort the
  // Postgres transaction, and undo the status change — the original bug.)
  const submittedAt = new Date();
  await withUserContext(user.id, user.role as RlsRole, async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        ...submitApplicationData(),
        submittedAt,
        // Record T&Cs acceptance per submission (Epic 05, D10). The declaration
        // section (validated complete above) carries the per-parent acceptance
        // ticks; here we stamp WHEN it was accepted and WHICH document/version,
        // so a later T&Cs swap never rewrites a historic acceptance. Stamped
        // alongside submittedAt so they share the immutable submission instant.
        termsAcceptedAt: submittedAt,
        termsVersion: TERMS_AND_CONDITIONS_VERSION,
        entryYearGroup: entryYearGroupToPersist,
        entryYear: entryYearToPersist,
        childDob: childDobToPersist,
        custodyArrangement: custodyToPersist,
      },
    });
  });

  // ── Audit log (decoupled, non-blocking) ───────────────────────────────────
  // Written in a separate withAdminContext transaction AFTER the status update
  // commits. service_role satisfies is_admin() so the INSERT policy always
  // passes regardless of claim shape, and RETURNING is not filtered by the
  // SELECT policy. A failure here is caught by createAuditLog's own try/catch
  // and logged to stderr; it cannot affect the committed submission.
  await withAdminContext(async (tx) => {
    await createAuditLog(tx, {
      userId: user.id,
      action: AUDIT_ACTIONS.APPLICATION_SUBMITTED,
      entityType: AUDIT_ENTITY_TYPES.Application,
      entityId: applicationId,
      context: `Reference: ${application.reference}`,
      metadata: {
        reference: application.reference,
        submittedAt: submittedAt.toISOString(),
      },
    });
  });

  // ── Mirror onto the forward schedule (Epic 10) ────────────────────────────
  // For a rolling account, mark the matching schedule year RECEIVED + link this
  // application/round. The re-assessment was created against a REAL round, so
  // roundId/academicYear already exist — no future-round materialisation needed.
  // Runs under withAdminContext because bursary_schedule_entries is ADMIN-write
  // (the submitter is an APPLICANT). Non-blocking — a no-op when the application
  // has no account or no matching schedule row (e.g. a first-year/new app).
  if (application.bursaryAccountId) {
    try {
      await withAdminContext((tx) =>
        mirrorApplicationToSchedule(tx, {
          bursaryAccountId: application.bursaryAccountId!,
          academicYear: application.round.academicYear,
          applicationId,
          roundId: application.roundId,
          status: "RECEIVED",
          receivedOn: submittedAt,
        })
      );
    } catch (err) {
      logError("[submit] schedule mirror (RECEIVED) failed", err);
    }
  }

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
