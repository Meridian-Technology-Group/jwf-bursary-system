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
 * ## CH-47b — the winter-window switch, now implemented (Epic 19 WP-D5)
 *
 * Charlotte decided this on 24 Aug 2026: **yes, switch the winter window over.**
 *
 * The disagreement it resolves: keying the tax year to the ROUND'S academic year
 * alone means a next-year application filled in DURING the winter window (before
 * the 12 Apr cutover, LA-4) is asked for the (Y-1)/Y tax year **even though that
 * year has not ended yet**. Her scenario table wants the PREVIOUS year there,
 * and she is plainly right: a parent cannot evidence a tax year that is still
 * running.
 *
 * So the labels now accept the resolved scenario. `NA_NEXT_WINTER` steps the
 * whole label set back one year; every other scenario is unchanged, which is why
 * this is inert today — a current-year round resolves to `NA_CURRENT`.
 *
 * **Deliberate API shape.** `getTaxYearLabels(academicYear)` with no second
 * argument behaves EXACTLY as before. The step-back only happens when a caller
 * supplies a basis year, and the basis year is resolved on the server by
 * `resolveTaxYearBasisYear`. That keeps the rule in one place, keeps this module
 * clock-free (a date is always passed in, never read), and means the contribute
 * path and every existing test keep their current behaviour until explicitly
 * opted in.
 *
 * Pure module — safe to import on the client (no server-only deps).
 */

import {
  resolveRoundScenario,
  type RoundScenarioApplicationType,
} from "@/lib/rounds/round-scenario";

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
  /**
   * The round's start calendar year, e.g. 2026. Unchanged by CH-47b — this is
   * the ROUND's year, which the winter step-back does not move.
   */
  startYear: number;
  /**
   * CH-47b — the year every label below is actually built from. Equal to
   * `startYear` except in the `NA_NEXT_WINTER` scenario, where it is one year
   * behind because the (Y-1)/Y tax year has not ended yet.
   */
  basisYear: number;
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
 * CH-47b — the year the labels are built from, given the round and the
 * application's scenario.
 *
 * Equal to the round's start year in every scenario except `NA_NEXT_WINTER`,
 * where it is one year behind: the winter window runs BEFORE the 12 Apr cutover,
 * so the (Y-1)/Y tax year has not ended and a parent cannot evidence it.
 *
 * `onDate` is always passed in, never read from the clock, so this stays pure
 * and testable — the same discipline `round-scenario.ts` keeps.
 *
 * Call this on the SERVER and pass the resulting number to `getTaxYearLabels`;
 * that keeps `Date` off the client-component boundary entirely.
 */
export function resolveTaxYearBasisYear(input: {
  academicYear: string | null | undefined;
  applicationType: RoundScenarioApplicationType;
  /** "Today" for the decision. */
  onDate: Date;
}): number {
  const roundStartYear = academicYearStartYear(input.academicYear);
  const { scenario } = resolveRoundScenario({
    applicationType: input.applicationType,
    onDate: input.onDate,
    roundStartYear,
  });
  // The ONLY scenario that moves the labels. NA_CURRENT, NA_NEXT_SPRING and RA
  // all declare a tax year that has actually ended, which is what the
  // round-derived labels already describe.
  return scenario === "NA_NEXT_WINTER" ? roundStartYear - 1 : roundStartYear;
}

/**
 * Builds the full set of round-derived tax-year labels from an academic-year
 * string. Pass `Round.academicYear`.
 *
 * `basisYear` (CH-47b) overrides the year the labels are built from — supply
 * `resolveTaxYearBasisYear(...)` to honour Charlotte's winter-window rule.
 * **Omitting it reproduces the pre-CH-47b behaviour exactly.**
 */
export function getTaxYearLabels(
  academicYear: string | null | undefined,
  options?: { basisYear?: number | null }
): TaxYearLabels {
  const startYear = academicYearStartYear(academicYear);
  // A malformed or absent basis year falls back to the round year rather than
  // producing NaN labels — the same defensive stance as `academicYearStartYear`.
  const basisYear =
    typeof options?.basisYear === "number" &&
    Number.isFinite(options.basisYear)
      ? options.basisYear
      : startYear;
  return {
    startYear,
    basisYear,
    financialYearEndedLabel: `financial year ended 4 April ${basisYear}`,
    financialYearEndDateLabel: `4 April ${basisYear}`,
    p60DateLabel: `April ${basisYear}`,
    marchPayslipLabel: `March ${basisYear} payslip`,
    sa302TaxYearLabel: `${basisYear - 1}/${twoDigit(basisYear)}`,
    sa302ArrearsTaxYearLabel: `${basisYear - 2}/${twoDigit(basisYear - 1)}`,
    leftEmploymentSinceLabel: `since April ${basisYear}`,
  };
}
