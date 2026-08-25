/**
 * CALC-06 — Engine v2 orchestrator.
 *
 * Composes CALC-03 (income + notional spend), CALC-04 (debt module), CALC-05
 * (profiling derivations) and CALC-06 (award legs) in the dependency order
 * the workbook itself requires — see implementation-plan.md §CALC-06:
 *
 *   1. Household net income (`income.ts`).
 *   2. Derived yearly debt repayments (`debt.ts`) — needs only
 *      `schoolingYearsRemaining` + the itemised debts, so it can run before
 *      notional spend.
 *   3. Notional spend, incl. the savings test (`notional-spend.ts`) — the
 *      savings test (C80/C81) takes `derivedYearlyDebtRepayments` as an
 *      input, which is why step 2 must run first.
 *   4. Yearly debt exposure / debt-over-NDI ratio / classification
 *      (`debt.ts`) — the exposure figure needs `adjustedSavings`, which only
 *      exists once step 3 has run.
 *   5. Profiling (`profiling.ts`) — income category, property/equity
 *      categories, financial equity, and the lifestyle-squeeze ratio (which
 *      needs `yearlyDebtExposure` from step 4).
 *   6. The three award legs + `recommendedPayableFees` (`award.ts`), and
 *      (when the assessor has entered next-year fees + a bursary award) the
 *      after-VAT award summary.
 *
 * The output type's field names map 1:1 (camelCase) onto the CALC-02 v2
 * snapshot columns on `prisma/schema.prisma`'s `Assessment` model — that
 * column list is the contract for what this function must populate.
 *
 * Pure module — no DB, no React.
 */

import { calculateEarnerAggregateIncome, calculateHouseholdNetIncome } from './income'
import { normaliseManualAdjustment } from './manual-adjustment'
import { calculateNotionalSpend } from './notional-spend'
import {
  calculateDerivedYearlyDebtRepayments,
  calculateYearlyDebtExposure,
  calculateDebtOverNdiRatio,
  classifyDebt,
} from './debt'
import {
  incomeCategory,
  feesBenchmarkPct,
  propertyCategory,
  propertyEquityTotals,
  propertyEquityCategory,
  netFinancialEquity,
  financialEquityLabel,
  lifestyleSqueeze,
  type PropertyPortfolioType,
} from './profiling'
import {
  actualRemainingDI,
  theoreticalBenchmarkDI,
  affordabilityAdjustedDI,
  maxPayableFeesInclVat,
  recommendedPayableFees,
  awardSummary,
  type AwardSummaryResult,
} from './award'
import type { NotionalSpendLine, ReferenceBundle, RentAddBackType } from './types'
import type { AssessorIncomeRecord, PropertyAssetsRecord, DebtsRecord } from '@/types/assessment-v2'

/** Inputs to `calculateAssessmentV2` — one assessor's worth of captured data for a single assessment. */
export interface AssessmentV2Input {
  /** One `AssessorIncomeRecord` per earner (CALC-02 `assessment_earners.income_detail`). */
  earners: readonly AssessorIncomeRecord[]
  /**
   * Epic 13 / C2 — the assessor's SIGNED manual income adjustment
   * (`Assessment.manualAdjustment`), applied after earner aggregation and
   * before the C40 £0 floor. Negative deducts. Defaults to 0.
   */
  manualAdjustment?: number
  /** Family type category 1–6 — keys every notional/profiling lookup. */
  familyTypeCategory: number

  // ── Notional-spend toggles (CALC-03) ──────────────────────────────────
  rentAddBackType: RentAddBackType
  /** CH-21 — manual £ override of the C57 rent add-back; null/absent = dropdown-derived. */
  rentAddBackOverride?: number | null
  /** C58 — assessor-judged, independent of `rentAddBackType` (assumption CALC-A7). */
  multiPropertyRentAddBack: boolean
  /** C60 — full council-tax-support add-back. */
  councilTaxSupport: boolean
  /** CH-22 — manual £ override of the C59 council-tax deduct; null/absent = reference default. */
  councilTaxOverride?: number | null
  /** C65/66 — deduct notional car spend only when true. */
  usesCar: boolean
  /** C67/68 — deduct notional public-transport spend only when true. */
  usesPublicTransport: boolean
  /** C83 — yearly insured school-fee total, added back in full. */
  feeInsuranceAnnual: number

  // ── Savings (feeds the savings test, C72–C81) ─────────────────────────
  cashSavings: number
  isasPepsShares: number
  /** Optional override; defaults from `ReferenceBundle.familyCategoryMetas` when omitted. */
  schoolAgeChildrenCount?: number
  schoolingYearsRemaining: number

  // ── Property assets + debt module (CALC-04/05) ────────────────────────
  propertyAssets: PropertyAssetsRecord
  portfolioType: PropertyPortfolioType
  debts: DebtsRecord

  // ── Award legs (CALC-06) ──────────────────────────────────────────────
  /** Older siblings' payable fees, in priority order (C152). */
  siblingPayableFees: readonly number[]
  /** This pupil's annual school fees for the CURRENT year (C151). */
  annualFees: number
  /** Scholarship percentage 0–100 (C164). */
  scholarshipPct: number
  /** Bursary award/spend, BEFORE VAT, assessor-entered (CH-36). Omit to skip the award summary. */
  bursaryAwardBeforeVat?: number
  /** Next-year school fees, before VAT (C163). Omit to skip the award summary. */
  nextYearFees?: number
  /** Default `DEFAULT_VAT_RATE` (`../types`). */
  vatRate?: number
  /** The account's confirmed payable fees, when known — feeds `gapAmount` (C172). */
  confirmedPayableFees?: number
}

/**
 * Every intermediate the CALC-02 v2 snapshot columns name (`prisma/schema.prisma`
 * `Assessment` model), plus a handful of extra pass-throughs (`householdNetIncome`,
 * `adjustedSavings`, `notionalSpendLines`, `minRepaymentMonths`, `feesBenchmarkPct`,
 * `awardSummary`) that aren't their own Assessment columns but are useful for
 * wiring/testing the orchestration and are cheap to carry alongside the
 * contract fields.
 */
export interface AssessmentV2Output {
  /** C40 — not itself a v2 snapshot column (v1's `totalHouseholdNetIncome` already covers it), but every downstream leg needs it. */
  householdNetIncome: number
  /** Earner subtotal BEFORE the manual adjustment and before the C40 floor — so the UI can show the adjustment as its own line. */
  earnerAggregateIncome: number
  /** Epic 13 / C2 — the signed manual income adjustment that was applied (0 when none). */
  manualAdjustment: number

  // ── Notional spend (CALC-03) ──────────────────────────────────────────
  notionalEssentials: number
  notionalCar: number
  notionalPublicTransport: number
  notionalJwfAllowance: number
  notionalSavingsBenchmark: number
  savingsTestNumber: number
  totalNotionalSpend: number
  ndiAfterNotionalSpend: number
  /** C77 — not its own Assessment column, but needed to verify the savings-test/debt wiring. */
  adjustedSavings: number
  /** Every itemised notional-spend line, workbook row order — for UI/audit use. */
  notionalSpendLines: readonly NotionalSpendLine[]

  // ── Debt module (CALC-04) ─────────────────────────────────────────────
  derivedYearlyDebtRepayments: number
  yearlyDebtExposure: number
  debtOverNdiRatio: number
  debtStatusLabel: string
  /** Not its own Assessment column, but a useful CALC-04 pass-through. */
  minRepaymentMonths: number | null

  // ── Profiling (CALC-05) ───────────────────────────────────────────────
  incomeCategory: number | null
  propertyCategoryDerived: number
  propertyEquityCategory: number | null
  financialEquityLabel: string | null
  lifestyleSqueezeRatio: number | null
  lifestyleSqueezeLabel: string | null
  /** Not its own Assessment column, but feeds `lifestyleSqueeze` and the award summary. */
  feesBenchmarkPct: number | null

  // ── Award legs (CALC-06) ──────────────────────────────────────────────
  actualRemainingDi: number
  theoreticalBenchmarkDi: number
  affordabilityAdjustedDi: number
  recommendedPayableFees: number
  /** `null` unless both `nextYearFees` and `bursaryAwardBeforeVat` were supplied on the input. */
  awardSummary: AwardSummaryResult | null
}

/** Finds a notional-spend line's non-negative magnitude by key; 0 if absent (should not happen against the real engine). */
function lineAmount(lines: readonly NotionalSpendLine[], key: NotionalSpendLine['key']): number {
  return lines.find((line) => line.key === key)?.amount ?? 0
}

/** Composes CALC-03/04/05/06 into the full v2 assessment calculation. */
export function calculateAssessmentV2(input: AssessmentV2Input, ref: ReferenceBundle): AssessmentV2Output {
  const category = input.familyTypeCategory

  // 1. Household net income (CALC-03 income.ts) — earner aggregation, then
  //    the Epic 13 / C2 manual income adjustment, then the C40 £0 floor.
  //    Everything downstream (notional spend → NDI → the three award legs)
  //    consumes the ADJUSTED figure, which is why the adjustment sits here at
  //    step 1 rather than being bolted onto the award at the end.
  const manualAdjustment = normaliseManualAdjustment(input.manualAdjustment)
  const earnerAggregateIncome = calculateEarnerAggregateIncome(input.earners)
  const householdNetIncome = calculateHouseholdNetIncome(input.earners, manualAdjustment)

  // 2. Derived yearly debt repayments (CALC-04) — precedes notional spend
  //    because the savings test needs it.
  const derivedYearlyDebtRepayments = calculateDerivedYearlyDebtRepayments(
    input.debts,
    input.schoolingYearsRemaining,
  )

  // 3. Notional spend, incl. the savings test (CALC-03), fed the debt repayments.
  const notionalSpend = calculateNotionalSpend(
    {
      familyTypeCategory: category,
      netIncome: householdNetIncome,
      rentAddBackType: input.rentAddBackType,
      rentAddBackOverride: input.rentAddBackOverride,
      multiPropertyRentAddBack: input.multiPropertyRentAddBack,
      councilTaxSupport: input.councilTaxSupport,
      councilTaxOverride: input.councilTaxOverride,
      usesCar: input.usesCar,
      usesPublicTransport: input.usesPublicTransport,
      feeInsuranceAnnual: input.feeInsuranceAnnual,
      cashSavings: input.cashSavings,
      isasPepsShares: input.isasPepsShares,
      schoolAgeChildrenCount: input.schoolAgeChildrenCount,
      schoolingYearsRemaining: input.schoolingYearsRemaining,
      derivedYearlyDebtRepayments,
    },
    ref,
  )

  // 4. Yearly debt exposure / ratio / classification (CALC-04) — needs
  //    `adjustedSavings`, which only exists once notional spend has run.
  const yearlyDebtExposure = calculateYearlyDebtExposure(derivedYearlyDebtRepayments, notionalSpend.adjustedSavings)
  const debtOverNdiRatio = calculateDebtOverNdiRatio(yearlyDebtExposure, householdNetIncome)
  const debtClassification = classifyDebt(debtOverNdiRatio, ref.debtRatioBands)

  // 5. Profiling (CALC-05).
  const incomeCat = incomeCategory(householdNetIncome, ref.incomeCategoryBands)
  const feesPct = feesBenchmarkPct(householdNetIncome, ref.incomeCategoryBands)
  const propCategory = propertyCategory(input.portfolioType, input.propertyAssets)
  const equityTotals = propertyEquityTotals(input.propertyAssets)
  const propEquityCategory = propertyEquityCategory(equityTotals.totalEquity, ref.propertyEquityBands)
  const netFinEquity = netFinancialEquity(input.cashSavings + input.isasPepsShares, input.debts)
  const finEquityLabel = financialEquityLabel(netFinEquity, ref.financialEquityBands)
  const squeeze = lifestyleSqueeze(
    {
      ndiAfterNotionalSpend: notionalSpend.ndiAfterNotionalSpend,
      householdNetIncome,
      yearlyDebtExposure,
      feesBenchmarkPct: feesPct ?? 0,
    },
    ref.lifestyleSqueezeBands,
  )

  // 6. Award legs (CALC-06).
  // CH-53 — the recipient's own annualFees is no longer an argument: this leg
  // is what the family has available FOR those fees, not what is left after
  // paying them. See actualRemainingDI.
  const actualRemainingDi = actualRemainingDI(
    notionalSpend.ndiAfterNotionalSpend,
    input.siblingPayableFees,
  )
  const theoreticalBenchmarkDi = theoreticalBenchmarkDI(householdNetIncome, category, ref)
  // CH-52 — the affordability leg is capped at the school's full VAT-inclusive
  // fee. `annualFees` is the fee for the year being assessed and is always
  // present, unlike the optional `nextYearFees`, so the cap is always available.
  const affordabilityAdjustedDi = affordabilityAdjustedDI(
    householdNetIncome,
    category,
    ref.affordabilityBands,
    maxPayableFeesInclVat(input.annualFees, input.vatRate),
  )
  const recommendedPayableFeesValue = recommendedPayableFees(
    actualRemainingDi,
    theoreticalBenchmarkDi,
    affordabilityAdjustedDi,
  )

  const summary =
    input.nextYearFees === undefined || input.bursaryAwardBeforeVat === undefined
      ? null
      : awardSummary({
          nextYearFees: input.nextYearFees,
          scholarshipPct: input.scholarshipPct,
          bursaryAwardBeforeVat: input.bursaryAwardBeforeVat,
          vatRate: input.vatRate,
          confirmedPayableFees: input.confirmedPayableFees,
          recommendedPayableFees: recommendedPayableFeesValue,
        })

  return {
    householdNetIncome,
    earnerAggregateIncome,
    manualAdjustment,

    notionalEssentials: lineAmount(notionalSpend.lines, 'essentials'),
    notionalCar: lineAmount(notionalSpend.lines, 'car'),
    notionalPublicTransport: lineAmount(notionalSpend.lines, 'publicTransport'),
    notionalJwfAllowance: lineAmount(notionalSpend.lines, 'jwfAllowance'),
    notionalSavingsBenchmark: lineAmount(notionalSpend.lines, 'notionalSavingsBenchmark'),
    savingsTestNumber: notionalSpend.savingsTestNumber,
    totalNotionalSpend: notionalSpend.totalNotionalSpend,
    ndiAfterNotionalSpend: notionalSpend.ndiAfterNotionalSpend,
    adjustedSavings: notionalSpend.adjustedSavings,
    notionalSpendLines: notionalSpend.lines,

    derivedYearlyDebtRepayments,
    yearlyDebtExposure,
    debtOverNdiRatio,
    debtStatusLabel: debtClassification.statusLabel,
    minRepaymentMonths: debtClassification.minRepaymentMonths,

    incomeCategory: incomeCat,
    propertyCategoryDerived: propCategory,
    propertyEquityCategory: propEquityCategory,
    financialEquityLabel: finEquityLabel,
    lifestyleSqueezeRatio: squeeze.squeezeRatio,
    lifestyleSqueezeLabel: squeeze.statusLabel,
    feesBenchmarkPct: feesPct,

    actualRemainingDi,
    theoreticalBenchmarkDi,
    affordabilityAdjustedDi,
    recommendedPayableFees: recommendedPayableFeesValue,
    awardSummary: summary,
  }
}
