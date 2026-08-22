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

// ─── Entry academic year (CH-26) ─────────────────────────────────────────────
//
// `Contact.entryYear` / `Application.entryYear` / `BursaryAccount.entryYear`
// store the START calendar year of the academic year of entry (an Int). Charlotte
// (2026-08-22) asked that admin surfaces never show the bare start year, because
// "2027" is ambiguous about which academic year is meant: a 2027 entry means the
// 2027/2028 academic year. Storage is unchanged — these helpers are display and
// dropdown-entry only.

/** Full both-years label for an entry start year: 2027 → "2027/2028". */
export function entryAcademicYearLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

/**
 * Same, tolerating the nullable/loose shapes the admin tables carry. Returns
 * `null` when there is no parsable start year, so callers render their own
 * placeholder ("—") rather than a bogus year.
 */
export function entryAcademicYearLabelOrNull(
  startYear: number | string | null | undefined
): string | null {
  if (startYear == null || startYear === "") return null;
  const n = typeof startYear === "number" ? startYear : parseInt(startYear, 10);
  if (!Number.isInteger(n)) return null;
  return entryAcademicYearLabel(n);
}

/**
 * The window of entry academic years offered in admin dropdowns: one year back
 * (back-dated entries) through six years ahead, as start years. Same window the
 * internal-request dialog has always offered, now labelled "2026/2027".
 */
export function entryAcademicYearOptions(
  now: Date = new Date()
): { value: string; label: string }[] {
  const first = now.getFullYear() - 1;
  return Array.from({ length: 8 }, (_, i) => first + i).map((startYear) => ({
    value: String(startYear),
    label: entryAcademicYearLabel(startYear),
  }));
}
