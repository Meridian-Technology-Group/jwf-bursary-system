/**
 * academic-year.ts — Epic 15 M2 (CH-17, LA15-7).
 *
 * Display/entry helpers for per-academic-year school fees. The storage model
 * is unchanged: `SchoolFees.effectiveFrom` encodes the year — a fee for the
 * academic year starting in September YYYY is stored with
 * effectiveFrom = 1 September YYYY (the same anchor `fee-year.ts` resolves
 * against). These helpers translate between that date and the label the
 * Foundation uses ("2026-27").
 *
 * Pure module — no DB, no React.
 */

/** 1 September of the given start year, at UTC midnight (@db.Date column). */
export function academicYearStartDate(startYear: number): Date {
  return new Date(Date.UTC(startYear, 8, 1)); // month 8 = September
}

/**
 * The academic-year start year a date falls in (Sep–Aug years): September
 * onwards belongs to the year that just started; Jan–Aug to the previous one.
 */
export function academicYearStartFor(date: Date): number {
  const y = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? y : y - 1;
}

/** "2026-27"-style label for the academic year a date falls in. */
export function academicYearLabelFor(date: Date): string {
  const start = academicYearStartFor(date);
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Label for a start year: 2026 → "2026-27". */
export function academicYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
