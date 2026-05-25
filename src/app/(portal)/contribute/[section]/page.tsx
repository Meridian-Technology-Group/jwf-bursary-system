/**
 * Restricted secondary-parent section page — /contribute/[section].
 *
 * The second parent fills ONLY three sections, in this order:
 *   /contribute/parent-details      → PARENT_DETAILS   (their own details)
 *   /contribute/parents-income      → PARENTS_INCOME   (their figures)
 *   /contribute/assets-liabilities  → ASSETS_LIABILITIES (theirs)
 * then /contribute/review → submit.
 *
 * They have NO access to the child's sections, the primary's data, or any
 * document that is not their own. The child is shown READ-ONLY, NAME ONLY.
 *
 * The owning contributor (their SECONDARY row) and the application are resolved
 * SERVER-SIDE from the session — never from a client-supplied id (IDOR
 * hardening). All section reads run under the secondary's RLS context, which
 * permits only their own owned rows.
 */

import { notFound, redirect } from "next/navigation";
import { ApplicationSectionType, ApplicationContributorStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  getSectionData,
  getDocumentsForApplication,
} from "@/lib/db/queries/applications";
import { getSecondaryContributorContext } from "@/lib/db/queries/contributors";
import { ContributeSectionClient } from "./contribute-section-client";

// ─── Slug ↔ section maps (secondary only sees these three) ───────────────────

const SLUG_TO_SECTION: Record<string, ApplicationSectionType> = {
  "parent-details": "PARENT_DETAILS",
  "parents-income": "PARENTS_INCOME",
  "assets-liabilities": "ASSETS_LIABILITIES",
};

const SECTION_TO_SLUG: Record<string, string> = {
  PARENT_DETAILS: "parent-details",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
};

const SECTION_ORDER: ApplicationSectionType[] = [
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
];

const SECTION_TITLES: Record<string, string> = {
  PARENT_DETAILS: "Your Details",
  PARENTS_INCOME: "Your Income",
  ASSETS_LIABILITIES: "Your Assets & Liabilities",
};

interface PageProps {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { section } = await params;
  const sectionType = SLUG_TO_SECTION[section];
  if (!sectionType) return { title: "Not Found" };
  return { title: SECTION_TITLES[sectionType] };
}

export default async function ContributeSectionPage({ params }: PageProps) {
  const { section: sectionSlug } = await params;

  const sectionType = SLUG_TO_SECTION[sectionSlug];
  if (!sectionType) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Resolve the application + the secondary's contributor from the session.
  const { ctx, existingSection, documentMap } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const ctx = await getSecondaryContributorContext(tx, user.id);
      if (!ctx) return { ctx: null, existingSection: null, documentMap: {} };

      const [section, docs] = await Promise.all([
        getSectionData(tx, ctx.applicationId, sectionType, ctx.contributorId),
        getDocumentsForApplication(tx, ctx.applicationId),
      ]);
      return { ctx, existingSection: section, documentMap: docs };
    }
  );

  // Not a secondary contributor → send to the portal home (which will route
  // them appropriately).
  if (!ctx) redirect("/");

  // Already submitted → read-only thank-you page.
  if (ctx.status === ApplicationContributorStatus.SUBMITTED) {
    redirect("/contribute/submitted");
  }

  const currentIndex = SECTION_ORDER.indexOf(sectionType);
  const prevSection = currentIndex > 0 ? SECTION_ORDER[currentIndex - 1] : null;
  const nextSection =
    currentIndex < SECTION_ORDER.length - 1
      ? SECTION_ORDER[currentIndex + 1]
      : null;

  const backHref = prevSection
    ? `/contribute/${SECTION_TO_SLUG[prevSection]}`
    : "/contribute";

  // After the final section (ASSETS_LIABILITIES) go to the review page.
  const nextHref = nextSection
    ? `/contribute/${SECTION_TO_SLUG[nextSection]}`
    : "/contribute/review";
  const nextLabel = nextSection ? undefined : "Review & Submit";

  return (
    <ContributeSectionClient
      sectionType={sectionType}
      sectionTitle={SECTION_TITLES[sectionType]}
      applicationId={ctx.applicationId}
      childName={ctx.childName}
      existingData={existingSection?.data ?? null}
      documentMap={documentMap}
      backHref={backHref}
      nextHref={nextHref}
      nextLabel={nextLabel}
      stepNumber={currentIndex + 1}
      totalSteps={SECTION_ORDER.length}
    />
  );
}
