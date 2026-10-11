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
import { compareReferences } from "@/lib/applications/reference-sort";

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
  /** Free-text search (see `matchesAssessmentSearch`). */
  search?: string;
}

/**
 * Charlotte, 10 Oct 2026: *"Can I have a search button at the top of the
 * assessments and the applications pages? I have just realised that I cannot
 * search for a specific file."*
 *
 * The same fields the Applications search box matches (reference, lead
 * applicant's name and email — `matchesQueueFilters`), plus the child's name,
 * which this list shows as a column. Case-insensitive substring; a blank query
 * matches everything.
 */
export function matchesAssessmentSearch(row: AssessmentQueueRow, search: string | undefined): boolean {
  const q = search?.trim().toLowerCase();
  if (!q) return true;
  return [row.reference, row.childName, row.leadApplicantName, row.leadApplicantEmail].some(
    (field) => field?.toLowerCase().includes(q) ?? false
  );
}

/**
 * True when the row matches the search only through the lead applicant's name
 * or email. The list never shows those, but returning the row still discloses
 * that the parent is linked to it, so the page audits these matches the way the
 * Applications list audits showing the names (NAME_REVEAL).
 */
export function matchesOnlyByLeadApplicant(row: AssessmentQueueRow, search: string | undefined): boolean {
  const q = search?.trim().toLowerCase();
  if (!q || !matchesAssessmentSearch(row, q)) return false;
  return !row.reference.toLowerCase().includes(q) && !row.childName.toLowerCase().includes(q);
}

/** CH-45 Submitted sort, plus the Reference A–Z / Z–A sort (10 Oct 2026). */
export type AssessmentQueueSort = "submitted_asc" | "submitted_desc" | "reference_asc" | "reference_desc";

export const ASSESSMENT_QUEUE_SORTS: readonly AssessmentQueueSort[] = [
  "submitted_asc",
  "submitted_desc",
  "reference_asc",
  "reference_desc",
];

/**
 * Orders the rows for the chosen header. No sort leaves the query's order
 * (submittedAt ascending) untouched.
 *
 * Submitted: rows with no submission date sort last in both directions. They
 * have nothing to order by, and burying them at the bottom beats them jumping
 * to the top when she flips direction.
 */
export function sortAssessmentQueueRows(
  rows: readonly AssessmentQueueRow[],
  sort: AssessmentQueueSort | undefined
): AssessmentQueueRow[] {
  if (!sort) return rows.slice();
  if (sort === "reference_asc" || sort === "reference_desc") {
    const dir = sort === "reference_asc" ? 1 : -1;
    return rows.slice().sort((a, b) => dir * compareReferences(a.reference, b.reference));
  }
  return rows.slice().sort((a, b) => {
    const at = a.submittedAt?.getTime();
    const bt = b.submittedAt?.getTime();
    if (at === undefined && bt === undefined) return 0;
    if (at === undefined) return 1;
    if (bt === undefined) return -1;
    return sort === "submitted_asc" ? at - bt : bt - at;
  });
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
  const { bursaryStatus, academicYear, school, submittedFrom, submittedTo, search } = filters;

  return rows.filter((row) => {
    if (!matchesAssessmentSearch(row, search)) return false;
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
