"use server";

/**
 * Edit-on-behalf server actions (CR-001).
 *
 * saveSectionOnBehalf — the staff counterpart of the portal `saveSection`.
 * ADMIN (or the assigned ASSESSOR) validates with the SAME Zod schema, writes
 * the section against the applicant's PRIMARY contributor, stamps per-field
 * assessor provenance (so the UI can badge assessor-entered values), and
 * audits the save as SECTION_SAVED_BY_ASSESSOR.
 *
 * The review-phase gate (`canEditOnBehalf`) is RE-CHECKED inside the write
 * transaction — the edit layout's gate alone cannot stop a concurrent
 * complete/outcome from landing between render and save.
 *
 * finishEditingOnBehalf — ends an editing pass: emails the applicant a summary
 * of the assessor-edited sections (derived from the stored provenance) and
 * audits the pass. A pass that changed nothing is a silent no-op.
 *
 * submitApplicationOnBehalf — staff submission of a FILLED_IN form through the
 * SAME `submitApplicationCore` the portal uses (typed-up paper form, CR-001).
 */

import { revalidatePath } from "next/cache";
import type { ApplicationSectionType, Prisma } from "@prisma/client";
import { requireRole, requireApplicationAccess, Role } from "@/lib/auth/roles";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
} from "@/lib/db/prisma";
import { sectionSchemaMap } from "@/lib/schemas";
import { upsertSection } from "@/lib/db/queries/applications";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import {
  refreshFormStatus,
  deriveReviewPhase,
  discardAssessment,
} from "@/lib/applications/status";
import { canEditOnBehalf } from "@/lib/applications/edit-on-behalf";
import {
  diffSectionPaths,
  mergeProvenance,
} from "@/lib/applications/section-diff";
import { submitApplicationCore } from "@/lib/applications/submission";
import { SECTION_ORDER, SECTION_TITLES } from "@/lib/portal/sections";
import { sendEmail } from "@/lib/email/send";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import type { SaveSectionResult } from "@/app/(portal)/apply/actions";
import type { ActionResult } from "@/app/(admin)/applications/[id]/actions";

/**
 * Validates and saves a section's data on the applicant's behalf.
 *
 * Unlike the portal `saveSection` (which resolves the application from the
 * session and ignores the client-supplied id), the staff path takes the
 * applicationId explicitly — `requireApplicationAccess` is the authorisation
 * gate (ADMIN always; ASSESSOR only when assigned).
 */
export async function saveSectionOnBehalf(
  applicationId: string,
  section: ApplicationSectionType,
  data: unknown
): Promise<SaveSectionResult> {
  // Auth: staff only; an ASSESSOR must be assigned to this application.
  // Both helpers redirect on failure, so past this point the caller is allowed.
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, applicationId);

  // Validate with the section's Zod schema — identical to the portal saveSection.
  const schema = sectionSchemaMap[section];
  if (!schema) {
    return { success: false, errors: [`Unknown section: ${section}`] };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    return { success: false, errors };
  }

  try {
    // Resolve the applicant's PRIMARY contributor BEFORE the write transaction:
    // the should-be-impossible self-heal must run under ADMIN context (the
    // contributor write policy is admin-only), which cannot nest inside the
    // staff-context transaction below. Staff RLS can SELECT the row directly.
    const preflight = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: { leadApplicantId: true },
        });
        if (!application) return null;

        const contributorId = await resolveOwningContributorId(
          tx,
          applicationId,
          application.leadApplicantId
        );
        return { leadApplicantId: application.leadApplicantId, contributorId };
      }
    );
    if (!preflight) {
      return { success: false, errors: ["Application not found."] };
    }

    const ownerContributorId =
      preflight.contributorId ??
      (await withAdminContext((tx) =>
        ensurePrimaryContributor(tx, applicationId, preflight.leadApplicantId)
      ));

    const editorName =
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
    const editedAt = new Date().toISOString();

    // Write transaction (staff RLS context). The phase gate is re-checked HERE,
    // inside the transaction, so the layout-level gate cannot be raced.
    const written = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            reference: true,
            formStatus: true,
            closedAt: true,
            assessment: { select: { status: true, outcome: true } },
          },
        });
        if (!application) {
          return { ok: false as const, errors: ["Application not found."] };
        }

        const phase = deriveReviewPhase({
          formStatus: application.formStatus,
          assessmentStatus: application.assessment?.status ?? null,
          outcome: application.assessment?.outcome ?? null,
          closedAt: application.closedAt,
        });
        if (!canEditOnBehalf(phase)) {
          return {
            ok: false as const,
            errors: [
              `This application can no longer be edited on the applicant's behalf (review phase: ${phase}).`,
            ],
          };
        }

        // Diff against the stored payload so ONLY the fields this save changes
        // are stamped with the editing assessor. A no-op save still persists
        // (idempotent) but leaves the existing provenance untouched —
        // mergeProvenance with an empty path list does that naturally.
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
        const changedFields = diffSectionPaths(
          existing?.data ?? {},
          result.data
        );
        const provenance = mergeProvenance(
          existing?.assessorProvenance,
          changedFields,
          { id: user.id, name: editorName, at: editedAt }
        );

        const row = await upsertSection(
          tx,
          applicationId,
          section,
          result.data,
          true,
          ownerContributorId,
          provenance as unknown as Prisma.InputJsonValue
        );

        // Unconditional — terminal-safe for a SUBMITTED form (returns early
        // without writing) and drives the pre-submission CREATED →
        // IN_PROGRESS → FILLED_IN derivation, exactly like the portal save.
        const formStatus = await refreshFormStatus(
          tx,
          applicationId,
          ownerContributorId
        );

        // ── Invalidate the assessment on a material change (D-G6/D3) ──────────
        // Any NON-EMPTY data change to a SUBMITTED application under a LIVE
        // (IN_PROGRESS) or PAUSED assessment is material (materiality v1 =
        // any change), so the assessment is DISCARDED — reset to Not Started —
        // and must be re-run against the corrected form (state-model §4/§6.5/
        // §7.2). The edit stays IN PLACE: the form remains SUBMITTED and the
        // original submission date is retained (we do NOT route through
        // reopenForMaterialChange). A no-op save (empty diff) never invalidates.
        // discardAssessment is itself idempotent and only ever resets
        // IN_PROGRESS/PAUSED → NOT_STARTED; a COMPLETED/decided assessment is
        // unreachable here because the phase gate above already blocked the edit.
        const assessmentStatus = application.assessment?.status ?? null;
        const assessmentDiscarded =
          changedFields.length > 0 &&
          application.formStatus === "SUBMITTED" &&
          (assessmentStatus === "IN_PROGRESS" || assessmentStatus === "PAUSED")
            ? await discardAssessment(tx, applicationId, user.id, {
                reason: `On-behalf edit to ${section} after submission`,
                changedFields,
              })
            : false;

        return {
          ok: true as const,
          sectionRowId: row.id,
          reference: application.reference,
          phase,
          changedFields,
          formStatus,
          assessmentDiscarded,
        };
      }
    );

    if (!written.ok) {
      return { success: false, errors: written.errors };
    }

    // Audit AFTER the write transaction commits (pauseApplication style) so an
    // audit hiccup can never roll back the saved section.
    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.SECTION_SAVED_BY_ASSESSOR,
        entityType: AUDIT_ENTITY_TYPES.ApplicationSection,
        entityId: written.sectionRowId,
        context: `${section} saved on behalf of applicant — Reference: ${written.reference}`,
        metadata: {
          applicationId,
          reference: written.reference,
          section,
          changedFields: written.changedFields,
          formStatus: written.formStatus,
          reviewPhase: written.phase,
          // True when this material change discarded a live/paused assessment
          // (D-G6/D3) — a paired ASSESSMENT_DISCARDED row records the reset.
          assessmentDiscarded: written.assessmentDiscarded,
        },
      })
    );

    // Refresh the admin detail surfaces + every edit page (the edit shell's
    // section nav and section pages all read the data this save just changed).
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/applications/${applicationId}/history`);
    revalidatePath("/queue");
    revalidatePath(`/applications/${applicationId}/edit`, "layout");

    return { success: true };
  } catch (err) {
    console.error("[saveSectionOnBehalf]", err);
    return {
      success: false,
      errors: ["Failed to save your data. Please try again."],
    };
  }
}

// ─── finishEditingOnBehalf ────────────────────────────────────────────────────

/**
 * True when a stored provenance payload records at least one assessor-edited
 * field. Parsed defensively — the JSONB column may be null, a non-object, or
 * hand-edited garbage; anything that is not a plain object reads as "no edits".
 */
function hasProvenanceEntries(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).length > 0;
}

/**
 * Ends an edit-on-behalf pass: derives WHICH sections carry assessor
 * provenance, emails the applicant a summary of them
 * (APPLICATION_EDITED_ON_BEHALF), and audits the pass.
 *
 * A pass that edited nothing returns success WITHOUT email or audit — a staff
 * member opening the edit shell and leaving must not spam the applicant.
 * The email is non-blocking (pauseApplication style): a send failure is logged
 * but never fails the action.
 */
export async function finishEditingOnBehalf(
  applicationId: string
): Promise<ActionResult> {
  // Auth: staff only; an ASSESSOR must be assigned to this application.
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, applicationId);

  try {
    // Resolve the applicant's PRIMARY contributor — same SELECT-then-self-heal
    // pattern as saveSectionOnBehalf (the heal must run under ADMIN context).
    const preflight = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            reference: true,
            childName: true,
            leadApplicantId: true,
            leadApplicant: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        });
        if (!application) return null;

        const contributorId = await resolveOwningContributorId(
          tx,
          applicationId,
          application.leadApplicantId
        );
        return { application, contributorId };
      }
    );
    if (!preflight) {
      return { success: false, error: "Application not found." };
    }

    const { application } = preflight;
    const ownerContributorId =
      preflight.contributorId ??
      (await withAdminContext((tx) =>
        ensurePrimaryContributor(
          tx,
          applicationId,
          application.leadApplicantId
        )
      ));

    // Sections this pass (or any earlier one) assessor-edited, in workbook
    // order, as the human titles the email lists.
    const sectionRows = await withUserContext(
      user.id,
      user.role as RlsRole,
      (tx) =>
        tx.applicationSection.findMany({
          where: { applicationId, ownerContributorId },
          select: { section: true, assessorProvenance: true },
        })
    );
    const editedSet = new Set<ApplicationSectionType>(
      sectionRows
        .filter((row) => hasProvenanceEntries(row.assessorProvenance))
        .map((row) => row.section)
    );
    const editedSections = SECTION_ORDER.filter((s) => editedSet.has(s)).map(
      (s) => SECTION_TITLES[s]
    );

    // Nothing was edited on the applicant's behalf — a no-op pass must not
    // email the applicant or write an audit row.
    if (editedSections.length === 0) {
      return { success: true };
    }

    // Send the summary email — non-blocking; log failure but don't abort.
    const emailResult = await sendEmail(
      application.leadApplicant.email,
      "APPLICATION_EDITED_ON_BEHALF",
      {
        applicant_name:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          "Applicant",
        child_name: application.childName,
        reference: application.reference,
        edited_sections: editedSections
          .map((title) => `• ${title}`)
          .join("\n"),
        edited_date: new Date().toLocaleDateString("en-GB"),
      }
    );

    if (!emailResult.success) {
      console.warn(
        `[finishEditingOnBehalf] APPLICATION_EDITED_ON_BEHALF email failed for ${applicationId}: ${emailResult.error}`
      );
    }

    await withUserContext(user.id, user.role as RlsRole, (tx) =>
      createAuditLog(tx, {
        userId: user.id,
        action: AUDIT_ACTIONS.EDIT_ON_BEHALF_FINISHED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: applicationId,
        context: `Edit-on-behalf pass finished — Reference: ${application.reference}`,
        metadata: {
          reference: application.reference,
          sections: editedSections,
          // A disabled template short-circuits to success+skipped; record the
          // applicant as NOT notified in that case.
          emailSent: emailResult.success && !emailResult.skipped,
          emailSkipped: emailResult.skipped ?? false,
          emailMessageId: emailResult.messageId ?? null,
        },
      })
    );

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/applications/${applicationId}/history`);

    return { success: true };
  } catch (err) {
    console.error("[finishEditingOnBehalf]", err);
    return {
      success: false,
      error: "Failed to finish the editing pass. Please try again.",
    };
  }
}

// ─── submitApplicationOnBehalf ────────────────────────────────────────────────

/**
 * Submits a FILLED_IN application on the applicant's behalf (CR-001 — e.g. a
 * paper form a staff member typed up). Runs the SAME `submitApplicationCore`
 * as the portal submit, with the staff knobs:
 *
 *   - no `expectedLeadApplicantId` — staff are authorised via
 *     `requireApplicationAccess`, not ownership;
 *   - `enforceDeadline: false` — deliberate: a paper application that arrived
 *     in time may be typed up after the portal deadline; the audit trail
 *     records the actor;
 *   - audited as APPLICATION_SUBMITTED_BY_ASSESSOR with the staff actor/role.
 *
 * The applicant receives the normal CONFIRMATION email. Never redirects — the
 * edit shell navigates on success and surfaces the error otherwise.
 */
export async function submitApplicationOnBehalf(
  applicationId: string
): Promise<ActionResult> {
  // Auth: staff only; an ASSESSOR must be assigned to this application.
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, applicationId);

  try {
    // Resolve the applicant's PRIMARY contributor — same SELECT-then-self-heal
    // pattern as saveSectionOnBehalf (the heal must run under ADMIN context).
    const preflight = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            formStatus: true,
            closedAt: true,
            childName: true,
            leadApplicantId: true,
            leadApplicant: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        });
        if (!application) return null;

        const contributorId = await resolveOwningContributorId(
          tx,
          applicationId,
          application.leadApplicantId
        );
        return { application, contributorId };
      }
    );
    if (!preflight) {
      return { success: false, error: "Application not found." };
    }

    const { application } = preflight;
    const ownerContributorId =
      preflight.contributorId ??
      (await withAdminContext((tx) =>
        ensurePrimaryContributor(
          tx,
          applicationId,
          application.leadApplicantId
        )
      ));

    // Gate: only a fully filled-in form can be submitted on behalf. The core
    // re-checks completeness/gaps; this gate gives the staff UI a precise
    // message (and the layout only renders the button when FILLED_IN).
    if (application.formStatus !== "FILLED_IN") {
      return {
        success: false,
        error:
          "The application must be fully filled in before it can be submitted on the applicant's behalf.",
      };
    }

    const result = await submitApplicationCore({
      actor: { id: user.id, role: user.role as RlsRole },
      applicationId,
      ownerContributorId,
      enforceDeadline: false,
      auditAction: AUDIT_ACTIONS.APPLICATION_SUBMITTED_BY_ASSESSOR,
      auditMetadata: { onBehalf: true, submittedByRole: user.role },
      // The LEAD APPLICANT gets the normal CONFIRMATION email — the same
      // recipient/name shape the portal submit sends.
      confirmation: {
        to: application.leadApplicant.email,
        applicantName:
          `${application.leadApplicant.firstName ?? ""} ${application.leadApplicant.lastName ?? ""}`.trim() ||
          application.leadApplicant.email,
      },
    });

    if (result.alreadySubmitted) {
      return {
        success: false,
        error: "This application has already been submitted.",
      };
    }

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/applications/${applicationId}/history`);
    revalidatePath("/queue");
    revalidatePath(`/applications/${applicationId}/edit`, "layout");

    return { success: true };
  } catch (err) {
    // The core throws with applicant-grade messages (incomplete sections,
    // blocking gaps as a JSON-encoded payload, write-once submitted_at) — pass
    // them through so the edit shell can show exactly what blocked the submit.
    console.error("[submitApplicationOnBehalf]", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to submit the application. Please try again.";
    return { success: false, error: message };
  }
}
