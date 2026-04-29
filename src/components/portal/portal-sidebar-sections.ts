/**
 * Sidebar section data and helpers — shared between the server layout
 * (which fetches real completion state) and the client `PortalSidebarContent`
 * component that renders the stepper.
 *
 * Kept in a neutral module (no `"use client"` directive) so it can be
 * imported from both sides without Next.js treating it as a client-only
 * export.
 */

import type { SectionGapStatus } from "@/lib/portal/section-gaps";

/**
 * Tri-state section status:
 *   "complete"        — isDbComplete && no error-severity gaps (green tick)
 *   "needs_attention" — started/saved but has ≥1 error-severity gap (amber warning)
 *   "not_started"     — never saved (default indicator)
 */
export type SectionStatus = "not_started" | "needs_attention" | "complete";

export interface SidebarSection {
  id: number;
  label: string;
  slug: string;
  status: SectionStatus;
  /** Number of error-severity gaps — used for the tooltip when status === "needs_attention". */
  gapCount: number;
  /** Numerator for the partial-fill progress bar. */
  progressSatisfied: number;
  /** Denominator for the partial-fill progress bar. */
  progressTotal: number;
}

// ─── Ordered list of sections, matching the 10 form steps ─────────────────────

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 1, label: "Details of Child", slug: "child-details", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 2, label: "Family Identification", slug: "family-id", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 3, label: "Parent / Guardian Details", slug: "parent-details", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 4, label: "Dependent Children", slug: "dependent-children", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 5, label: "Dependent Elderly", slug: "dependent-elderly", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 6, label: "Other Information", slug: "other-info", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 7, label: "Parents' Income", slug: "parents-income", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 8, label: "Assets & Liabilities", slug: "assets-liabilities", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 9, label: "Additional Information", slug: "additional-info", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 10, label: "Declaration & Submit", slug: "declaration", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
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
 * Builds the sidebar section list from the full gap-status data returned by
 * `getSectionGapStatuses`. Surfaces tri-state status and partial progress
 * numerator/denominator per section.
 *
 * Status rules:
 *   "complete"        → isFullyValid (isDbComplete && no error gaps)
 *   "needs_attention" → (isStarted || isDbComplete) && ≥1 error-severity gap
 *   "not_started"     → everything else
 */
export function buildSidebarSections(
  gapStatuses: SectionGapStatus[]
): SidebarSection[] {
  // Build a lookup by slug so we can enrich the ordered DEFAULT list.
  const bySlug = new Map<
    string,
    { status: SectionStatus; gapCount: number; progressSatisfied: number; progressTotal: number }
  >();

  for (const gs of gapStatuses) {
    const slug = SECTION_TYPE_TO_SLUG[gs.sectionType];
    if (!slug) continue;

    const errorGapCount = gs.gaps.filter((g) => g.severity === "error").length;

    let status: SectionStatus;
    if (gs.isFullyValid) {
      status = "complete";
    } else if ((gs.isStarted || gs.isDbComplete) && errorGapCount > 0) {
      status = "needs_attention";
    } else {
      status = "not_started";
    }

    bySlug.set(slug, {
      status,
      gapCount: errorGapCount,
      progressSatisfied: gs.progress.satisfied,
      progressTotal: gs.progress.total,
    });
  }

  return DEFAULT_SIDEBAR_SECTIONS.map((section) => {
    const enriched = bySlug.get(section.slug);
    if (!enriched) return section;
    return {
      ...section,
      status: enriched.status,
      gapCount: enriched.gapCount,
      progressSatisfied: enriched.progressSatisfied,
      progressTotal: enriched.progressTotal,
    };
  });
}
