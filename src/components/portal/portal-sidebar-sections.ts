/**
 * Sidebar section data and helpers — shared between the server layout
 * (which fetches real completion state) and the client `PortalSidebarContent`
 * component that renders the stepper.
 *
 * Kept in a neutral module (no `"use client"` directive) so it can be
 * imported from both sides without Next.js treating it as a client-only
 * export.
 */

export type SectionStatus = "not_started" | "in_progress" | "complete";

export interface SidebarSection {
  id: number;
  label: string;
  slug: string;
  status: SectionStatus;
}

// ─── Ordered list of sections, matching the 10 form steps ─────────────────────

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 1, label: "Details of Child", slug: "child-details", status: "not_started" },
  { id: 2, label: "Family Identification", slug: "family-id", status: "not_started" },
  { id: 3, label: "Parent / Guardian Details", slug: "parent-details", status: "not_started" },
  { id: 4, label: "Dependent Children", slug: "dependent-children", status: "not_started" },
  { id: 5, label: "Dependent Elderly", slug: "dependent-elderly", status: "not_started" },
  { id: 6, label: "Other Information", slug: "other-info", status: "not_started" },
  { id: 7, label: "Parents' Income", slug: "parents-income", status: "not_started" },
  { id: 8, label: "Assets & Liabilities", slug: "assets-liabilities", status: "not_started" },
  { id: 9, label: "Additional Information", slug: "additional-info", status: "not_started" },
  { id: 10, label: "Declaration & Submit", slug: "declaration", status: "not_started" },
];

const SECTION_TYPE_TO_SLUG: Record<string, string> = {
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

/**
 * Builds the sidebar section list from real section-completion rows so the
 * stepper and progress bar reflect actual applicant progress.
 */
export function buildSidebarSections(
  statuses: Array<{ section: string; isComplete: boolean }>
): SidebarSection[] {
  const completeSlugs = new Set(
    statuses
      .filter((s) => s.isComplete)
      .map((s) => SECTION_TYPE_TO_SLUG[s.section])
      .filter(Boolean)
  );
  return DEFAULT_SIDEBAR_SECTIONS.map((section) =>
    completeSlugs.has(section.slug)
      ? { ...section, status: "complete" }
      : section
  );
}
