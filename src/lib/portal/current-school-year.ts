/**
 * Epic 22 P4 — "Currently in Year X at <school>" (her Home sheet), shared with
 * P5's schedule headings.
 *
 * Anchored the same way as the schedule's "School Year" column
 * (`entryYearGroup + scheduleYear − 1`, schedule-home.ts): the entry year-group
 * is the child's school year in the account's first assessment year, and each
 * academic year after it adds one. The academic year turns on 20 August
 * (`academicYearStartFor`, her NA-current window), not 1 September, so the
 * home page and the schedule never disagree about a child's year.
 *
 * Pure — "today" is passed in.
 */

import type { School } from "@prisma/client";
import { parseAcademicYearStart, formatAcademicYearLabel } from "@/lib/assessment/fee-year";
import { schoolYearForEntryYearGroup } from "@/lib/assessment/schooling-years";
import { academicYearStartFor } from "@/lib/rounds/round-scenario";
import { finalEligibleSchoolYear, schoolName } from "@/lib/schools";

export type CurrentSchoolYear =
  /** At the school now, in this year (capped at the school's final year). */
  | { kind: "current"; year: number }
  /** The award starts in a later academic year: not at the school yet. */
  | { kind: "starting"; year: number; academicYear: string };

export function currentSchoolYear(params: {
  entryYearGroup: string | null | undefined;
  firstAssessmentYear: string | null | undefined;
  school: School | string | null | undefined;
  today: Date;
}): CurrentSchoolYear | null {
  const entryYear = schoolYearForEntryYearGroup(params.entryYearGroup);
  const firstStart = parseAcademicYearStart(params.firstAssessmentYear);
  if (entryYear == null || firstStart == null) return null;

  const elapsed = academicYearStartFor(params.today) - firstStart;
  if (elapsed < 0) {
    return {
      kind: "starting",
      year: entryYear,
      academicYear: formatAcademicYearLabel(firstStart),
    };
  }
  return {
    kind: "current",
    year: Math.min(entryYear + elapsed, finalEligibleSchoolYear(params.school)),
  };
}

/**
 * The line after the child's name: "Currently in Year 8 at Trinity School",
 * "Starting Year 7 at Whitgift School in 2027-28", or just the school when the
 * year can't be worked out (an OTHER entry group).
 */
export function childYearLine(params: {
  entryYearGroup: string | null | undefined;
  firstAssessmentYear: string | null | undefined;
  school: School | string | null | undefined;
  today: Date;
}): string {
  const school = schoolName(params.school) || "school";
  const year = currentSchoolYear(params);
  if (!year) return `At ${school}`;
  return year.kind === "current"
    ? `Currently in Year ${year.year} at ${school}`
    : `Starting Year ${year.year} at ${school} in ${year.academicYear}`;
}
