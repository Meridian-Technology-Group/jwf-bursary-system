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
} from "@/lib/applications/status";
import { canEditOnBehalf } from "@/lib/applications/edit-on-behalf";
import {
  diffSectionPaths,
  mergeProvenance,
} from "@/lib/applications/section-diff";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import type { SaveSectionResult } from "@/app/(portal)/apply/actions";

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

        return {
          ok: true as const,
          sectionRowId: row.id,
          reference: application.reference,
          phase,
          changedFields,
          formStatus,
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
