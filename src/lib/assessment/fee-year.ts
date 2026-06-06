/**
 * Epic 07 — Fee-year resolution (pure, DB-free).
 *
 * The Foundation's fees rise each academic year. An award decided in one round
 * is paid across a school year that spans the fee uplift, so the assessor must
 * see BOTH the fee in force for the year being assessed (current-year) and the
 * fee for the following academic year (next-year).
 *
 * This module is the pure half: it parses the round's `academicYear` string
 * into a numeric start year, and — given a list of versioned `SchoolFees`-style
 * rows — resolves the row effective FOR a given academic year. The DB read +
 * dedup live in `src/lib/db/queries/reference-tables.ts`, which delegates the
 * actual "which row wins" decision to `resolveEffectiveFeeRow` here so the rule
 * is unit-tested without a database.
 *
 * Canonical year anchor: `Round.academicYear` (D5 / plan 07 §5.1). The string
 * is "YYYY-YY" (e.g. "2025-26"); the start year is the first four digits, and
 * the academic year is taken to begin on **1 September** of that start year.
 *
 * No DB dependencies, no UI dependencies — pure TypeScript.
 */

/** Month (0-indexed: 8 = September) on which an academic year is taken to start. */
export const ACADEMIC_YEAR_START_MONTH = 8; // September

/**
 * Parses an academic-year label into its numeric start year.
 *
 * Accepts the canonical "YYYY-YY" / "YYYY-YYYY" / "YYYY/YY" forms and a bare
 * "YYYY". Returns `null` if no four-digit leading year can be read — callers
 * fall back to the current behaviour rather than guessing.
 *
 * Mirrors the lenient parse already used for the parent-form tax-year wording
 * (`lib/portal/tax-year.ts`, D5) so the two stay consistent.
 */
export function parseAcademicYearStart(academicYear: string | null | undefined): number | null {
  if (!academicYear) return null;
  const match = academicYear.trim().match(/^(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * The date an academic year is taken to begin (1 September of its start year),
 * as a UTC date so it compares cleanly against `effectiveFrom @db.Date` values
 * (which Prisma returns as midnight-UTC dates).
 */
export function academicYearStartDate(startYear: number): Date {
  return new Date(Date.UTC(startYear, ACADEMIC_YEAR_START_MONTH, 1));
}

/** A versioned fee row — the minimal shape the resolver needs. */
export interface VersionedFeeRow {
  annualFees: number;
  effectiveFrom: Date;
  /** Tie-break for two rows with the same `effectiveFrom` (newest insert wins). */
  createdAt?: Date;
}

/**
 * Resolves the fee row effective FOR a given academic year from a list of
 * versioned rows: the latest row whose `effectiveFrom` is on or before the
 * start of that academic year (1 September of `startYear`).
 *
 * Ordering is **deterministic**: `effectiveFrom desc, createdAt desc` — the same
 * tie-break the settings read path uses (defect [12] / plan 07 §5.1). Two rows
 * with the same `effectiveFrom` resolve to the most recently inserted one, so a
 * same-day fee edit surfaces instead of a stale version.
 *
 * Returns `null` if no row is effective by that year (e.g. the school's fee
 * schedule starts later). Callers decide the fallback — for "next year" the UI
 * falls back to the current-year figure and labels it "not yet set" (plan §8).
 *
 * The input list need not be pre-sorted; this function sorts a copy.
 *
 * @param rows        Versioned fee rows for a single school.
 * @param startYear   Academic-year start year (e.g. 2025 for "2025-26").
 */
export function resolveEffectiveFeeRow<T extends VersionedFeeRow>(
  rows: readonly T[],
  startYear: number,
): T | null {
  const cutoff = academicYearStartDate(startYear).getTime();

  const eligible = rows.filter((r) => r.effectiveFrom.getTime() <= cutoff);
  if (eligible.length === 0) return null;

  // effectiveFrom desc, then createdAt desc (newest insert wins on a tie).
  const sorted = [...eligible].sort((a, b) => {
    const ef = b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    if (ef !== 0) return ef;
    const ac = a.createdAt?.getTime() ?? 0;
    const bc = b.createdAt?.getTime() ?? 0;
    return bc - ac;
  });

  return sorted[0];
}

/** The resolved current-year and next-year annual fee for a school. */
export interface FeeYearPair {
  /** Annual fee in force for the assessed academic year, or null if none set. */
  currentYearAnnualFees: number | null;
  /** Annual fee for the FOLLOWING academic year, or null if none set yet. */
  nextYearAnnualFees: number | null;
}

/**
 * Resolves the current-year and next-year annual fee from a school's versioned
 * rows, given the assessed academic year's start year.
 *
 * "Next year" is simply `startYear + 1` run through the same resolver. If no
 * forward-dated row exists yet, `nextYearAnnualFees` is `null` and the UI labels
 * it "next-year fee not yet set" (plan §8 mitigation) rather than erroring.
 */
export function resolveFeeYearPair<T extends VersionedFeeRow>(
  rows: readonly T[],
  startYear: number,
): FeeYearPair {
  const current = resolveEffectiveFeeRow(rows, startYear);
  const next = resolveEffectiveFeeRow(rows, startYear + 1);
  return {
    currentYearAnnualFees: current ? current.annualFees : null,
    nextYearAnnualFees: next ? next.annualFees : null,
  };
}
