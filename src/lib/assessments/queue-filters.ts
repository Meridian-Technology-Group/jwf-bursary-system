/**
 * Epic 18b — the Assessments-list filter set.
 *
 * Charlotte, 8 Sep 2026, on the September bulk lock: *"In the filters at the
 * top, we will need to be able to filter: by bursary status (active, closed),
 * by round, by assessment status, by school, by submission date. So that when
 * the assessor locks all the roll-over awards, the filters help selecting
 * exactly the list of awards."*
 *
 * The filters exist to make the bulk lock safe to aim, so they are part of that
 * feature rather than cosmetic polish. Kept pure (no DB, no React) so the
 * narrowing rules are unit-tested directly.
 *
 * Assessment status and assignee are NOT here: status is the existing chip row
 * (it carries per-status counts, which a dropdown would lose) and assignee is
 * applied in the query for the ASSESSOR role guard. This module covers the
 * four that narrow an already-fetched list.
 */

import type { School, BursaryAccountStatus } from "@prisma/client";
import type { AssessmentQueueRow } from "@/lib/db/queries/assessments-queue";

export interface AssessmentQueueFilters {
  /** ACTIVE / CLOSED. Rows with no account are excluded when this is set. */
  bursaryStatus?: BursaryAccountStatus;
  /** Round academic year, e.g. "2026/27". */
  academicYear?: string;
  school?: School;
  /** Inclusive lower bound on submittedAt. */
  submittedFrom?: Date;
  /** Inclusive upper bound on submittedAt (callers pass end-of-day). */
  submittedTo?: Date;
}

/**
 * Narrows queue rows by every supplied filter (AND). An absent filter never
 * narrows.
 *
 * Submission-date bounds are inclusive at both ends, so picking the same day in
 * both boxes selects that day. A row with no `submittedAt` is excluded as soon
 * as either bound is set: it cannot be shown to satisfy a date range, and
 * silently keeping it would inflate a list she is about to bulk-lock from.
 */
export function filterAssessmentQueueRows(
  rows: readonly AssessmentQueueRow[],
  filters: AssessmentQueueFilters
): AssessmentQueueRow[] {
  const { bursaryStatus, academicYear, school, submittedFrom, submittedTo } = filters;

  return rows.filter((row) => {
    if (bursaryStatus && row.bursaryStatus !== bursaryStatus) return false;
    if (academicYear && row.academicYear !== academicYear) return false;
    if (school && row.school !== school) return false;

    if (submittedFrom || submittedTo) {
      if (!row.submittedAt) return false;
      const at = row.submittedAt.getTime();
      if (submittedFrom && at < submittedFrom.getTime()) return false;
      if (submittedTo && at > submittedTo.getTime()) return false;
    }

    return true;
  });
}

/** The distinct academic years present in the rows, newest label first. */
export function academicYearOptions(rows: readonly AssessmentQueueRow[]): string[] {
  const years = new Set<string>();
  for (const row of rows) {
    if (row.academicYear) years.add(row.academicYear);
  }
  // Array.from, not spread: tsconfig sets no `target`, so it defaults to ES5
  // and iterating a Set directly is TS2802.
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

/** Parses a yyyy-mm-dd input into a London-day boundary. */
export function parseDateBoundary(
  value: string | undefined,
  edge: "start" | "end"
): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
