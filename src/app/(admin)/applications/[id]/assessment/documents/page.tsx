/**
 * UPLOADED DOCUMENTS DISPLAY — Epic 14 C3 (CG-16/CG-23, US-C3).
 *
 * The assessment workspace's dedicated documents tab: filter row (text on
 * slot/filename + verified-only), the full document list, and the inline
 * viewer for the selection — everything the old split-screen left panel did,
 * at full width. The split-screen itself is retired at client request
 * (CG-23, D14-2 — supersedes PRD AE-17 / Epic 06's docs-left layout).
 */

import { notFound, redirect } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getApplicationContributors } from "@/lib/db/queries/contributors";
import { buildContributorLabelMap } from "@/lib/contributors/dual-view";
import { getAssessment } from "@/lib/db/queries/assessments";
import { deriveReviewPhase } from "@/lib/applications/status";
import { DocumentListClient } from "@/components/admin/document-list-client";

export const metadata = {
  title: "Assessment — Uploaded Documents",
};

interface Props {
  params: { id: string };
}

export default async function AssessmentDocumentsPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { application, assessment, contributors } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      if (!app) {
        return { application: null, assessment: null, contributors: [] };
      }
      return {
        application: app,
        assessment: await getAssessment(tx, params.id),
        contributors: await getApplicationContributors(tx, params.id),
      };
    }
  );
  if (!application) notFound();

  // Same pre-submission gate as the model tab: no assessment surface exists
  // until the applicant has submitted.
  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: assessment?.status ?? null,
    outcome: assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (reviewPhase === "PRE_SUBMISSION") {
    redirect(`/applications/${params.id}`);
  }

  const primaryContributor = contributors.find((c) => c.role === "PRIMARY");
  const secondaryContributor = contributors.find((c) => c.role === "SECONDARY");
  const contributorGroups = secondaryContributor
    ? {
        labelByContributorId: Object.fromEntries(
          Object.entries(buildContributorLabelMap(contributors)).map(
            ([id, v]) => [id, v.shortLabel]
          )
        ),
        primaryContributorId: primaryContributor?.id ?? null,
      }
    : undefined;

  // CH-60 — the shell reclaims page chrome it was never using. The 260px
  // subtrahend over-counted what actually sits above this container; the
  // measured figure is in the Epic 19 progress board. `dvh` rather than `vh`
  // so a mobile browser's retracting toolbar doesn't leave the panel
  // overflowing. Combined with the pinned filter row and the 30%-capped list
  // inside DocumentListClient, the viewer is taller in every state.
  return (
    <div className="h-[calc(100dvh-200px)] min-h-[560px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <DocumentListClient
        documents={application.documents}
        contributorGroups={contributorGroups}
      />
    </div>
  );
}
