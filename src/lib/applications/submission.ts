/**
 * Shared core for submitting an application (CR-001 PR B).
 *
 * Extracted verbatim from the portal `submitApplication` server action so the
 * staff submit-on-behalf path can reuse the SAME gates, transition, audit,
 * schedule mirror and confirmation email — with three caller-controlled knobs:
 *
 *   - `expectedLeadApplicantId` — the portal's ownership check (staff callers
 *     authorise via `requireApplicationAccess` instead and omit it);
 *   - `enforceDeadline`        — the portal enforces the submission-deadline
 *     lockout; a staff submission may bypass it;
 *   - `auditAction` / `auditMetadata` — who-submitted-how lands in the audit
 *     trail (APPLICATION_SUBMITTED for the applicant; the on-behalf action
 *     carries the staff actor).
 *
 * The core NEVER redirects — an already-SUBMITTED form returns
 * `{ alreadySubmitted: true }` and the caller decides (the portal redirects to
 * the receipt; a staff caller surfaces an error). Everything else throws with
 * the exact messages the portal action threw before the extraction, so the
 * applicant-visible behaviour is byte-equivalent.
 */

import type { ApplicationSectionType } from "@prisma/client";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
} from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import { submitApplicationData } from "@/lib/applications/status";
import { getSectionGapStatuses, type SectionGap } from "@/lib/portal/section-gaps";
import { SECTION_ORDER } from "@/lib/portal/sections";
import { familyIdConsistencyIssues } from "@/lib/schemas/family-id";
import { isTwoParentHousehold } from "@/lib/schemas/parent-details";
import { isSubmissionDeadlinePassed } from "@/lib/rounds/submission-deadline";
import { mirrorApplicationToSchedule } from "@/lib/bursary-accounts/lifecycle";
import { TERMS_AND_CONDITIONS_VERSION } from "@/lib/portal/terms";
import { logError } from "@/lib/log";

import { AUDIT_ENTITY_TYPES, type AuditAction } from "@/lib/audit/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Structured payload thrown (JSON-encoded in an Error message) when submission
 * is blocked by gap errors. The client uses this to render the "issues to
 * resolve" panel.
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

export interface SubmitApplicationCoreInput {
  /** RLS context the load, gates and SUBMITTED transition run under. */
  actor: { id: string; role: RlsRole };
  applicationId: string;
  /**
   * The lead applicant's PRIMARY contributor — the completeness + gap gates
   * are scoped to ONLY their sections (dual-parent foundation, PR 4a/4b).
   */
  ownerContributorId: string;
  /**
   * When set, the application's leadApplicantId must match (the portal's
   * ownership check). Staff callers authorise via `requireApplicationAccess`
   * before invoking the core and omit it.
   */
  expectedLeadApplicantId?: string;
  /** The portal enforces the deadline lockout; staff paths may bypass it. */
  enforceDeadline: boolean;
  auditAction: AuditAction;
  /** Merged over the base `{ reference, submittedAt }` audit metadata. */
  auditMetadata?: Record<string, unknown>;
  /** Recipient + display name for the CONFIRMATION email. */
  confirmation: { to: string; applicantName: string };
}

export type SubmitApplicationCoreResult =
  | { alreadySubmitted: true }
  | { alreadySubmitted: false; reference: string };

// Canonical full section list (single source of truth, shared with the wizard
// / review / dashboard / sidebar / gap engine).
const ALL_SECTIONS: ApplicationSectionType[] = SECTION_ORDER;

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Submits an application: gates (ownership, double-submit, deadline,
 * completeness, error gaps), JSONB → column data promotion, the SUBMITTED
 * transition, audit, schedule mirror and confirmation email. See module
 * docstring for the caller-controlled knobs.
 *
 * Throws an error (which the portal submit button will surface) if validation
 * fails; returns `{ alreadySubmitted: true }` instead of redirecting when the
 * form is already SUBMITTED.
 */
export async function submitApplicationCore(
  input: SubmitApplicationCoreInput
): Promise<SubmitApplicationCoreResult> {
  const {
    actor,
    applicationId,
    ownerContributorId,
    expectedLeadApplicantId,
    enforceDeadline,
    auditAction,
    auditMetadata,
    confirmation,
  } = input;

  // ── Load application ───────────────────────────────────────────────────────
  // Scope the completeness check to ONLY the lead applicant's PRIMARY
  // contributor's sections (dual-parent foundation, PR 4a). For a single-parent
  // application this is every section, so behaviour is unchanged; once a
  // SECONDARY can own its own section copies (PR 4b) the primary's submit gate
  // must not be affected by the secondary's rows.
  const application = await withUserContext(
    actor.id,
    actor.role,
    async (tx) => {
      return tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          reference: true,
          formStatus: true,
          submittedAt: true,
          leadApplicantId: true,
          childName: true,
          childDob: true,
          school: true,
          entryYear: true,
          submissionDeadlineAt: true,
          // Selects which typed round default the deadline guard below reads
          // (E1/D13-8).
          applicationType: true,
          bursaryAccountId: true,
          roundId: true,
          round: {
            select: {
              academicYear: true,
              closeDate: true,
              defaultSubmissionDeadlineNew: true,
              defaultSubmissionDeadlineRolling: true,
            },
          },
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
  if (
    expectedLeadApplicantId !== undefined &&
    application.leadApplicantId !== expectedLeadApplicantId
  ) {
    throw new Error("You do not have permission to submit this application.");
  }

  // ── Guard: already submitted ───────────────────────────────────────────────
  // The caller decides what "already submitted" means (the portal redirects to
  // the receipt; a staff caller surfaces an error) — the core never redirects.
  if (application.formStatus === "SUBMITTED") {
    return { alreadySubmitted: true };
  }

  // ── Invariant: submitted_at is write-once (Epic 01 PR-5) ──────────────────
  // The submission date is fixed at FIRST submit and never rewritten. A normal
  // first submission has submittedAt === null; the form-status guard above
  // already caught the ordinary double-submit (form still SUBMITTED → receipt).
  //
  // The one path that reaches here WITH submittedAt already set is a
  // re-submission of an application that was REOPENED for a material change
  // (`reopenForMaterialChange`): form_status was moved SUBMITTED → IN_PROGRESS
  // but the ORIGINAL submission date was deliberately kept (D-G6/D3 — keep the
  // original date). We must NOT throw and must NOT rewrite the date: leaving
  // submitted_at unchanged satisfies the write-once trigger
  // (trg_submitted_at_immutable fires only when OLD is non-null AND NEW IS
  // DISTINCT FROM OLD). So we stamp submitted_at ONLY when it is currently null,
  // and reuse the existing instant otherwise.
  const isResubmission = application.submittedAt != null;
  const submittedAt = application.submittedAt ?? new Date();

  // ── Deadline lockout (Epic 05 §3.2) ───────────────────────────────────────
  // Server-side enforcement of the per-application submission deadline so a
  // stale tab cannot post after the cut-off. The effective deadline is the ONE
  // source of truth (Epic 03/12/E1): per-app submissionDeadlineAt ?? the round
  // default FOR THIS APPLICATION TYPE ?? round.closeDate, end-of-day. The UI
  // also hides the submit control + renders read-only, but this guard is
  // authoritative.
  if (
    enforceDeadline &&
    isSubmissionDeadlinePassed(
      {
        submissionDeadlineAt: application.submissionDeadlineAt,
        applicationType: application.applicationType,
      },
      application.round
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
  // Runs under the actor's RLS context — getSectionGapStatuses reads
  // RLS-protected tables; off the global client it returns zero rows, which
  // would silently let an incomplete application through this gate.
  const gapStatuses = await withUserContext(actor.id, actor.role, (tx) =>
    getSectionGapStatuses(tx, applicationId, ownerContributorId)
  );
  const errorGaps: SectionGap[] = gapStatuses.flatMap((gs) =>
    gs.gaps.filter((g) => g.severity === "error")
  );

  // ── Cross-section Family Identification consistency (per-section schema is
  // scoped to one section, so the child-count / partner-adult rules are also
  // enforced HERE where every section's data is in hand). Only runs when the
  // FAMILY_ID section carries members (skipped for rolling-over re-assessments
  // where it is hidden). Mirrors makeFamilyIdSchema exactly. ─────────────────
  const sectionData = new Map(
    application.sections.map((s) => [s.section, s.data])
  );
  const familyIdData = sectionData.get("FAMILY_ID") as {
    familyMembers?: { role?: string; memberType?: string }[];
  } | null;
  const crossSectionGaps: SubmitBlockedByGapsError["gaps"] = [];
  if (Array.isArray(familyIdData?.familyMembers)) {
    const depData = sectionData.get("DEPENDENT_CHILDREN") as {
      numberOfDependentChildren?: number;
      children?: unknown[];
    } | null;
    const dependentChildrenCount =
      typeof depData?.numberOfDependentChildren === "number"
        ? depData.numberOfDependentChildren
        : Array.isArray(depData?.children)
          ? depData!.children!.length
          : undefined;
    const parentData = sectionData.get("PARENT_DETAILS") as {
      isSoleParent?: boolean;
      relationshipStatus?: string;
    } | null;
    for (const issue of familyIdConsistencyIssues(familyIdData!.familyMembers!, {
      dependentChildrenCount,
      requiresPartnerAdult: isTwoParentHousehold({
        isSoleParent: parentData?.isSoleParent,
        relationshipStatus: parentData?.relationshipStatus,
      }),
    })) {
      crossSectionGaps.push({
        id: issue.id,
        sectionType: "FAMILY_ID",
        label: issue.message,
        fieldRef: "familyMembers",
      });
    }
  }

  if (errorGaps.length > 0 || crossSectionGaps.length > 0) {
    const payload: SubmitBlockedByGapsError = {
      code: "GAPS_BLOCKING_SUBMISSION",
      gaps: [
        ...errorGaps.map((g) => ({
          id: g.id,
          sectionType: g.sectionType,
          label: g.label,
          fieldRef: g.fieldRef,
        })),
        ...crossSectionGaps,
      ],
    };
    // Encode the structured payload as a JSON string inside the Error message
    // so the client-side catch block can parse and display it.
    throw new Error(JSON.stringify(payload));
  }

  // ── Backfill the entry calendar year onto the column ─────────────────────
  // The entry year-group is JWF-facing ONLY (Q1, Brian 2026-08-14): it is set
  // admin-side on `Application.entryYearGroup` and is NEVER read out of the
  // CHILD_DETAILS blob here — the applicant cannot enter it, so there is
  // nothing to promote and no way for a submit to clobber the admin value.
  // A new entrant's entry *calendar* year is still derived from the round they
  // applied to when the column has not been set. Never clobber a value already
  // set (e.g. carried into a re-assessment application).
  const childDetailsData = application.sections.find(
    (s) => s.section === "CHILD_DETAILS"
  )?.data as { dateOfBirth?: unknown } | undefined;
  const roundStartYear = Number.parseInt(
    application.round.academicYear.slice(0, 4),
    10
  );
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
  await withUserContext(actor.id, actor.role, async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        ...submitApplicationData(),
        // Stamp the submission instant + T&Cs acceptance ONLY on a first
        // submission. On a re-submission of a reopened application we keep the
        // ORIGINAL submitted_at (D-G6/D3) — writing it again would trip the
        // write-once trigger — and we leave the historic T&Cs acceptance
        // (termsAcceptedAt/termsVersion) untouched so a later T&Cs swap never
        // rewrites it. Record T&Cs acceptance per submission (Epic 05, D10): the
        // declaration section (validated complete above) carries the per-parent
        // ticks; we stamp WHEN it was accepted and WHICH document/version.
        ...(isResubmission
          ? {}
          : {
              submittedAt,
              termsAcceptedAt: submittedAt,
              termsVersion: TERMS_AND_CONDITIONS_VERSION,
            }),
        // entryYearGroup is intentionally NOT written here — it is JWF-facing
        // and admin-set only (Q1). Submitting must never change it.
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
      userId: actor.id,
      action: auditAction,
      entityType: AUDIT_ENTITY_TYPES.Application,
      entityId: applicationId,
      context: `Reference: ${application.reference}`,
      metadata: {
        reference: application.reference,
        submittedAt: submittedAt.toISOString(),
        ...(auditMetadata ?? {}),
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
  const emailResult = await sendEmail(confirmation.to, "CONFIRMATION", {
    applicant_name: confirmation.applicantName,
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

  return { alreadySubmitted: false, reference: application.reference };
}
