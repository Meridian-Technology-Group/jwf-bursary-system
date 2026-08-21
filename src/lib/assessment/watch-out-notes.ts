/**
 * CALC-10 — "Assessor's wizard — things to look out for with this family"
 * (workbook §3.16). The workbook keeps a forward-looking note on the account's
 * assessment page so NEXT year's assessor sees what mattered this year before
 * they start. The system models this as `Assessment.watchOutNotes` (edited on
 * the v2 form — see `assessment-form-v2.tsx`) and surfaced as a callout at the
 * top of the NEXT assessment for the same `BursaryAccount`.
 *
 * This module is the pure selection rule — no DB, no React — so it can be
 * unit-tested against a plain list of candidate rows. The DB query
 * (`getPreviousWatchOutNotes`, `src/lib/db/queries/reassessment.ts`) fetches
 * every assessment linked to a bursary account and hands the rows here.
 */

export interface WatchOutCandidate {
  /** The application this assessment belongs to — excluded when it's the current one. */
  applicationId: string;
  /** The round's academic year, for display context. */
  academicYear: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
  /** When the assessment was completed (null until COMPLETED). */
  completedAt: Date | string | null;
  watchOutNotes: string | null;
}

export interface WatchOutSelection {
  applicationId: string;
  academicYear: string;
  watchOutNotes: string;
}

/** True when a string has non-whitespace content. */
function hasText(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function completedAtMillis(value: Date | string | null): number {
  if (!value) return -Infinity;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * Selects the note to surface on the CURRENT (next) assessment: the most
 * recently COMPLETED assessment, for a DIFFERENT application on the same
 * bursary account, that has non-blank `watchOutNotes`. Returns `null` when
 * there is nothing to show — no prior completed assessment, or none of them
 * left a note.
 *
 * "Most recent" is by `completedAt` descending; a null/unparseable
 * `completedAt` sorts last (should not happen for a COMPLETED row in
 * practice, but keeps the function total rather than throwing).
 */
export function selectPreviousWatchOutNotes(
  candidates: readonly WatchOutCandidate[],
  currentApplicationId: string
): WatchOutSelection | null {
  const eligible = candidates.filter(
    (c) =>
      c.applicationId !== currentApplicationId &&
      c.status === "COMPLETED" &&
      hasText(c.watchOutNotes)
  );

  if (eligible.length === 0) return null;

  const [best] = [...eligible].sort(
    (a, b) => completedAtMillis(b.completedAt) - completedAtMillis(a.completedAt)
  );

  return {
    applicationId: best.applicationId,
    academicYear: best.academicYear,
    watchOutNotes: best.watchOutNotes as string,
  };
}
