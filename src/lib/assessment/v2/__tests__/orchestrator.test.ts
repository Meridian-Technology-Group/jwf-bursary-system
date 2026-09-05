import { describe, it, expect } from 'vitest'
import { calculateAssessmentV2, type AssessmentV2Input, type AssessmentV2Output } from '../orchestrator'
import type { ReferenceBundle } from '../types'
import type { AssessorIncomeRecord } from '@/types/assessment-v2'
import {
  notionalCostConfigs,
  savingsCushionRespecConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBandsRespec,
  debtRatioBandsRespec,
  lifestyleSqueezeBandsRespec,
} from '../../../../../prisma/seed-data/profiling-reference'

// Latest cushion generation first — the app bundle is deduped latest-wins
// (`getNotionalCostConfigs`) and `getNotionalCostAmount` is find-first.
const ref: ReferenceBundle = {
  notionalCosts: [...savingsCushionRespecConfigs, ...notionalCostConfigs],
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands: financialEquityBandsRespec,
  debtRatioBands: debtRatioBandsRespec,
  lifestyleSqueezeBands: lifestyleSqueezeBandsRespec,
}

function earner(annualSalaryPaye: number): AssessorIncomeRecord {
  return { employed: { annualSalaryPaye }, total: 0, documentsConfirmed: true }
}

/** Every CALC-02 v2 snapshot column on the `Assessment` model this orchestrator must populate (implementation-plan.md §CALC-02 list). */
const SNAPSHOT_CONTRACT_FIELDS: readonly (keyof AssessmentV2Output)[] = [
  'notionalEssentials',
  'notionalCar',
  'notionalPublicTransport',
  'notionalJwfAllowance',
  'notionalSavingsBenchmark',
  'savingsTestNumber',
  'totalNotionalSpend',
  'ndiAfterNotionalSpend',
  'derivedYearlyDebtRepayments',
  'yearlyDebtExposure',
  'debtOverNdiRatio',
  'debtStatusLabel',
  'incomeCategory',
  'propertyCategoryDerived',
  'propertyEquityCategory',
  'financialEquityLabel',
  'lifestyleSqueezeRatio',
  'lifestyleSqueezeLabel',
  'actualRemainingDi',
  'theoreticalBenchmarkDi',
  'affordabilityAdjustedDi',
  'recommendedPayableFees',
]

function expectContractPopulated(result: AssessmentV2Output) {
  for (const field of SNAPSHOT_CONTRACT_FIELDS) {
    expect(result, `expected "${field}" to be populated (not undefined)`).toHaveProperty(field)
    expect(result[field], `expected "${field}" to not be undefined`).not.toBeUndefined()
  }
}

// ─── Scenario A — modest-income renting family with debts → full-bursary ───

describe('calculateAssessmentV2 — modest-income renting family with debts', () => {
  const input: AssessmentV2Input = {
    earners: [earner(30_000)],
    familyTypeCategory: 2,
    rentAddBackType: 'NONE',
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: false,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 2_000,
    isasPepsShares: 0,
    schoolingYearsRemaining: 5,
    propertyAssets: {},
    portfolioType: 'RENTING',
    debts: { creditCards: 5_000, loans: 3_000 },
    siblingPayableFees: [],
    annualFees: 20_000,
    scholarshipPct: 0,
  }

  const result = calculateAssessmentV2(input, ref)

  it('produces a full-bursary recommendation (recommended payable fees floored at £0)', () => {
    // NDI after notional spend is deeply negative for a £30k income renting
    // family (cat 2) once rent/council-tax/essentials/allowance/savings are
    // deducted — every leg of the min-of-three is negative, so the award
    // floors to £0 (a full-bursary recommendation).
    expect(result.actualRemainingDi).toBeLessThan(0)
    expect(result.theoreticalBenchmarkDi).toBeLessThan(0)
    expect(result.recommendedPayableFees).toBe(0)
  })

  it('household net income is the sum of earner income', () => {
    expect(result.householdNetIncome).toBe(30_000)
  })

  it('wires the TOTAL personal debt into the savings test (C80, respec v3)', () => {
    // Yearly repayments still feed the debt module: (5,000 + 3,000) / 5 = 1,600.
    expect(result.derivedYearlyDebtRepayments).toBe(1_600)
    // savingsTestNumber = (total savings − total debt) − savingsCushion:
    // (2,000 − 8,000) − 39,000 (cat 2). No years dependence.
    expect(result.savingsTestNumber).toBeCloseTo(2_000 - 8_000 - 39_000, 6)
  })

  it('wires adjustedSavings (from the notional-spend module) into yearlyDebtExposure (C124, CALC-A2)', () => {
    expect(result.yearlyDebtExposure).toBeCloseTo(
      result.derivedYearlyDebtRepayments - result.adjustedSavings,
      6,
    )
  })

  it('debt-over-NDI ratio and status label are consistent with a small debt burden', () => {
    // yearlyDebtExposure 1,600 − 400 = 1,200; ratio 1,200/30,000 = 0.04 →
    // the respec's 0.03–0.07 band.
    expect(result.debtOverNdiRatio).toBeCloseTo(0.04, 6)
    expect(result.debtStatusLabel).toBe('MANAGEABLE DEBT, MEDIUM CREDIT RISK')
  })

  it('renting always resolves property category 1 regardless of the (empty) property assets', () => {
    expect(result.propertyCategoryDerived).toBe(1)
  })

  it('populates every CALC-02 snapshot-contract field', () => {
    expectContractPopulated(result)
  })
})

// ─── Scenario B — higher-income homeowner → non-zero payable ──────────────

describe('calculateAssessmentV2 — higher-income single-property homeowner', () => {
  const input: AssessmentV2Input = {
    earners: [earner(90_000)],
    familyTypeCategory: 1,
    rentAddBackType: 'NONE',
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: true,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 50_000,
    isasPepsShares: 20_000,
    schoolingYearsRemaining: 5,
    propertyAssets: { home: { value: 500_000, mortgageBalance: 100_000 } },
    portfolioType: 'SINGLE',
    debts: {},
    siblingPayableFees: [],
    annualFees: 25_000,
    scholarshipPct: 0,
    nextYearFees: 26_000,
    bursaryAwardBeforeVat: 3_000,
    confirmedPayableFees: 23_000,
  }

  const result = calculateAssessmentV2(input, ref)

  it('recommends the ACTUAL leg (min-of-three retired, 5 Sep 2026)', () => {
    expect(result.recommendedPayableFees).toBeGreaterThan(0)
    expect(result.recommendedPayableFees).toBe(result.actualRemainingDi)
    // 90,000 − (19,000 + 2,480 + 8,879 + 3,600 + 1,700 + 3,000 notionals)
    // + 3,300 savings add-back (10% of 70,000 − 37,000) = 54,641.
    expect(result.recommendedPayableFees).toBeCloseTo(54_641, 5)
    // The comparison legs are still computed for display.
    expect(result.theoreticalBenchmarkDi).not.toBeUndefined()
    expect(result.affordabilityAdjustedDi).not.toBeUndefined()
  })

  it('a savings surplus with no debt yields zero debt exposure/ratio', () => {
    expect(result.derivedYearlyDebtRepayments).toBe(0)
    expect(result.yearlyDebtExposure).toBeLessThan(0) // savings surplus, no debt
    expect(result.debtOverNdiRatio).toBe(0)
    expect(result.debtStatusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('classifies the mortgaged single property by its value band', () => {
    // £500k–£800k, mortgaged (equity 400k ≠ value 500k) → category 6.
    expect(result.propertyCategoryDerived).toBe(6)
  })

  it('derives the higher-income category and fees-benchmark %', () => {
    // CH-39 — this household sits in the £90k–£100k band, which was category 7
    // under the workbook's slipped tail and is category 8 now the ladder runs
    // 1..11. The percentage is unchanged; she corrected numbering only.
    expect(result.incomeCategory).toBe(8)
    expect(result.feesBenchmarkPct).toBe(27)
  })

  it('computes the award summary when nextYearFees + bursaryAwardBeforeVat are supplied', () => {
    expect(result.awardSummary).not.toBeNull()
    // CH-36: fees 26,000 before VAT, 0% scholarship, bursary 3,000 before VAT →
    // net 23,000 before VAT, payable 27,600 including VAT.
    expect(result.awardSummary?.scholarshipSpendBeforeVat).toBeCloseTo(0, 5)
    expect(result.awardSummary?.netFeesBeforeVat).toBeCloseTo(23_000, 5)
    expect(result.awardSummary?.yearlyPayableFeesInclVat).toBeCloseTo(27_600, 5)
    expect(result.awardSummary?.gapAmount).toBeCloseTo(23_000 - result.recommendedPayableFees, 5)
  })

  it('populates every CALC-02 snapshot-contract field', () => {
    expectContractPopulated(result)
  })
})

// ─── Award summary omission ─────────────────────────────────────────────────

describe('calculateAssessmentV2 — award summary is null without nextYearFees/bursaryAwardBeforeVat', () => {
  it('leaves awardSummary null when neither is supplied', () => {
    const result = calculateAssessmentV2(
      {
        earners: [earner(40_000)],
        familyTypeCategory: 1,
        rentAddBackType: 'NONE',
        multiPropertyRentAddBack: false,
        councilTaxSupport: false,
        usesCar: false,
        usesPublicTransport: false,
        feeInsuranceAnnual: 0,
        cashSavings: 0,
        isasPepsShares: 0,
        schoolingYearsRemaining: 5,
        propertyAssets: {},
        portfolioType: 'RENTING',
        debts: {},
        siblingPayableFees: [],
        annualFees: 15_000,
        scholarshipPct: 0,
      },
      ref,
    )
    expect(result.awardSummary).toBeNull()
  })
})

// ─── Epic 13 / C2 — the manual income adjustment moves the award ────────────

/**
 * D13-3: the assessor's edit scope is ONE signed adjustment line on household
 * income. Applied at step 1 of the orchestrator (after earner aggregation,
 * before the C40 floor), it flows through notional spend → NDI → the actual
 * leg untouched — and since 5 Sep 2026 the ACTUAL leg IS the recommendation,
 * so the recommended payable fees move by EXACTLY the adjustment, in both
 * directions (as long as the leg stays above the £0 floor, which this
 * scenario guarantees at −£6k, £0 and +£6k).
 */
describe('calculateAssessmentV2 — manual income adjustment (Epic 13 / C2)', () => {
  const scenario = (manualAdjustment: number): AssessmentV2Input => ({
    earners: [earner(90_000)],
    manualAdjustment,
    familyTypeCategory: 1,
    rentAddBackType: 'NONE',
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: true,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 5_000,
    isasPepsShares: 0,
    schoolingYearsRemaining: 5,
    propertyAssets: { home: { value: 400_000, mortgageBalance: 200_000 } },
    portfolioType: 'SINGLE',
    debts: {},
    // CH-53 — a sibling on substantial fees keeps the actual leg well clear
    // of the £0 floor in all three variants (the only way the £-for-£
    // property could break now that the actual leg is always the
    // recommendation).
    siblingPayableFees: [40_000],
    annualFees: 30_000,
    scholarshipPct: 0,
  })

  const baseline = calculateAssessmentV2(scenario(0), ref)
  const added = calculateAssessmentV2(scenario(6_000), ref)
  const deducted = calculateAssessmentV2(scenario(-6_000), ref)

  it('the recommendation is the actual leg in all three variants (above the £0 floor)', () => {
    for (const result of [baseline, added, deducted]) {
      expect(result.recommendedPayableFees).toBe(result.actualRemainingDi)
      expect(result.recommendedPayableFees).toBeGreaterThan(0)
    }
  })

  it('an omitted adjustment leaves household net income at the earner aggregate', () => {
    const noAdjustment = calculateAssessmentV2(
      { ...scenario(0), manualAdjustment: undefined },
      ref,
    )
    expect(noAdjustment.manualAdjustment).toBe(0)
    expect(noAdjustment.householdNetIncome).toBe(90_000)
    expect(noAdjustment.recommendedPayableFees).toBe(baseline.recommendedPayableFees)
  })

  it('a POSITIVE adjustment raises the recommended award by exactly its amount', () => {
    expect(added.householdNetIncome).toBe(96_000)
    expect(added.recommendedPayableFees - baseline.recommendedPayableFees).toBeCloseTo(6_000, 6)
  })

  it('a NEGATIVE adjustment lowers the recommended award by exactly its amount', () => {
    expect(deducted.householdNetIncome).toBe(84_000)
    expect(deducted.recommendedPayableFees - baseline.recommendedPayableFees).toBeCloseTo(-6_000, 6)
  })

  it('carries the earner subtotal and the applied adjustment on the output', () => {
    expect(added.earnerAggregateIncome).toBe(90_000)
    expect(added.manualAdjustment).toBe(6_000)
    expect(deducted.manualAdjustment).toBe(-6_000)
    expect(baseline.earnerAggregateIncome).toBe(baseline.householdNetIncome)
  })

  it('the adjustment reaches the award through NDI, not by a late bolt-on', () => {
    // Every intermediate between income and the actual leg shifts by the same
    // amount — proof the adjustment entered at C40 rather than being added to
    // the award at the end.
    expect(added.ndiAfterNotionalSpend - baseline.ndiAfterNotionalSpend).toBeCloseTo(6_000, 6)
    expect(added.actualRemainingDi - baseline.actualRemainingDi).toBeCloseTo(6_000, 6)
    // Notional spend itself is income-independent, so it must NOT move.
    expect(added.totalNotionalSpend).toBeCloseTo(baseline.totalNotionalSpend, 6)
  })

  it('still populates every CALC-02 snapshot-contract field with an adjustment applied', () => {
    expectContractPopulated(added)
  })
})

// ─── CH-21/22 — manual override passthrough ─────────────────────────────────

describe('calculateAssessmentV2 — CH-21/22 override passthrough', () => {
  const base: AssessmentV2Input = {
    earners: [earner(60_000)],
    familyTypeCategory: 3,
    rentAddBackType: 'FULL_MORTGAGE_FREE',
    multiPropertyRentAddBack: false,
    councilTaxSupport: true,
    usesCar: false,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 0,
    isasPepsShares: 0,
    schoolingYearsRemaining: 5,
    propertyAssets: {},
    portfolioType: 'SINGLE',
    debts: {},
    siblingPayableFees: [],
    annualFees: 20_000,
    scholarshipPct: 0,
  }

  it('omitted overrides = byte-identical output to the pre-override engine', () => {
    const withoutKeys = calculateAssessmentV2(base, ref)
    const withNulls = calculateAssessmentV2(
      { ...base, rentAddBackOverride: null, councilTaxOverride: null },
      ref,
    )
    expect(withNulls).toEqual(withoutKeys)
  })

  it('both overrides flow through to the notional-spend lines and shift the total', () => {
    const derived = calculateAssessmentV2(base, ref)
    const overridden = calculateAssessmentV2(
      { ...base, rentAddBackOverride: 10_000, councilTaxOverride: 1_500 },
      ref,
    )
    const line = (out: AssessmentV2Output, key: string) =>
      out.notionalSpendLines.find((l) => l.key === key)!

    // Cat 3: derived rent add-back 22,000 → 10,000; council tax 2,480 → 1,500
    // (support add-back recharges the overridden figure on both sides).
    expect(line(derived, 'rentAddBack').amount).toBe(22_000)
    expect(line(overridden, 'rentAddBack').amount).toBe(10_000)
    expect(line(overridden, 'councilTax').amount).toBe(1_500)
    expect(line(overridden, 'councilTaxAddBack').amount).toBe(1_500)

    // The only delta in the signed total is the rent add-back change
    // (council-tax deduct + recharge cancel in both runs).
    expect(overridden.totalNotionalSpend).toBeCloseTo(derived.totalNotionalSpend - 12_000, 6)
    expect(overridden.ndiAfterNotionalSpend).toBeCloseTo(derived.ndiAfterNotionalSpend - 12_000, 6)
    expectContractPopulated(overridden)
  })
})
