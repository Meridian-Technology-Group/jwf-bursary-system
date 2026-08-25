/**
 * tax-year.ts — round-derived tax-year / date wording for the parent form.
 *
 * Decision D5: every "to April YYYY" / payslip-month / SA302 tax-year string on
 * the application form derives from the round the application belongs to
 * (`Round.academicYear`) — the single source of truth. No literal "2025-26" or
 * "to April 2025" may remain hard-coded in the form copy.
 *
 * The workbook (application-form-scoping.md §6) hard-codes 2025-26; in the build
 * those become the labels produced here.
 *
 * Epic 14 D2 (CG-01) — **Charlotte decided this on 24 Aug 2026: yes, switch the
 * winter window over.** NOT yet implemented here, deliberately: doing it means
 * threading the resolved scenario (which needs the application type and a date,
 * neither of which this module or the income form currently receives) through to
 * the labels. It also has **no effect until the winter window opens on 10 Nov**,
 * because a current-year round resolves to NA_CURRENT, whose default tax year
 * already agrees with the round-derived labels. Bundling a structural change
 * with zero present-day effect into a parent-facing copy fix would have been the
 * wrong trade while real families are mid-form. Tracked as CH-47b.
 *
 * The original disagreement, for context: this
 * rule engine keys the tax year to the ROUND'S academic year alone, so a
 * next-year application filled in DURING the winter window (before the 12 Apr
 * cutover, LA-4) is still asked for the (Y-1)/Y tax year even though that year
 * has not ended yet; Charlotte's scenario table wants the PREVIOUS year there.
 * Per the Epic 14 plan the rule engine WINS until Brian/Charlotte decide —
 * the scenario default lives in `round-scenario.ts`/`RoundWindow.defaultTaxYear`
 * and is NOT read here. Flip point if the decision goes the other way: pass the
 * scenario's default tax year into `getTaxYearLabels` and prefer it.
 *
 * Pure module — safe to import on the client (no server-only deps).
 */

/**
 * Parses the academic-year string and returns the START calendar year.
 *
 * `Round.academicYear` is stored in several historical formats across the
 * codebase: "2026/27", "2025/2026", "2024-25", or a bare "2024". We only need
 * the leading four-digit year, so we extract it leniently and fall back to the
 * current calendar year if the value is malformed (defensive — the form should
 * still render rather than throw on a bad round value).
 */
export function academicYearStartYear(
  academicYear: string | null | undefined
): number {
  const match = academicYear?.match(/(\d{4})/);
  if (match) return Number.parseInt(match[1], 10);
  return new Date().getUTCFullYear();
}

/**
 * The labels the income (and related) sections render, all derived from the
 * round's start year `Y`.
 *
 * For an academic year starting in calendar year `Y` (e.g. 2026 for "2026/27"),
 * the most recent completed UK tax year ends on 5 April `Y` and the latest
 * payslip applicants hold is March `Y`. The SA302 covers the `Y-1`/`Y` tax year.
 */
export interface TaxYearLabels {
  /** The round's start calendar year, e.g. 2026. */
  startYear: number;
  /** "financial year ended 4 April 2026" */
  financialYearEndedLabel: string;
  /** "4 April 2026" */
  financialYearEndDateLabel: string;
  /** "P60 (dated April 2026)" supporting label fragment: "April 2026" */
  p60DateLabel: string;
  /** "March 2026 payslip" */
  marchPayslipLabel: string;
  /** "2025/26" — the SA302 tax year (Y-1 / Y) */
  sa302TaxYearLabel: string;
  /**
   * CH-47 — "2024/25", one year behind `sa302TaxYearLabel`.
   *
   * The self-employed evidence row already carried an arrears footnote, but it
   * said "the previous tax year" in the abstract, leaving the parent to work out
   * which year that was. Charlotte (24 Aug 2026): *"I need all forms right now to
   * show the tax year 2025-26 and for the comments re self-employed and
   * reporting one year in arrears to refer to 2024-25 then."* So the primary
   * label stays put and the footnote names the year.
   */
  sa302ArrearsTaxYearLabel: string;
  /** "since April 2026" — the "left employment in the last 12 months" wording */
  leftEmploymentSinceLabel: string;
}

/** Two-digit suffix of a year, e.g. 2026 → "26". */
function twoDigit(year: number): string {
  return String(year % 100).padStart(2, "0");
}

/**
 * Builds the full set of round-derived tax-year labels from an academic-year
 * string. Pass `Round.academicYear`.
 */
export function getTaxYearLabels(
  academicYear: string | null | undefined
): TaxYearLabels {
  const startYear = academicYearStartYear(academicYear);
  return {
    startYear,
    financialYearEndedLabel: `financial year ended 4 April ${startYear}`,
    financialYearEndDateLabel: `4 April ${startYear}`,
    p60DateLabel: `April ${startYear}`,
    marchPayslipLabel: `March ${startYear} payslip`,
    sa302TaxYearLabel: `${startYear - 1}/${twoDigit(startYear)}`,
    sa302ArrearsTaxYearLabel: `${startYear - 2}/${twoDigit(startYear - 1)}`,
    leftEmploymentSinceLabel: `since April ${startYear}`,
  };
}
