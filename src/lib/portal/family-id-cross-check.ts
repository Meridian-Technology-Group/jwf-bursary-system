/**
 * family-id-cross-check — the Family Identification rules that depend on OTHER
 * sections (Dependent Children count, Parent / Guardian household), evaluated
 * from the saved section blobs.
 *
 * The rules themselves live in `familyIdConsistencyIssues` (schemas/family-id).
 * The Family Identification form applies them when that section is saved; this
 * module applies them to what is stored, so a later change elsewhere is caught.
 *
 * Before this module the check ran only at submit. A parent who completed Family
 * Identification and THEN raised the Dependent Children count kept a green tick
 * on Family Identification and a clean Review page, and learnt about the problem
 * only when Submit failed (prod, 13 Nov 2026). Now the sidebar, the Review page,
 * My Application(s) and the submit gate all read the same gaps, via
 * `getSectionGapStatuses`.
 *
 * Pure: no DB, no server-only imports.
 */

import { familyIdConsistencyIssues } from "@/lib/schemas/family-id";
import { isTwoParentHousehold } from "@/lib/schemas/parent-details";
import type { SectionGap } from "@/lib/portal/document-rules";

type SectionData = (section: "FAMILY_ID" | "DEPENDENT_CHILDREN" | "PARENT_DETAILS") => unknown;

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Error-severity gaps for the FAMILY_ID section, one per violated cross-section
 * rule. Empty when Family Identification has no members array (not started, or
 * hidden — rolling-over re-assessments).
 */
export function familyIdCrossSectionGaps(sectionData: SectionData): SectionGap[] {
  const familyId = asObject(sectionData("FAMILY_ID"));
  const members = familyId?.familyMembers;
  if (!Array.isArray(members)) return [];

  const dep = asObject(sectionData("DEPENDENT_CHILDREN"));
  const dependentChildrenCount =
    typeof dep?.numberOfDependentChildren === "number"
      ? dep.numberOfDependentChildren
      : Array.isArray(dep?.children)
        ? dep.children.length
        : undefined;

  const parent = asObject(sectionData("PARENT_DETAILS"));

  return familyIdConsistencyIssues(
    members as { role?: string; memberType?: string }[],
    {
      dependentChildrenCount,
      requiresPartnerAdult: isTwoParentHousehold({
        isSoleParent: parent?.isSoleParent as boolean | undefined,
        relationshipStatus: parent?.relationshipStatus as string | undefined,
      }),
    }
  ).map((issue) => ({
    id: issue.id,
    sectionType: "FAMILY_ID",
    label: issue.message,
    severity: "error",
    fieldRef: "familyMembers",
  }));
}
