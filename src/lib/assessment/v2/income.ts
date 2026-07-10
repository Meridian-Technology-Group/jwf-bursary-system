/**
 * CALC-03 — Engine v2: income assembly (workbook rows 2–40).
 *
 * Mirrors `newIncomeTotal` (`src/lib/portal/income-model.ts`) — the assessor
 * record (`AssessorIncomeRecord`, CALC-02) is structurally the parent-portal
 * `ParentIncomeRecord` plus two assessor-only extras:
 *   - `divorcedSeparated.newSpouseIncomePortion` — the portion of a new
 *     spouse/partner's income the assessor counts toward household income
 *     (workbook: "earned-income portion from new spouse if remarried").
 *   - `thirdParty.numberOfKidsDivisor` — the workbook's "ADJUSTED LAST 12
 *     MONTHS' RECEIVED CASH SUPPORT/NBER OF KIDS": last-12-months third-party
 *     cash support is divided by the number of kids, not summed whole.
 *
 * Pure module — no DB, no React.
 */

import type { AssessorIncomeRecord } from '@/types/assessment-v2'

function n(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Sums every present sub-block of a single earner's status-driven income
 * record (workbook rows 2–39, one earner column).
 */
export function calculateEarnerIncome(detail: AssessorIncomeRecord): number {
  let total = 0

  if (detail.employed) {
    total += n(detail.employed.annualSalaryPaye)
  }

  if (detail.selfEmployed) {
    const s = detail.selfEmployed
    total += n(s.grossSalaried) + n(s.propertyIncome) + n(s.dividends) + n(s.otherInvestmentIncome)
  }

  if (detail.benefits) {
    const b = detail.benefits
    total +=
      n(b.universalCredit) +
      n(b.housingBenefit) +
      n(b.childBenefit) +
      n(b.childWorkingTaxCredit) +
      n(b.esa) +
      n(b.pipOrDla) +
      n(b.carersAllowance) +
      n(b.childcareSupport) +
      n(b.other)
  }

  if (detail.unemployed) {
    const u = detail.unemployed
    total += n(u.finalGrossPay) + n(u.redundancy) + n(u.jsa) + n(u.grantSupport) + n(u.leavePay)
  }

  if (detail.retired) {
    total += n(detail.retired.statePension) + n(detail.retired.privatePension)
  }

  if (detail.divorcedSeparated) {
    // Workbook: "yearly child maintenance + earned-income portion from new
    // spouse if remarried" — the new-spouse portion is an assessor-only
    // extra not on the parent-facing form (CALC-02 `AssessorDivorcedSeparatedIncome`).
    total += n(detail.divorcedSeparated.maintenanceReceived) + n(detail.divorcedSeparated.newSpouseIncomePortion)
  }

  if (detail.thirdParty) {
    // Workbook: "ADJUSTED LAST 12 MONTHS' RECEIVED CASH SUPPORT/NBER OF
    // KIDS" — divide by the assessor's kids divisor, never by zero or a
    // negative value (defaults to 1 when unset).
    const divisor = Math.max(1, n(detail.thirdParty.numberOfKidsDivisor))
    total += n(detail.thirdParty.incomeSupportReceived) / divisor
  }

  return total
}

/**
 * Household's Overall Net Income (workbook `C40`) — the sum of every
 * earner's income, floored at 0.
 */
export function calculateHouseholdNetIncome(earners: readonly AssessorIncomeRecord[]): number {
  const total = earners.reduce((sum, earner) => sum + calculateEarnerIncome(earner), 0)
  return Math.max(0, total)
}
