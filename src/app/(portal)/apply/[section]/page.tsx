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
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationForUser } from "@/lib/db/queries/applications";
import { loadSectionPageData } from "@/lib/portal/section-page-data";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import { SectionPageClient } from "./section-page-client";
import {
  HIDDEN_REASSESSMENT_SECTIONS,
  PREPOPULATED_SECTIONS,
  isRollingOverApplication,
} from "@/lib/db/queries/reassessment";
import { isSubmissionDeadlinePassed } from "@/lib/rounds/submission-deadline";
import {
  SECTION_ORDER,
  SECTION_TO_SLUG,
  SLUG_TO_SECTION,
  SECTION_TITLES as CANONICAL_SECTION_TITLES,
} from "@/lib/portal/sections";

// ─── Section metadata ─────────────────────────────────────────────────────────
// Order / slug maps come from the canonical `@/lib/portal/sections` (single
// source of truth). The hidden-set for re-assessments still derives from
// `HIDDEN_REASSESSMENT_SECTIONS` (the reassessment module remains its single
// source) so this file does not introduce a second hidden-set.

/** Section order with FAMILY_ID removed — used for re-assessments. */
const REASSESSMENT_SECTION_ORDER: ApplicationSectionType[] = SECTION_ORDER.filter(
  (s) => !HIDDEN_REASSESSMENT_SECTIONS.includes(s)
);

// Wizard page-header titles. Now identical to the canonical (review) titles —
// FAMILY_ID renders as "Family Identification" in both places (product
// reconciled the earlier "Details of Child — Identification" divergence).
const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  ...CANONICAL_SECTION_TITLES,
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
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getApplicationForUser(tx, user.id)
  );
  if (!application) {
    // No application yet — redirect to portal home
    redirect("/");
  }

  // Once submitted, the form is read-only. Server-side enforcement —
  // the action layer also blocks writes via withUserContext + status checks,
  // but redirecting here prevents the form from rendering at all.
  if (application.formStatus === "SUBMITTED") {
    redirect("/submitted");
  }

  // Deadline-missed lockout (Epic 05 §3.2). Past the per-application deadline an
  // unsubmitted draft is read-only — bounce to /status, which shows the clear
  // "submission deadline passed" banner. The submit action also rejects late
  // posts server-side, so a stale tab cannot bypass this.
  const deadlineRound = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.round.findUnique({
        where: { id: application.roundId },
        select: { closeDate: true, defaultSubmissionDeadline: true },
      })
  );
  if (
    deadlineRound &&
    isSubmissionDeadlinePassed(
      { submissionDeadlineAt: application.submissionDeadlineAt },
      deadlineRound
    )
  ) {
    redirect("/status");
  }

  const isReassessment = application.isReassessment;
  // ID-section visibility is keyed on Epic 01's explicit applicationType (D-PR4):
  // NEW shows FAMILY_ID; ROLLING_OVER hides it. Falls back to isReassessment for
  // any pre-backfill row.
  const isRollingOver = isRollingOverApplication(application);

  // For a rolling-over application, FAMILY_ID is completely hidden — skip to next
  // section (identity documents are already on file from the first application).
  if (isRollingOver && HIDDEN_REASSESSMENT_SECTIONS.includes(sectionType)) {
    // Find the next visible section
    const sectionOrder = REASSESSMENT_SECTION_ORDER;
    const firstSection = sectionOrder[0];
    redirect(`/apply/${SECTION_TO_SLUG[firstSection]}`);
  }

  // Determine the visible section order based on application type
  const activeSectionOrder = isRollingOver
    ? REASSESSMENT_SECTION_ORDER
    : SECTION_ORDER;

  // Resolve the lead applicant's PRIMARY contributor with a SELECT (created at
  // application creation). Never upsert under the applicant's RLS context — the
  // contributor write policy is admin-only (would throw P2025). Self-heal under
  // admin context only for the should-be-impossible missing case.
  let ownerContributorId = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => resolveOwningContributorId(tx, application.id, user.id)
  );
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, application.id, user.id)
    );
  }

  // Load existing section data, documents, and any cross-section reads needed.
  // All section reads are scoped to the lead applicant's PRIMARY contributor
  // (dual-parent foundation, PR 4a) — identical to before for a single parent.
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
    loadSectionPageData(tx, application.id, sectionType, ownerContributorId)
  );

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

  // Declaration's back button returns to the Review page (not additional-info),
  // since the wizard flow is: additional-info → review → declaration.
  const backHref =
    sectionType === "DECLARATION"
      ? "/apply/review"
      : prevSection
        ? `/apply/${SECTION_TO_SLUG[prevSection]}`
        : "/";

  // Wizard wiring:
  //   ADDITIONAL_INFO (step 9) → /apply/review
  //   DECLARATION (step 10)   → /apply/review  (back button returns to review)
  //   All other sections      → next section slug as usual
  const nextHref =
    sectionType === "ADDITIONAL_INFO"
      ? "/apply/review"
      : nextSection
        ? `/apply/${SECTION_TO_SLUG[nextSection]}`
        : "/";

  const nextLabel =
    sectionType === "ADDITIONAL_INFO"
      ? "Review Application"
      : sectionType === "DECLARATION"
        ? "Submit Application"
        : undefined;

  return (
    <SectionPageClient
      sectionType={sectionType}
      sectionTitle={SECTION_TITLES[sectionType]}
      applicationId={application.id}
      existingData={existingSection?.data ?? null}
      applicationSchool={application.school}
      lockedSchool={application.school}
      applicationChildName={application.childName}
      applicationGuardianName={[user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")}
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
    />
  );
}
