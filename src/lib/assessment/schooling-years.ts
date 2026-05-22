/**
 * Schooling years remaining calculator.
 *
 * Determines how many years of schooling remain for a bursary holder,
 * used in both the assessment engine and the auto-decrement logic on
 * re-assessment.
 *
 * School year structure at JWF schools:
 *   Year 6  entry → 7 years total (Years 6–12)
 *   Year 7  entry → 6 years total (Years 7–12)
 *   Year 9  entry → 4 years total (Years 9–12)
 *   Year 12 entry → 1 year  total
 */

/** Mapping of entry year to total number of schooling years. */
const TOTAL_YEARS_BY_ENTRY: Record<number, number> = {
  6: 7,
  7: 6,
  9: 4,
  12: 1,
};

/**
 * Parses the academic year string (e.g. "2024-25" or "2024/25") and returns
 * the start calendar year as a number.
 */
function parseAcademicYearStart(academicYear: string): number {
  // Accept "2024-25", "2024/25", or plain "2024"
  const match = academicYear.match(/^(\d{4})/);
  if (!match) {
    throw new Error(
      `Invalid academicYear format: "${academicYear}". Expected "YYYY-YY" or "YYYY/YY".`
    );
  }
  return parseInt(match[1], 10);
}

/**
 * Calculates the number of schooling years remaining for a bursary holder.
 *
 * @param entryYear             The school year the child entered (6, 7, 9, or 12).
 * @param currentAcademicYear   The academic year being assessed, e.g. "2025-26".
 * @param firstAssessmentYear   The academic year of the first bursary assessment,
 *                              e.g. "2023-24".
 * @returns                     Remaining years (minimum 0).
 *
 * @example
 * // Child entered Year 7 and was first assessed in 2023-24.
 * // Now in 2025-26: 2 years have passed since first assessment.
 * // Total years = 6. Remaining = 6 - 2 = 4.
 * calculateSchoolingYearsRemaining(7, "2025-26", "2023-24"); // → 4
 */
export function calculateSchoolingYearsRemaining(
  entryYear: number,
  currentAcademicYear: string,
  firstAssessmentYear: string
): number {
  const totalYears = TOTAL_YEARS_BY_ENTRY[entryYear];

  if (totalYears === undefined) {
    throw new Error(
      `Unknown entry year: ${entryYear}. Supported values: ${Object.keys(TOTAL_YEARS_BY_ENTRY).join(", ")}.`
    );
  }

  const currentStart = parseAcademicYearStart(currentAcademicYear);
  const firstStart = parseAcademicYearStart(firstAssessmentYear);

  // Number of assessment cycles elapsed since the first year.
  // In the first year itself, yearsSinceFirst = 0, so remaining = totalYears.
  const yearsSinceFirst = Math.max(0, currentStart - firstStart);

  const remaining = totalYears - yearsSinceFirst;

  return Math.max(0, remaining);
}

/**
 * Returns the total schooling years for a given entry year.
 * Throws if the entry year is not one of the supported values.
 */
export function getTotalSchoolingYears(entryYear: number): number {
  const total = TOTAL_YEARS_BY_ENTRY[entryYear];
  if (total === undefined) {
    throw new Error(
      `Unknown entry year: ${entryYear}. Supported values: ${Object.keys(TOTAL_YEARS_BY_ENTRY).join(", ")}.`
    );
  }
  return total;
}

/** Supported entry years for validation. */
export const SUPPORTED_ENTRY_YEARS = Object.keys(TOTAL_YEARS_BY_ENTRY).map(
  Number
);

// ─── Year-group model (spec §4) ─────────────────────────────────────────────
//
// The source of truth for schooling-years is the entry *year-group*
// (`EntryYearGroup` in the Prisma schema). The numeric part of the group maps
// to the entry-year keys above (Y6→6, Y7→7, …). `OTHER` has no defined total —
// the assessor enters schooling years manually in that case.
//
// To know how many years *remain* (or the child's *current* year-group), the
// group alone is insufficient: two children can both enter at Y7 in different
// calendar years. We therefore combine the group with the entry *calendar* year
// (`entry_year`), which is stable across re-assessments. Elapsed academic years
// = currentAcademicYearStart − entryCalendarYear.

/** The school year-group a child enters at. Mirrors the Prisma enum. */
export type EntryYearGroupCode = "Y6" | "Y7" | "Y9" | "Y12" | "OTHER";

/** Human-readable labels for each entry year-group. */
export const ENTRY_YEAR_GROUP_LABELS: Record<EntryYearGroupCode, string> = {
  Y6: "Year 6",
  Y7: "Year 7",
  Y9: "Year 9",
  Y12: "Year 12",
  OTHER: "Other",
};

/** Maps a year-group to its numeric entry-year key. `OTHER` → null. */
const ENTRY_YEAR_GROUP_NUMBER: Record<EntryYearGroupCode, number | null> = {
  Y6: 6,
  Y7: 7,
  Y9: 9,
  Y12: 12,
  OTHER: null,
};

/**
 * Returns the calendar year in which the current UK academic year started.
 * The academic year rolls over in September (month index >= 8), so e.g.
 * March 2026 → 2025, October 2026 → 2026.
 */
export function academicYearStartForDate(now: Date = new Date()): number {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Total schooling years for an entry year-group, or null when the group is
 * `OTHER` / unrecognised (assessor enters the value manually).
 */
export function getTotalSchoolingYearsForGroup(
  group: EntryYearGroupCode | null | undefined
): number | null {
  if (!group) return null;
  const n = ENTRY_YEAR_GROUP_NUMBER[group];
  return n === null || n === undefined ? null : getTotalSchoolingYears(n);
}

/**
 * Schooling years remaining, derived from the entry year-group and the entry
 * calendar year. Returns null when the group is `OTHER` / unrecognised or the
 * entry calendar year is unknown — callers then fall back to manual entry.
 *
 * @example
 * // Entered Y7 (6 total years) in calendar 2025; assessed in academic 2026.
 * // 1 year elapsed → 5 remaining.
 * calculateSchoolingYearsRemainingFromEntry("Y7", 2025, new Date("2026-10-01")); // → 5
 */
export function calculateSchoolingYearsRemainingFromEntry(
  group: EntryYearGroupCode | null | undefined,
  entryCalendarYear: number | null | undefined,
  now: Date = new Date()
): number | null {
  const total = getTotalSchoolingYearsForGroup(group);
  if (total === null || entryCalendarYear == null) return null;
  const elapsed = Math.max(0, academicYearStartForDate(now) - entryCalendarYear);
  return Math.max(0, total - elapsed);
}

/**
 * The child's current school year-group number (e.g. 8 for Y8), derived from
 * the entry year-group and entry calendar year. Returns null when the group is
 * `OTHER` / unrecognised or the entry calendar year is unknown.
 *
 * @example
 * // Entered Y7 in calendar 2025; now academic 2026 → Y8.
 * deriveCurrentYearGroupNumber("Y7", 2025, new Date("2026-10-01")); // → 8
 */
export function deriveCurrentYearGroupNumber(
  group: EntryYearGroupCode | null | undefined,
  entryCalendarYear: number | null | undefined,
  now: Date = new Date()
): number | null {
  if (!group || entryCalendarYear == null) return null;
  const n = ENTRY_YEAR_GROUP_NUMBER[group];
  if (n === null || n === undefined) return null;
  const elapsed = Math.max(0, academicYearStartForDate(now) - entryCalendarYear);
  return n + elapsed;
}
