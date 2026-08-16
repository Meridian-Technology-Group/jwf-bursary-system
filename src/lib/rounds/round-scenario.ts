/**
 * round-scenario.ts — Epic 14 D1 (CG-01, US-D1/D2): which of Charlotte's
 * four operating scenarios an application falls into, and the defaults each
 * scenario carries.
 *
 * Her table (2026-08-16 "Rounds & applications" email):
 *
 *  | scenario        | applies to      | window (defaults)   | default tax year |
 *  |-----------------|-----------------|---------------------|------------------|
 *  | NA_CURRENT      | NEW, this year  | any time (20 Aug – 19 Aug) | previous/current by the 12 Apr rule |
 *  | NA_NEXT_WINTER  | NEW, next year  | 10 Nov – 11 Apr     | PREVIOUS (tax year not yet ended) |
 *  | NA_NEXT_SPRING  | NEW, next year  | 12 Apr – 19 Aug     | CURRENT (tax year just ended)     |
 *  | RA              | ROLLING_OVER    | 12 Apr – 22 May     | CURRENT                            |
 *
 * LA-4 (locked): the "approx. 10 days after tax-year end" boundary is a FIXED
 * 12 April cutover each year; admin-editable dates (RoundWindow rows) cover
 * drift. The academic year runs 20 Aug → 19 Aug per her NA-current window.
 *
 * Pure module — no DB. `RoundWindow` rows override these derived defaults;
 * this resolver supplies the scenario choice and the fallbacks.
 */

export type RoundScenarioKey =
  | 'NA_CURRENT'
  | 'NA_NEXT_WINTER'
  | 'NA_NEXT_SPRING'
  | 'RA'

export type RoundScenarioApplicationType = 'NEW' | 'ROLLING_OVER'

/** LA-4 — the fixed tax-year cutover: 12 April. */
export const TAX_YEAR_CUTOVER_MONTH = 3 // April (0-based)
export const TAX_YEAR_CUTOVER_DAY = 12

/** The academic year boundary per Charlotte's NA-current window: 20 August. */
export const ACADEMIC_YEAR_START_MONTH = 7 // August (0-based)
export const ACADEMIC_YEAR_START_DAY = 20

/** True when `onDate` is on/after 12 April of its own calendar year (LA-4). */
export function isAfterTaxYearCutover(onDate: Date): boolean {
  const cutover = new Date(
    Date.UTC(onDate.getUTCFullYear(), TAX_YEAR_CUTOVER_MONTH, TAX_YEAR_CUTOVER_DAY),
  )
  return onDate.getTime() >= cutover.getTime()
}

/**
 * The academic year (as its starting calendar year) that `onDate` falls in:
 * 20 Aug 2026 → 19 Aug 2027 is academic year 2026 ("2026/27").
 */
export function academicYearStartFor(onDate: Date): number {
  const y = onDate.getUTCFullYear()
  const boundary = new Date(
    Date.UTC(y, ACADEMIC_YEAR_START_MONTH, ACADEMIC_YEAR_START_DAY),
  )
  return onDate.getTime() >= boundary.getTime() ? y : y - 1
}

/** "2026/27"-style label from a starting calendar year. */
export function academicYearLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

/**
 * The default TAX YEAR label for an application being worked on `onDate`
 * (income is declared for the last COMPLETE tax year):
 *  - on/after 12 Apr of year Y → the tax year that just ended: (Y-1)/(Y)
 *  - before 12 Apr of year Y   → the previous complete year: (Y-2)/(Y-1)
 */
export function defaultTaxYearLabel(onDate: Date): string {
  const y = onDate.getUTCFullYear()
  const startYear = isAfterTaxYearCutover(onDate) ? y - 1 : y - 2
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

export interface ResolveRoundScenarioInput {
  applicationType: RoundScenarioApplicationType
  /** "Today" for the decision — passed in, never read from the clock. */
  onDate: Date
  /**
   * The round being applied INTO, as its starting calendar year (e.g. 2026
   * for "2026/27"). Distinguishes NA_CURRENT (this academic year) from the
   * two next-year windows.
   */
  roundStartYear: number
}

export interface RoundScenarioDefaults {
  scenario: RoundScenarioKey
  /** Derived default tax-year label — a RoundWindow row overrides it. */
  defaultTaxYear: string
  /** Derived default window (date-only, UTC) — RoundWindow rows override. */
  opensOn: Date
  submitBy: Date
}

/**
 * Resolve the scenario + derived defaults. RA is fixed 12 Apr → 22 May of the
 * round's starting calendar year; NA windows follow her table with the LA-4
 * cutover splitting winter/spring for next-year applications.
 */
export function resolveRoundScenario(
  input: ResolveRoundScenarioInput,
): RoundScenarioDefaults {
  const { applicationType, onDate, roundStartYear } = input

  if (applicationType === 'ROLLING_OVER') {
    return {
      scenario: 'RA',
      // RA runs after the tax year ends, declaring the just-ended year.
      defaultTaxYear: academicYearTaxLabel(roundStartYear - 1),
      opensOn: utcDate(roundStartYear, 3, 12), // 12 Apr
      submitBy: utcDate(roundStartYear, 4, 22), // 22 May
    }
  }

  const currentAcademicStart = academicYearStartFor(onDate)

  if (roundStartYear <= currentAcademicStart) {
    // Applying for the CURRENT academic year — open any time, 20 Aug → 19 Aug.
    return {
      scenario: 'NA_CURRENT',
      defaultTaxYear: defaultTaxYearLabel(onDate),
      opensOn: utcDate(roundStartYear, ACADEMIC_YEAR_START_MONTH, ACADEMIC_YEAR_START_DAY),
      submitBy: utcDate(roundStartYear + 1, ACADEMIC_YEAR_START_MONTH, ACADEMIC_YEAR_START_DAY - 1),
    }
  }

  // Applying for the NEXT academic year: winter vs spring by the 12 Apr
  // cutover of the round's starting calendar year (LA-4).
  const cutover = utcDate(roundStartYear, TAX_YEAR_CUTOVER_MONTH, TAX_YEAR_CUTOVER_DAY)
  if (onDate.getTime() < cutover.getTime()) {
    return {
      scenario: 'NA_NEXT_WINTER',
      // Winter: the relevant tax year has NOT yet ended → previous complete year.
      defaultTaxYear: academicYearTaxLabel(roundStartYear - 2),
      opensOn: utcDate(roundStartYear - 1, 10, 10), // 10 Nov (year before entry)
      submitBy: utcDate(roundStartYear, 3, 11), // 11 Apr
    }
  }
  return {
    scenario: 'NA_NEXT_SPRING',
    // Spring/summer: the tax year just ended → current.
    defaultTaxYear: academicYearTaxLabel(roundStartYear - 1),
    opensOn: cutover, // 12 Apr
    submitBy: utcDate(roundStartYear, ACADEMIC_YEAR_START_MONTH, ACADEMIC_YEAR_START_DAY - 1), // 19 Aug
  }
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

/** "2025/26"-style tax-year label from its starting calendar year. */
function academicYearTaxLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}
