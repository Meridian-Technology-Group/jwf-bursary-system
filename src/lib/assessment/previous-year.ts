/**
 * Epic 21 #3 (CR-002 Phase 4) — links to previous years.
 *
 * Charlotte, 11 Oct 2026: "On GT system, the 'door' to the previous
 * assessments was via the assessment schedule, i.e. the admin page." These
 * helpers decide which year counts as "previous" and where a schedule row
 * links to.
 *
 * "Previous" means an EARLIER academic year than the one being viewed. The old
 * lookups took the latest-submitted application in any other round, so viewing
 * an older year could pick a LATER one as "previous", and a NULL `submittedAt`
 * sorted first under DESC. Years compare on their start year, so "2026/27" and
 * "2026-27" are the same year (rounds and schedule rows spell it differently).
 */

import { parseAcademicYearStart } from "@/lib/assessment/fee-year";

/** True when academic year `a` starts before academic year `b`. */
export function isEarlierAcademicYear(a: string, b: string): boolean {
  const start = parseAcademicYearStart(a);
  const other = parseAcademicYearStart(b);
  if (start == null || other == null) return false;
  return start < other;
}

function millis(value: Date | string | null | undefined): number {
  if (!value) return -Infinity;
  const ms = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * The most recent candidate from an academic year earlier than `current`:
 * the latest earlier year first, then the latest `submittedAt` within it
 * (nulls last). Null when there is no earlier year.
 */
export function pickPreviousYear<
  T extends { academicYear: string; submittedAt?: Date | string | null },
>(candidates: readonly T[], currentAcademicYear: string): T | null {
  const earlier = candidates.filter((c) =>
    isEarlierAcademicYear(c.academicYear, currentAcademicYear)
  );
  if (earlier.length === 0) return null;
  return [...earlier].sort(
    (a, b) =>
      (parseAcademicYearStart(b.academicYear) as number) -
        (parseAcademicYearStart(a.academicYear) as number) ||
      millis(b.submittedAt) - millis(a.submittedAt)
  )[0];
}

export type ScheduleRowLink =
  | { kind: "current" }
  | { kind: "link"; href: string }
  | { kind: "none" };

/**
 * What a schedule row's academic-year cell shows: "This year" for the
 * application being viewed, a link to another year's assessment, or plain
 * text when the year has no application (future years, pre-system years, or
 * one the viewer cannot see under RLS — D-4).
 */
export function scheduleRowLink(
  row: { applicationId: string | null },
  currentApplicationId: string
): ScheduleRowLink {
  if (!row.applicationId) return { kind: "none" };
  if (row.applicationId === currentApplicationId) return { kind: "current" };
  return { kind: "link", href: `/applications/${row.applicationId}/assessment` };
}
