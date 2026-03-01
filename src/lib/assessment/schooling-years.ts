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
