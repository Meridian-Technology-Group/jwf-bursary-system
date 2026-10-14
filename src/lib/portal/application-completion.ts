/**
 * Epic 22 D-4 — ONE "% complete" for an application, wherever it is shown.
 *
 * The measure is the wizard rail's item-level one: across the counted
 * sections, Σ satisfied items ÷ Σ items (a saved form counts as one item, each
 * applicable document/structure rule as another — see `getSectionGapStatuses`).
 * The rail, My Bursary Application(s) and (later) the home page and schedule
 * all read this function, so the number never disagrees between pages.
 *
 * Pure — no DB, no clock.
 */

import type { SectionGapStatus } from "@/lib/portal/section-gaps";
import {
  buildSidebarSections,
  type SidebarSection,
} from "@/components/portal/portal-sidebar-sections";

type CountedSection = Pick<
  SidebarSection,
  "progressSatisfied" | "progressTotal" | "isSynthetic"
>;

/**
 * Percentage complete, to one decimal place (e.g. 62.5), capped at 100.
 * Synthetic steps (the Review entry) are left out unless `countSynthetic`.
 */
export function applicationCompletion(
  sections: readonly CountedSection[],
  countSynthetic = false
): number {
  const counted = countSynthetic
    ? sections
    : sections.filter((s) => !s.isSynthetic);
  const satisfied = counted.reduce((acc, s) => acc + s.progressSatisfied, 0);
  const total = counted.reduce((acc, s) => acc + s.progressTotal, 0);
  if (total <= 0) return 0;
  return Math.min(100, parseFloat(((satisfied / total) * 100).toFixed(1)));
}

/**
 * The same figure straight from gap statuses, with the rail's section set (no
 * Family Identification on a rolling-over application).
 */
export function applicationCompletionFromGaps(
  gapStatuses: readonly SectionGapStatus[],
  isReassessment: boolean
): number {
  return applicationCompletion(
    buildSidebarSections([...gapStatuses], { isReassessment })
  );
}

/** "62.5%" / "100%" — the label every page prints. */
export function formatCompletion(percent: number): string {
  return `${percent}%`;
}
