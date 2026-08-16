/**
 * APPLICATION FORM — Epic 14 C3 (CG-16/CG-15, US-C4, PRD AE-01).
 *
 * The assessment workspace's read-only view of everything the family
 * submitted, child details → declaration, rendered with the SAME section
 * cards as the Applicant Data tab (extracted to
 * `application-section-cards.tsx` so the two can't drift). This is where the
 * assessor cross-references declared values while the ASSESSMENT MODEL tab
 * holds only their own entries (CG-15/D14-3).
 *
 * Per section, the TITLES of its uploaded documents are listed — no viewer
 * here; the link jumps to the UPLOADED DOCUMENTS DISPLAY tab.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getApplicationContributors } from "@/lib/db/queries/contributors";
import {
  contributorRoleLabel,
  isParentOwnedSection,
} from "@/lib/contributors/dual-view";
import { getAssessment } from "@/lib/db/queries/assessments";
import { deriveReviewPhase } from "@/lib/applications/status";
import {
  SECTION_DISPLAY_ORDER,
  SectionDataCard,
} from "@/components/admin/application-section-cards";
import { groupDocumentsBySection } from "@/lib/documents/section-grouping";
import { humaniseSlot } from "@/lib/documents/slots";

export const metadata = {
  title: "Assessment — Application Form",
};

interface Props {
  params: { id: string };
}

function SectionDocumentTitles({
  applicationId,
  docs,
  heading = "Documents uploaded for this section",
}: {
  applicationId: string;
  docs: { id: string; slot: string; filename: string }[];
  heading?: string;
}) {
  if (docs.length === 0) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {heading}
      </p>
      <ul className="mt-2 space-y-1">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="font-medium">{humaniseSlot(d.slot)}</span>
            <span className="truncate text-slate-400">· {d.filename}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/applications/${applicationId}/assessment/documents`}
        className="mt-2 inline-block text-xs font-medium text-accent-700 underline underline-offset-2 hover:text-accent-600"
      >
        Open in Uploaded Documents
      </Link>
    </div>
  );
}

export default async function AssessmentApplicationFormPage({ params }: Props) {
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

  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: assessment?.status ?? null,
    outcome: assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (reviewPhase === "PRE_SUBMISSION") {
    redirect(`/applications/${params.id}`);
  }

  const { sections, documents } = application;

  // Dual-parent labelling mirrors the Applicant Data tab.
  const primaryContributorId = contributors.find(
    (c) => c.role === "PRIMARY"
  )?.id;
  const hasSecondary = contributors.some((c) => c.role === "SECONDARY");
  const ownerLabelById = new Map(
    contributors.map((c) => [c.id, contributorRoleLabel(c.role)])
  );

  // Workbook order (child details → declaration); primary's copy before the
  // secondary's within a section.
  const orderedSections = [...sections].sort((a, b) => {
    const orderA = SECTION_DISPLAY_ORDER.indexOf(a.section);
    const orderB = SECTION_DISPLAY_ORDER.indexOf(b.section);
    if (orderA !== orderB) return orderA - orderB;
    const aPrimary = a.ownerContributorId === primaryContributorId ? 0 : 1;
    const bPrimary = b.ownerContributorId === primaryContributorId ? 0 : 1;
    return aPrimary - bPrimary;
  });

  const { bySection, other } = groupDocumentsBySection(documents);
  // Per-section doc lists render once per section TYPE — attach to the
  // primary's copy so a dual-parent application doesn't list them twice.
  const docListRendered = new Set<string>();

  if (orderedSections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-400">
          No application sections have been submitted yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orderedSections.map((section) => {
        const ownerLabel =
          hasSecondary && isParentOwnedSection(section.section)
            ? ownerLabelById.get(section.ownerContributorId) ?? null
            : null;

        const showDocs = !docListRendered.has(section.section);
        if (showDocs) docListRendered.add(section.section);
        const sectionDocs = showDocs
          ? bySection.get(section.section) ?? []
          : [];

        return (
          <SectionDataCard
            key={section.id}
            section={section.section}
            data={section.data as Record<string, unknown> | null}
            isComplete={section.isComplete}
            assessorProvenance={section.assessorProvenance}
            ownerLabel={ownerLabel}
            footer={
              <SectionDocumentTitles
                applicationId={params.id}
                docs={sectionDocs}
              />
            }
          />
        );
      })}

      {other.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionDocumentTitles
            applicationId={params.id}
            docs={other}
            heading="Other documents"
          />
        </div>
      )}
    </div>
  );
}
