/**
 * section-page-data.ts — Shared loader for the section-page data assembly.
 *
 * Loads a section's saved data, the application's document map, and the
 * cross-section reads the individual forms need (child name, sole-parent
 * flag, employment statuses, Parent 1 address). Extracted verbatim from the
 * portal wizard's /apply/[section] page so the assessor edit-on-behalf shell
 * (CR-001) can reuse the exact same assembly. Callers supply their own RLS
 * context (tx) — the portal runs it under withUserContext, the admin shell
 * under withAdminContext.
 */

import type { ApplicationSectionType } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import {
  getSectionData,
  getDocumentsForApplication,
} from "@/lib/db/queries/applications";

/**
 * Cross-section reads per section:
 *   - DEPENDENT_CHILDREN reads CHILD_DETAILS childFullName.
 *   - CHILD_DETAILS reads PARENT_DETAILS parent1Contact (address).
 *   - DECLARATION and ASSETS_LIABILITIES read PARENT_DETAILS isSoleParent +
 *     relationshipStatus (a coupled status expands their Parent 2 blocks).
 *   - PARENTS_INCOME reads PARENT_DETAILS isSoleParent / relationshipStatus /
 *     per-parent employment statuses.
 *   - FAMILY_ID reads DEPENDENT_CHILDREN count + PARENT_DETAILS household to
 *     gate the cross-section identity-list consistency rules.
 */
export async function loadSectionPageData(
  tx: Tx,
  applicationId: string,
  sectionType: ApplicationSectionType,
  ownerContributorId: string
) {
  const [section, docs] = await Promise.all([
    getSectionData(tx, applicationId, sectionType, ownerContributorId),
    getDocumentsForApplication(tx, applicationId),
  ]);

  let childName: string | undefined;
  if (sectionType === "DEPENDENT_CHILDREN") {
    const childSection = await getSectionData(
      tx,
      applicationId,
      "CHILD_DETAILS",
      ownerContributorId
    );
    const childData = childSection?.data as { childFullName?: string } | null;
    childName = childData?.childFullName ?? undefined;
  }

  // CHILD_DETAILS shows the stored Parent 1 address read-only when the child
  // shares it (D1, workbook §3 Q7). Read it from PARENT_DETAILS.
  let parent1Address:
    | {
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
        country?: string;
      }
    | undefined;
  if (sectionType === "CHILD_DETAILS") {
    const parentSection = await getSectionData(
      tx,
      applicationId,
      "PARENT_DETAILS",
      ownerContributorId
    );
    const parentData = parentSection?.data as {
      parent1Contact?: {
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
        country?: string;
      };
    } | null;
    parent1Address = parentData?.parent1Contact;
  }

  let soleParent: boolean | undefined;
  let parent1Status: string | undefined;
  let parent2Status: string | undefined;
  let relationshipStatus: string | undefined;
  let dependentChildrenCount: number | undefined;
  // FAMILY_ID cross-section rules: the declared dependent-children count and the
  // household relationship both gate whether the identity list is consistent.
  if (sectionType === "FAMILY_ID") {
    const [depSection, parentSection] = await Promise.all([
      getSectionData(tx, applicationId, "DEPENDENT_CHILDREN", ownerContributorId),
      getSectionData(tx, applicationId, "PARENT_DETAILS", ownerContributorId),
    ]);
    const depData = depSection?.data as
      | { numberOfDependentChildren?: number; children?: unknown[] }
      | null;
    dependentChildrenCount =
      typeof depData?.numberOfDependentChildren === "number"
        ? depData.numberOfDependentChildren
        : Array.isArray(depData?.children)
          ? depData!.children!.length
          : undefined;
    const parentData = parentSection?.data as {
      isSoleParent?: boolean;
      relationshipStatus?: string;
    } | null;
    soleParent = parentData?.isSoleParent;
    relationshipStatus = parentData?.relationshipStatus;
  }
  // DECLARATION needs isSoleParent to decide whether to show the P2 tick;
  // ASSETS_LIABILITIES needs it to decide whether to show the Parent 2 block.
  if (sectionType === "DECLARATION" || sectionType === "ASSETS_LIABILITIES") {
    const parentSection = await getSectionData(
      tx,
      applicationId,
      "PARENT_DETAILS",
      ownerContributorId
    );
    const parentData = parentSection?.data as {
      isSoleParent?: boolean;
      relationshipStatus?: string;
    } | null;
    soleParent = parentData?.isSoleParent;
    // Relationship status also expands the Parent 2 blocks here (a coupled
    // status implies a two-parent household even if sole-parent = yes).
    relationshipStatus = parentData?.relationshipStatus;
  }
  if (sectionType === "PARENTS_INCOME") {
    const parentSection = await getSectionData(
      tx,
      applicationId,
      "PARENT_DETAILS",
      ownerContributorId
    );
    const parentData = parentSection?.data as {
      isSoleParent?: boolean;
      relationshipStatus?: string;
      parent1Employment?: { status?: string };
      parent2Employment?: { status?: string };
    } | null;
    soleParent = parentData?.isSoleParent;
    relationshipStatus = parentData?.relationshipStatus;
    parent1Status = parentData?.parent1Employment?.status;
    parent2Status = parentData?.parent2Employment?.status;
  }

  return {
    existingSection: section,
    documentMap: docs,
    childFullName: childName,
    isSoleParent: soleParent,
    parent1Status,
    parent2Status,
    relationshipStatus,
    dependentChildrenCount,
    parent1Address,
  };
}

/** Return shape of {@link loadSectionPageData} — what a section page renders from. */
export type SectionPageData = Awaited<ReturnType<typeof loadSectionPageData>>;
