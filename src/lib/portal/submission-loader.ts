/**
 * Submitted-application loader — Epic 05 (plan §5.2).
 *
 * Loads a SUBMITTED application's section data + documents + recorded T&Cs
 * acceptance for the read-only summary and the submission PDF, scoped to the
 * lead applicant's PRIMARY contributor (dual-parent: never surface the
 * secondary's owned rows). All reads run under the caller's RLS context.
 *
 * Server-only.
 */

import "server-only";

import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import {
  buildSubmittedSummary,
  type SubmittedSummary,
} from "@/lib/portal/application-summary";

export interface LoadedSubmission {
  id: string;
  reference: string;
  childName: string | null;
  school: string;
  applicationType: "NEW" | "ROLLING_OVER";
  academicYear: string;
  submittedAt: Date | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  /**
   * Consumed-flag for the ONE-TIME submission PDF (Epic 13, D13-4). NULL ⇒ the
   * single download is still available. Read by the PDF route (fast-path 410)
   * and by /submitted, which shows the one-shot offer only while it is NULL.
   */
  submissionPdfDownloadedAt: Date | null;
  summary: SubmittedSummary;
}

interface Caller {
  id: string;
  role: RlsRole;
}

/**
 * Loads a specific submitted application owned by the caller (lead applicant),
 * or null if it does not exist, is not theirs, or is not submitted.
 *
 * Ownership is enforced by `leadApplicantId: caller.id` + RLS.
 */
export async function loadSubmittedApplication(
  caller: Caller,
  applicationId: string
): Promise<LoadedSubmission | null> {
  // Resolve the PRIMARY contributor so section/document reads are scoped to the
  // lead applicant's own data (SELECT under RLS; self-heal under admin only if
  // missing — same pattern as the wizard/review/submit paths).
  let ownerContributorId = await withUserContext(
    caller.id,
    caller.role,
    (tx) => resolveOwningContributorId(tx, applicationId, caller.id)
  );

  const application = await withUserContext(
    caller.id,
    caller.role,
    async (tx) => {
      if (!ownerContributorId) return null;
      return tx.application.findFirst({
        where: {
          id: applicationId,
          leadApplicantId: caller.id,
          formStatus: "SUBMITTED",
        },
        select: {
          id: true,
          reference: true,
          childName: true,
          school: true,
          applicationType: true,
          submittedAt: true,
          termsAcceptedAt: true,
          termsVersion: true,
          submissionPdfDownloadedAt: true,
          entryYear: true,
          entryYearGroup: true,
          round: { select: { academicYear: true } },
          sections: {
            where: { ownerContributorId },
            select: { section: true, data: true },
          },
          documents: {
            where: { uploadedByContributorId: ownerContributorId },
            select: { slot: true, filename: true },
          },
        },
      });
    }
  );

  // Self-heal a missing PRIMARY contributor (legacy row) then retry once.
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, applicationId, caller.id)
    );
    const retried = await withUserContext(caller.id, caller.role, (tx) =>
      tx.application.findFirst({
        where: {
          id: applicationId,
          leadApplicantId: caller.id,
          formStatus: "SUBMITTED",
        },
        select: {
          id: true,
          reference: true,
          childName: true,
          school: true,
          applicationType: true,
          submittedAt: true,
          termsAcceptedAt: true,
          termsVersion: true,
          submissionPdfDownloadedAt: true,
          entryYear: true,
          entryYearGroup: true,
          round: { select: { academicYear: true } },
          sections: {
            where: { ownerContributorId: ownerContributorId! },
            select: { section: true, data: true },
          },
          documents: {
            where: { uploadedByContributorId: ownerContributorId! },
            select: { slot: true, filename: true },
          },
        },
      })
    );
    if (!retried) return null;
    return shape(retried);
  }

  if (!application) return null;
  return shape(application);
}

type RawApplication = {
  id: string;
  reference: string;
  childName: string | null;
  school: string;
  applicationType: "NEW" | "ROLLING_OVER";
  submittedAt: Date | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  submissionPdfDownloadedAt: Date | null;
  entryYear: number | null;
  entryYearGroup: string | null;
  round: { academicYear: string };
  sections: { section: string; data: unknown }[];
  documents: { slot: string; filename: string }[];
};

function shape(app: RawApplication): LoadedSubmission {
  return {
    id: app.id,
    reference: app.reference,
    childName: app.childName,
    school: app.school,
    applicationType: app.applicationType,
    academicYear: app.round.academicYear,
    submittedAt: app.submittedAt,
    termsAcceptedAt: app.termsAcceptedAt,
    termsVersion: app.termsVersion,
    submissionPdfDownloadedAt: app.submissionPdfDownloadedAt,
    summary: buildSubmittedSummary({
      sections: app.sections,
      documents: app.documents,
      entryYear: app.entryYear,
      entryYearGroup: app.entryYearGroup,
    }),
  };
}
