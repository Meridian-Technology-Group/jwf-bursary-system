/**
 * Sidebar section data and helpers — shared between the server layout
 * (which fetches real completion state) and the client `PortalSidebarContent`
 * component that renders the stepper.
 *
 * Kept in a neutral module (no `"use client"` directive) so it can be
 * imported from both sides without Next.js treating it as a client-only
 * export.
 */

import type { ApplicationSectionType } from "@prisma/client";
import type { SectionGapStatus } from "@/lib/portal/section-gaps";
import { SECTION_ORDER, SECTION_TO_SLUG } from "@/lib/portal/sections";

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
// The Review entry sits between Additional Information (9) and Declaration (11).
// It is synthetic — it has no ApplicationSectionType — so its status is derived
// from the overall gap roll-up in buildSidebarSections() rather than from any
// individual SectionGapStatus row.
//
// The ORDER is derived from the canonical `SECTION_ORDER` (single source of
// truth) so it can never drift from the wizard / review / gap engine. Only the
// stepper-specific LABELS and the synthetic Review entry live here.

// Reuse the canonical section → slug map. The sidebar historically typed this
// as Record<string, string>; ApplicationSectionType keys satisfy that.
const SECTION_TYPE_TO_SLUG: Record<string, string> = SECTION_TO_SLUG;

/**
 * Stepper-specific labels per section. These differ from the page-header /
 * review titles (`SECTION_TITLES`) — e.g. "Assets & Liabilities" here vs
 * "Parents' Assets & Liabilities" on the review page — so they are NOT sourced
 * from the canonical title map; only the ordering is shared.
 */
const SIDEBAR_SECTION_LABELS: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration & Submit",
};

// Build the ordered stepper list from the canonical SECTION_ORDER, splicing the
// synthetic Review step in immediately before DECLARATION (its historical slot,
// between Additional Information and Declaration). Ids stay 1-based and
// contiguous so existing styling/keys are byte-for-byte unchanged.
export const DEFAULT_SIDEBAR_SECTIONS: SidebarSection[] = (() => {
  const sections: SidebarSection[] = [];
  let id = 1;
  for (const sectionType of SECTION_ORDER) {
    if (sectionType === "DECLARATION") {
      // Synthetic Review step — always navigable; status derived from global gap roll-up.
      sections.push({
        id: id++,
        label: "Review",
        slug: "review",
        status: "not_started",
        gapCount: 0,
        progressSatisfied: 0,
        progressTotal: 1,
        isSynthetic: true,
      });
    }
    sections.push({
      id: id++,
      label: SIDEBAR_SECTION_LABELS[sectionType],
      slug: SECTION_TO_SLUG[sectionType],
      status: "not_started",
      gapCount: 0,
      progressSatisfied: 0,
      progressTotal: 1,
    });
  }
  return sections;
})();

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
