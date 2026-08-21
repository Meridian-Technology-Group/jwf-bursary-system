/**
 * Edit-on-behalf section page (CR-001) — /applications/[id]/edit/[section]
 *
 * The staff mirror of the portal wizard's /apply/[section] page: it renders
 * the SAME SectionPageClient with the same prop assembly, but
 *   - loads everything under the staff RLS context (ADMIN / assigned ASSESSOR),
 *   - writes sections against the applicant's PRIMARY contributor,
 *   - swaps the save action for the role-guarded, provenance-stamping,
 *     audited `saveSectionOnBehalf` (saveOverride + onBehalf),
 *   - navigates within /applications/[id]/edit/* — there is no review step, so
 *     the wizard's ADDITIONAL_INFO → review detour collapses to plain
 *     next-section and the LAST section returns to the application detail.
 */

import { notFound, redirect } from "next/navigation";
import { ApplicationSectionType } from "@prisma/client";
import { requireRole, requireApplicationAccess, Role } from "@/lib/auth/roles";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
} from "@/lib/db/prisma";
import { loadSectionPageData } from "@/lib/portal/section-page-data";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import { deriveReviewPhase } from "@/lib/applications/status";
import { canEditOnBehalf } from "@/lib/applications/edit-on-behalf";
import {
  HIDDEN_REASSESSMENT_SECTIONS,
  PREPOPULATED_SECTIONS,
  isRollingOverApplication,
} from "@/lib/db/queries/reassessment";
import {
  SECTION_ORDER,
  REASSESSMENT_SECTION_ORDER,
  SECTION_TO_SLUG,
  SLUG_TO_SECTION,
  SECTION_TITLES as CANONICAL_SECTION_TITLES,
} from "@/lib/portal/sections";
import { SectionPageClient } from "@/app/(portal)/apply/[section]/section-page-client";
import { saveSectionOnBehalf } from "../actions";

// Page-header titles — same one-key FAMILY_ID override the portal wizard uses
// (see apply/[section]/page.tsx; the copy divergence is a PR-5 product note).
const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  ...CANONICAL_SECTION_TITLES,
  FAMILY_ID: "Details of Child — Identification",
};

interface PageProps {
  params: { id: string; section: string };
}

export async function generateMetadata({ params }: PageProps) {
  const sectionType = SLUG_TO_SECTION[params.section];
  if (!sectionType) return { title: "Not Found" };
  return { title: `Edit — ${SECTION_TITLES[sectionType]}` };
}

export default async function EditSectionPage({ params }: PageProps) {
  const sectionType = SLUG_TO_SECTION[params.section];
  if (!sectionType) notFound();

  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, params.id);

  // Load the application under the staff RLS context — everything
  // SectionPageClient's props need, plus the lifecycle fields for the gate.
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          school: true,
          childName: true,
          formStatus: true,
          closedAt: true,
          isReassessment: true,
          applicationType: true,
          leadApplicantId: true,
          round: { select: { academicYear: true } },
          assessment: { select: { status: true, outcome: true } },
        },
      })
  );
  if (!application) {
    notFound();
  }

  // Phase gate — defence-in-depth alongside the edit layout (and the save
  // action re-checks it inside its write transaction).
  const phase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (!canEditOnBehalf(phase)) {
    redirect(`/applications/${params.id}`);
  }

  const isReassessment = application.isReassessment;
  const isRollingOver = isRollingOverApplication(application);
  const activeSectionOrder = isRollingOver
    ? REASSESSMENT_SECTION_ORDER
    : SECTION_ORDER;

  const editHref = (section: ApplicationSectionType) =>
    `/applications/${params.id}/edit/${SECTION_TO_SLUG[section]}`;

  // For a rolling-over application FAMILY_ID is completely hidden — bounce to
  // the first visible section, exactly like the portal wizard.
  if (isRollingOver && HIDDEN_REASSESSMENT_SECTIONS.includes(sectionType)) {
    redirect(editHref(activeSectionOrder[0]));
  }

  // Resolve the applicant's PRIMARY contributor with a SELECT (staff RLS can
  // read it); self-heal under admin context only for the should-be-impossible
  // missing case — mirrors the portal page.
  let ownerContributorId = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      resolveOwningContributorId(tx, params.id, application.leadApplicantId)
  );
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, params.id, application.leadApplicantId)
    );
  }
  const primaryContributorId = ownerContributorId;

  // Same shared assembly the portal wizard uses — section data, document map,
  // and the cross-section reads each form needs.
  const {
    existingSection,
    documentMap,
    childFullName,
    isSoleParent,
    parent1Status,
    parent2Status,
    relationshipStatus,
    dependentChildrenCount,
    parent1Address,
  } = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    loadSectionPageData(tx, params.id, sectionType, primaryContributorId)
  );

  // Pre-populated banner — identical rule to the portal page.
  const isPrepopulated =
    isReassessment &&
    PREPOPULATED_SECTIONS.includes(sectionType) &&
    existingSection?.isComplete === true;

  // Back/next within the ACTIVE order, pointing at the edit shell. The first
  // section's Back and the last section's save both return to the detail page.
  const currentIndex = activeSectionOrder.indexOf(sectionType);
  const prevSection =
    currentIndex > 0 ? activeSectionOrder[currentIndex - 1] : null;
  const nextSection =
    currentIndex < activeSectionOrder.length - 1
      ? activeSectionOrder[currentIndex + 1]
      : null;

  const backHref = prevSection
    ? editHref(prevSection)
    : `/applications/${params.id}`;
  const nextHref = nextSection
    ? editHref(nextSection)
    : `/applications/${params.id}`;
  const nextLabel = nextSection ? undefined : "Save and Finish";

  return (
    <SectionPageClient
      sectionType={sectionType}
      sectionTitle={SECTION_TITLES[sectionType]}
      applicationId={application.id}
      existingData={existingSection?.data ?? null}
      applicationSchool={application.school}
      lockedSchool={application.school}
      applicationChildName={application.childName}
      academicYear={application.round?.academicYear ?? null}
      documentMap={documentMap}
      childFullName={childFullName}
      parent1Address={parent1Address}
      isSoleParent={isSoleParent}
      parent1EmploymentStatus={parent1Status}
      parent2EmploymentStatus={parent2Status}
      relationshipStatus={relationshipStatus}
      dependentChildrenCount={dependentChildrenCount}
      nextLabel={nextLabel}
      backHref={backHref}
      nextHref={nextHref}
      stepNumber={currentIndex + 1}
      totalSteps={activeSectionOrder.length}
      isReassessment={isReassessment}
      isPrepopulated={isPrepopulated}
      saveOverride={saveSectionOnBehalf}
      onBehalf
    />
  );
}
