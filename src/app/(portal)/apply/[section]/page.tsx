/**
 * Dynamic section page — renders the correct form based on URL param.
 *
 * Route: /apply/[section]
 * Examples:
 *   /apply/child-details    → CHILD_DETAILS section
 *   /apply/declaration      → DECLARATION section
 *
 * Re-assessment behaviour:
 *   - FAMILY_ID is skipped for re-assessments (redirect to next section)
 *   - Personal sections have pre-populated data from the previous year
 *   - The isReassessment flag is passed to SectionPageClient so it can
 *     display the pre-populated field indicator where appropriate
 */

import { notFound, redirect } from "next/navigation";
import { ApplicationSectionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { getApplicationForUser, getSectionData } from "@/lib/db/queries/applications";
import { SectionPageClient } from "./section-page-client";
import { HIDDEN_REASSESSMENT_SECTIONS, PREPOPULATED_SECTIONS } from "@/lib/db/queries/reassessment";

// ─── Slug → ApplicationSectionType map ───────────────────────────────────────

const SLUG_TO_SECTION: Record<string, ApplicationSectionType> = {
  "child-details": "CHILD_DETAILS",
  "family-id": "FAMILY_ID",
  "parent-details": "PARENT_DETAILS",
  "dependent-children": "DEPENDENT_CHILDREN",
  "dependent-elderly": "DEPENDENT_ELDERLY",
  "other-info": "OTHER_INFO",
  "parents-income": "PARENTS_INCOME",
  "assets-liabilities": "ASSETS_LIABILITIES",
  "additional-info": "ADDITIONAL_INFO",
  declaration: "DECLARATION",
};

const SECTION_TO_SLUG: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "child-details",
  FAMILY_ID: "family-id",
  PARENT_DETAILS: "parent-details",
  DEPENDENT_CHILDREN: "dependent-children",
  DEPENDENT_ELDERLY: "dependent-elderly",
  OTHER_INFO: "other-info",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
  ADDITIONAL_INFO: "additional-info",
  DECLARATION: "declaration",
};

const SECTION_ORDER: ApplicationSectionType[] = [
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

/** Section order with FAMILY_ID removed — used for re-assessments. */
const REASSESSMENT_SECTION_ORDER: ApplicationSectionType[] = SECTION_ORDER.filter(
  (s) => !HIDDEN_REASSESSMENT_SECTIONS.includes(s)
);

const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information Required",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Parents' Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { section } = await params;
  const sectionType = SLUG_TO_SECTION[section];
  if (!sectionType) return { title: "Not Found" };
  return { title: SECTION_TITLES[sectionType] };
}

export default async function SectionPage({ params }: PageProps) {
  const { section: sectionSlug } = await params;

  const sectionType = SLUG_TO_SECTION[sectionSlug];
  if (!sectionType) notFound();

  // Auth guard
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load application
  const application = await getApplicationForUser(user.id);
  if (!application) {
    // No application yet — redirect to portal home
    redirect("/");
  }

  const isReassessment = application.isReassessment;

  // For re-assessments, FAMILY_ID is completely hidden — skip to next section
  if (isReassessment && HIDDEN_REASSESSMENT_SECTIONS.includes(sectionType)) {
    // Find the next visible section
    const sectionOrder = REASSESSMENT_SECTION_ORDER;
    const firstSection = sectionOrder[0];
    redirect(`/apply/${SECTION_TO_SLUG[firstSection]}`);
  }

  // Determine the visible section order based on application type
  const activeSectionOrder = isReassessment
    ? REASSESSMENT_SECTION_ORDER
    : SECTION_ORDER;

  // Load existing section data
  const existingSection = await getSectionData(application.id, sectionType);

  // Determine if this section was pre-populated from the previous year
  const isPrepopulated =
    isReassessment &&
    PREPOPULATED_SECTIONS.includes(sectionType) &&
    existingSection?.isComplete === true;

  // Determine prev/next hrefs using the active section order
  const currentIndex = activeSectionOrder.indexOf(sectionType);
  const prevSection = currentIndex > 0 ? activeSectionOrder[currentIndex - 1] : null;
  const nextSection =
    currentIndex < activeSectionOrder.length - 1
      ? activeSectionOrder[currentIndex + 1]
      : null;

  const backHref = prevSection ? `/apply/${SECTION_TO_SLUG[prevSection]}` : "/";
  const nextHref = nextSection ? `/apply/${SECTION_TO_SLUG[nextSection]}` : "/";

  return (
    <SectionPageClient
      sectionType={sectionType}
      sectionTitle={SECTION_TITLES[sectionType]}
      applicationId={application.id}
      existingData={existingSection?.data ?? null}
      backHref={backHref}
      nextHref={nextHref}
      stepNumber={currentIndex + 1}
      totalSteps={activeSectionOrder.length}
      isReassessment={isReassessment}
      isPrepopulated={isPrepopulated}
    />
  );
}
