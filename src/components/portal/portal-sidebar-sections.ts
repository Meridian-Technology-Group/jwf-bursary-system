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
  /**
   * When true this entry is a synthetic (non-section) step and does not
   * correspond to an ApplicationSectionType.  Used for the Review step.
   */
  isSynthetic?: boolean;
}

// ─── Ordered list of sections, matching the 10 form steps ─────────────────────
// The Review entry sits between Additional Information (9) and Declaration (10).
// It is synthetic — it has no ApplicationSectionType — so its status is derived
// from the overall gap roll-up in buildSidebarSections() rather than from any
// individual SectionGapStatus row.

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
  // Synthetic Review step — always navigable; status derived from global gap roll-up.
  { id: 10, label: "Review", slug: "review", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1, isSynthetic: true },
  { id: 11, label: "Declaration & Submit", slug: "declaration", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
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

// ─── Secondary-parent /contribute stepper ────────────────────────────────────
// The second parent fills ONLY their own three sections (PR 4b, backlog #20).
// This trimmed list backs the dedicated /contribute layout sidebar so a second
// parent never sees the full 11-section applicant nav. Labels match the
// /contribute section page titles ("Your …"). The Review entry is synthetic —
// navigable but excluded from the "N of 3 sections complete" count (see
// `countSynthetic` in PortalSidebarContent).

export const CONTRIBUTE_SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 1, label: "Your Details", slug: "parent-details", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 2, label: "Your Income", slug: "parents-income", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  { id: 3, label: "Your Assets & Liabilities", slug: "assets-liabilities", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 1 },
  // Synthetic Review step — navigable; status from the global gap roll-up.
  // progressTotal: 0 so it never skews the partial-fill progress bar.
  { id: 4, label: "Review", slug: "review", status: "not_started", gapCount: 0, progressSatisfied: 0, progressTotal: 0, isSynthetic: true },
];

const CONTRIBUTE_SECTION_TYPES = new Set([
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
]);

/**
 * Builds the sidebar section list from the full gap-status data returned by
 * `getSectionGapStatuses`. Surfaces tri-state status and partial progress
 * numerator/denominator per section.
 *
 * Status rules (per real section):
 *   "complete"        → isFullyValid (isDbComplete && no error gaps)
 *   "needs_attention" → (isStarted || isDbComplete) && ≥1 error-severity gap
 *   "not_started"     → everything else
 *
 * Status rule (synthetic Review entry):
 *   "complete"        → zero error-severity gaps across ALL sections
 *   "needs_attention" → ≥1 error-severity gap exists anywhere
 *   "not_started"     → no sections have been started yet (progress = 0)
 */
export function buildSidebarSections(
  gapStatuses: SectionGapStatus[],
  options?: { isReassessment?: boolean }
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

  // Derive synthetic Review status from global error-gap roll-up.
  const totalErrorGaps = gapStatuses.reduce(
    (acc, gs) => acc + gs.gaps.filter((g) => g.severity === "error").length,
    0
  );
  const anyStarted = gapStatuses.some((gs) => gs.isStarted);
  const reviewStatus: SectionStatus = !anyStarted
    ? "not_started"
    : totalErrorGaps === 0
      ? "complete"
      : "needs_attention";

  // Re-assessments skip Family Identification entirely — drop it from the
  // stepper so the "N of M sections complete" count is correct.
  const baseSections = options?.isReassessment
    ? DEFAULT_SIDEBAR_SECTIONS.filter((s) => s.slug !== "family-id")
    : DEFAULT_SIDEBAR_SECTIONS;

  return baseSections.map((section) => {
    // Synthetic Review entry: derive status from global gap roll-up.
    if (section.isSynthetic && section.slug === "review") {
      return {
        ...section,
        status: reviewStatus,
        gapCount: totalErrorGaps,
      };
    }

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

/**
 * Builds the trimmed secondary-parent /contribute stepper from owner-scoped gap
 * statuses (i.e. `getSectionGapStatuses(applicationId, contributorId)` — only
 * the second parent's owned sections + own documents).
 *
 * Surfaces tri-state status / partial progress for the three contribution
 * sections, plus a synthetic Review entry whose status rolls up the three.
 * Status rules mirror `buildSidebarSections`.
 */
export function buildContributeSidebarSections(
  gapStatuses: SectionGapStatus[]
): SidebarSection[] {
  const relevant = gapStatuses.filter((gs) =>
    CONTRIBUTE_SECTION_TYPES.has(gs.sectionType)
  );

  const bySlug = new Map<
    string,
    { status: SectionStatus; gapCount: number; progressSatisfied: number; progressTotal: number }
  >();

  for (const gs of relevant) {
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

  // Synthetic Review status from the global error-gap roll-up across the three.
  const totalErrorGaps = relevant.reduce(
    (acc, gs) => acc + gs.gaps.filter((g) => g.severity === "error").length,
    0
  );
  const anyStarted = relevant.some((gs) => gs.isStarted);
  const reviewStatus: SectionStatus = !anyStarted
    ? "not_started"
    : totalErrorGaps === 0
      ? "complete"
      : "needs_attention";

  return CONTRIBUTE_SIDEBAR_SECTIONS.map((section) => {
    if (section.isSynthetic && section.slug === "review") {
      return { ...section, status: reviewStatus, gapCount: totalErrorGaps };
    }

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
