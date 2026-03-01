import { describe, it, expect } from 'vitest'
import { calculateAssessment } from '../calculator'
import type { AssessmentInput, EarnerInput } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEarner(overrides: Partial<EarnerInput> = {}): EarnerInput {
  return {
    earnerLabel: 'PARENT_1',
    employmentStatus: 'PAYE',
    netPay: 0,
    netDividends: 0,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 0,
    benefitsExcluded: 0,
    ...overrides,
  }
}

const baseInput: AssessmentInput = {
  earners: [],
  familyTypeCategory: 1,
  notionalRent: 0,
  utilityCosts: 0,
  foodCosts: 0,
  annualFees: 31_752,
  councilTax: 2_480,
  schoolingYearsRemaining: 6,
  isMortgageFree: false,
  additionalPropertyIncome: 0,
  cashSavings: 0,
  isasPepsShares: 0,
  schoolAgeChildrenCount: 1,
  scholarshipPct: 0,
  vatRate: 20,
  manualAdjustment: 0,
  siblingPayableFees: [],
}

// ─── Okafor Family ────────────────────────────────────────────────────────────

describe('Okafor Family (Category 3, two PAYE parents, renting, Whitgift Year 7)', () => {
  /**
   * Parent 1: PAYE, netPay = £28,000
   * Parent 2: PAYE, netPay = £14,000
   * Stage 1: totalIncome = 42,000
   * notionalRent = 18,000, isMortgageFree = false
   * councilTax = 2,480
   * Stage 2: 42000 - 18000 - 2480 + 0 (savings) = 21,520
   * utilityCosts = 2,000, foodCosts = 8,500
   * Stage 3: 21520 - 2000 - 8500 = 11,020
   * annualFees = 31,752
   * Stage 4: requiredBursary = 31752 - 11020 = 20,732
   * scholarshipPct = 0, vatRate = 20
   * netYearlyFees = 31752 - 0 - 20732 = 11,020
   * vatAmount = 11020 * 0.20 = 2,204
   * yearlyPayableFees = 11020 + 2204 = 13,224
   * monthlyPayableFees = 13224 / 12 = 1,102
   */
  const okaforInput: AssessmentInput = {
    ...baseInput,
    earners: [
      makeEarner({ earnerLabel: 'PARENT_1', netPay: 28_000 }),
      makeEarner({ earnerLabel: 'PARENT_2', netPay: 14_000 }),
    ],
    familyTypeCategory: 3,
    notionalRent: 18_000,
    utilityCosts: 2_000,
    foodCosts: 8_500,
    councilTax: 2_480,
    annualFees: 31_752,
    schoolingYearsRemaining: 6,
    isMortgageFree: false,
    additionalPropertyIncome: 0,
    cashSavings: 0,
    isasPepsShares: 0,
    schoolAgeChildrenCount: 2,
    scholarshipPct: 0,
    vatRate: 20,
    manualAdjustment: 0,
    siblingPayableFees: [],
  }

  it('calculates Stage 1 total household income correctly', () => {
    const result = calculateAssessment(okaforInput)
    expect(result.stages.stage1_totalHouseholdNetIncome).toBe(42_000)
  })

  it('calculates Stage 2 net assets correctly', () => {
    const result = calculateAssessment(okaforInput)
    // 42000 - 18000 - 2480 = 21520 (no savings since 2 children / 6 years but savings = 0)
    expect(result.stages.stage2_netAssetsYearlyValuation).toBe(21_520)
  })

  it('calculates Stage 3 HNDI after necessary spend correctly', () => {
    const result = calculateAssessment(okaforInput)
    // 21520 - 2000 - 8500 = 11020
    expect(result.stages.stage3_hndiAfterNS).toBe(11_020)
  })

  it('calculates Stage 4 required bursary as partial', () => {
    const result = calculateAssessment(okaforInput)
    // 31752 - 11020 = 20732
    expect(result.stages.stage4_requiredBursary).toBe(20_732)
  })

  it('yields positive payable fees (family pays something)', () => {
    const result = calculateAssessment(okaforInput)
    expect(result.payableFees.yearlyPayableFees).toBeGreaterThan(0)
    expect(result.payableFees.monthlyPayableFees).toBeGreaterThan(0)
  })

  it('calculates net yearly fees correctly', () => {
    const result = calculateAssessment(okaforInput)
    // 31752 - 0 (scholarship) - 20732 (bursary) = 11020
    expect(result.payableFees.netYearlyFees).toBe(11_020)
  })

  it('calculates VAT correctly', () => {
    const result = calculateAssessment(okaforInput)
    // 11020 * 0.20 = 2204
    expect(result.payableFees.vatAmount).toBe(2_204)
  })

  it('calculates yearly payable fees', () => {
    const result = calculateAssessment(okaforInput)
    // 11020 + 2204 = 13224
    expect(result.payableFees.yearlyPayableFees).toBe(13_224)
  })

  it('calculates monthly payable fees', () => {
    const result = calculateAssessment(okaforInput)
    // 13224 / 12 = 1102
    expect(result.payableFees.monthlyPayableFees).toBe(1_102)
  })
})

// ─── Williams Family ──────────────────────────────────────────────────────────

describe('Williams Family (sole parent with benefits, sibling link)', () => {
  /**
   * Parent 1: PAYE, netPay = £18,000, benefitsIncluded = £3,600
   * Stage 1 total income = 21,600
   * Category 1: notionalRent = 13,000, utilityCosts = 1,200, foodCosts = 5,000
   * councilTax = 2,480
   *
   * Stage 2 (same for both children):
   *   21600 - 13000 - 2480 = 6,120
   * Stage 3:
   *   6120 - 1200 - 5000 = -80  (just below zero)
   */

  const williamsEarners: EarnerInput[] = [
    makeEarner({
      earnerLabel: 'PARENT_1',
      employmentStatus: 'PAYE',
      netPay: 18_000,
      benefitsIncluded: 3_600,
    }),
  ]

  const williamsBase = {
    ...baseInput,
    earners: williamsEarners,
    familyTypeCategory: 1,
    notionalRent: 13_000,
    utilityCosts: 1_200,
    foodCosts: 5_000,
    councilTax: 2_480,
    isMortgageFree: false,
    additionalPropertyIncome: 0,
    cashSavings: 0,
    isasPepsShares: 0,
    vatRate: 20,
    manualAdjustment: 0,
  }

  /**
   * Child 1 (WS-2501, Year 9, 4 years remaining):
   * Stage 1: 21600
   * Stage 2: 21600 - 13000 - 2480 = 6120
   * Stage 3: 6120 - 1200 - 5000 = -80
   * Stage 4: requiredBursary = clamp(31752 - (-80), 0, 31752) = 31752 (full bursary)
   * netYearlyFees = 31752 - 0 - 31752 = 0
   * vatAmount = 0
   * yearlyPayableFees = 0
   * monthlyPayableFees = 0
   */
  const child1Input: AssessmentInput = {
    ...williamsBase,
    annualFees: 31_752,
    schoolingYearsRemaining: 4,
    schoolAgeChildrenCount: 1,
    scholarshipPct: 0,
    siblingPayableFees: [],
  }

  describe('Child 1 (WS-2501, Year 9)', () => {
    it('calculates household income correctly', () => {
      const result = calculateAssessment(child1Input)
      expect(result.stages.stage1_totalHouseholdNetIncome).toBe(21_600)
    })

    it('calculates Stage 2 net assets', () => {
      const result = calculateAssessment(child1Input)
      // 21600 - 13000 - 2480 = 6120
      expect(result.stages.stage2_netAssetsYearlyValuation).toBe(6_120)
    })

    it('calculates Stage 3 HNDI as slightly negative', () => {
      const result = calculateAssessment(child1Input)
      // 6120 - 1200 - 5000 = -80
      expect(result.stages.stage3_hndiAfterNS).toBe(-80)
    })

    it('awards full bursary when HNDI is negative', () => {
      const result = calculateAssessment(child1Input)
      expect(result.stages.stage4_requiredBursary).toBe(31_752)
    })

    it('results in zero payable fees for Child 1 (full bursary)', () => {
      const result = calculateAssessment(child1Input)
      expect(result.payableFees.netYearlyFees).toBe(0)
      expect(result.payableFees.yearlyPayableFees).toBe(0)
      expect(result.payableFees.monthlyPayableFees).toBe(0)
    })
  })

  /**
   * Child 2 (TS-2601, Year 7, 6 years remaining):
   * HNDI after Stage 3 = -80
   * Sibling deduction: Child 1's yearly payable fees = 0
   * adjustedHndi = -80 - 0 = -80
   * Stage 4: requiredBursary = 30702 (full bursary)
   * netYearlyFees = 30702 - 0 - 30702 = 0
   * yearlyPayableFees = 0
   */
  describe('Child 2 (TS-2601, Year 7, sibling deduction applied)', () => {
    // Child 1 payable fees = 0 (full bursary), so sibling deduction doesn't change result
    const child2Input: AssessmentInput = {
      ...williamsBase,
      annualFees: 30_702,
      schoolingYearsRemaining: 6,
      schoolAgeChildrenCount: 1,
      scholarshipPct: 0,
      siblingPayableFees: [0], // Child 1's yearly payable fees
    }

    it('applies sibling deduction from Child 1 payable fees', () => {
      const result = calculateAssessment(child2Input)
      // HNDI after siblings = -80 - 0 = -80 (sibling had zero payable fees)
      expect(result.stages.stage3_hndiAfterNS).toBe(-80)
    })

    it('awards near-full (full) bursary for Child 2', () => {
      const result = calculateAssessment(child2Input)
      expect(result.stages.stage4_requiredBursary).toBe(30_702)
    })

    it('results in zero payable fees for Child 2', () => {
      const result = calculateAssessment(child2Input)
      expect(result.payableFees.yearlyPayableFees).toBe(0)
      expect(result.payableFees.monthlyPayableFees).toBe(0)
    })
  })

  describe('Child 2 with a sibling who has meaningful payable fees', () => {
    /**
     * Simulate a case where Child 1 had partial bursary and pays £5,000/year.
     * HNDI = -80
     * Sibling deduction: -80 - 5000 = -5080
     * Stage 4: requiredBursary = clamp(30702 - (-5080), 0, 30702) = 30702 (still full)
     */
    const child2WithSiblingFees: AssessmentInput = {
      ...williamsBase,
      annualFees: 30_702,
      schoolingYearsRemaining: 6,
      schoolAgeChildrenCount: 1,
      scholarshipPct: 0,
      siblingPayableFees: [5_000],
    }

    it('deducts sibling fees from HNDI before Stage 4', () => {
      const result = calculateAssessment(child2WithSiblingFees)
      // HNDI starts at -80, minus 5000 sibling fees = -5080
      // requiredBursary = clamp(30702 - (-5080), 0, 30702) = 30702
      expect(result.stages.stage4_requiredBursary).toBe(30_702)
      expect(result.payableFees.yearlyPayableFees).toBe(0)
    })
  })
})

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('Edge case: zero income family', () => {
  /**
   * A family with no income whatsoever.
   * Stage 1: 0
   * Stage 2: 0 - 10000 - 2480 = -12480
   * Stage 3: -12480 - 1500 - 6000 = -19980
   * Stage 4: requiredBursary = min(fees, max(0, fees - hndi)) = annualFees = 31752
   */
  const zeroIncomeInput: AssessmentInput = {
    ...baseInput,
    earners: [makeEarner({ employmentStatus: 'UNEMPLOYED' })],
    notionalRent: 10_000,
    utilityCosts: 1_500,
    foodCosts: 6_000,
    annualFees: 31_752,
    councilTax: 2_480,
    schoolAgeChildrenCount: 1,
    schoolingYearsRemaining: 6,
    scholarshipPct: 0,
    vatRate: 20,
    manualAdjustment: 0,
    siblingPayableFees: [],
  }

  it('awards full bursary to a zero-income family', () => {
    const result = calculateAssessment(zeroIncomeInput)
    expect(result.stages.stage1_totalHouseholdNetIncome).toBe(0)
    expect(result.stages.stage4_requiredBursary).toBe(31_752)
    expect(result.payableFees.yearlyPayableFees).toBe(0)
    expect(result.payableFees.monthlyPayableFees).toBe(0)
  })
})

describe('Edge case: high income family (no bursary needed)', () => {
  /**
   * A very high-income family — bursary should be 0.
   * Stage 1: 150,000
   * Stage 2: 150000 - 18000 - 2480 = 129,520
   * Stage 3: 129520 - 2000 - 8500 = 119,020
   * Stage 4: 119020 >= 31752 => requiredBursary = 0
   * netYearlyFees = 31752
   * vatAmount = 31752 * 0.20 = 6350.40
   * yearlyPayableFees = 31752 + 6350.40 = 38102.40
   */
  const highIncomeInput: AssessmentInput = {
    ...baseInput,
    earners: [
      makeEarner({ earnerLabel: 'PARENT_1', netPay: 90_000 }),
      makeEarner({ earnerLabel: 'PARENT_2', netPay: 60_000 }),
    ],
    notionalRent: 18_000,
    utilityCosts: 2_000,
    foodCosts: 8_500,
    annualFees: 31_752,
    councilTax: 2_480,
    schoolAgeChildrenCount: 1,
    schoolingYearsRemaining: 6,
    scholarshipPct: 0,
    vatRate: 20,
    manualAdjustment: 0,
    siblingPayableFees: [],
  }

  it('results in zero required bursary for a high-income family', () => {
    const result = calculateAssessment(highIncomeInput)
    expect(result.stages.stage1_totalHouseholdNetIncome).toBe(150_000)
    expect(result.stages.stage4_requiredBursary).toBe(0)
  })

  it('calculates full fees (no reduction) for high-income family', () => {
    const result = calculateAssessment(highIncomeInput)
    expect(result.payableFees.bursaryAward).toBe(0)
    expect(result.payableFees.netYearlyFees).toBe(31_752)
    expect(result.payableFees.vatAmount).toBe(6_350.40)
    expect(result.payableFees.yearlyPayableFees).toBe(38_102.40)
  })
})

describe('Edge case: mortgage-free family with high savings', () => {
  /**
   * A mortgage-free family with significant savings.
   * Parent 1: PAYE, netPay = 35,000
   * Stage 1: 35,000
   * isMortgageFree = true, notionalRent = 15,000
   * Stage 2:
   *   35000 - 15000 + 15000 (mfree) - 2480 + derivedSavings
   *   cashSavings = 60000, isas = 24000, 1 child, 6 years
   *   derivedSavings = (60000 + 24000) / 1 / 6 = 14000
   *   = 35000 - 2480 + 14000 = 46,520
   * Stage 3: 46520 - 1500 - 5000 = 40,020
   * Stage 4: 40020 >= 31752 => requiredBursary = 0
   */
  const mortgageFreeInput: AssessmentInput = {
    ...baseInput,
    earners: [makeEarner({ earnerLabel: 'PARENT_1', netPay: 35_000 })],
    notionalRent: 15_000,
    isMortgageFree: true,
    additionalPropertyIncome: 0,
    utilityCosts: 1_500,
    foodCosts: 5_000,
    annualFees: 31_752,
    councilTax: 2_480,
    cashSavings: 60_000,
    isasPepsShares: 24_000,
    schoolAgeChildrenCount: 1,
    schoolingYearsRemaining: 6,
    scholarshipPct: 0,
    vatRate: 20,
    manualAdjustment: 0,
    siblingPayableFees: [],
  }

  it('stage 1 income is correct', () => {
    const result = calculateAssessment(mortgageFreeInput)
    expect(result.stages.stage1_totalHouseholdNetIncome).toBe(35_000)
  })

  it('stage 2 adds rent back for mortgage-free and includes derived savings', () => {
    const result = calculateAssessment(mortgageFreeInput)
    // 35000 - 15000 + 15000 - 2480 + 14000 = 46520
    expect(result.stages.stage2_netAssetsYearlyValuation).toBe(46_520)
  })

  it('stage 3 HNDI after costs', () => {
    const result = calculateAssessment(mortgageFreeInput)
    // 46520 - 1500 - 5000 = 40020
    expect(result.stages.stage3_hndiAfterNS).toBe(40_020)
  })

  it('awards zero bursary to mortgage-free family with high savings', () => {
    const result = calculateAssessment(mortgageFreeInput)
    expect(result.stages.stage4_requiredBursary).toBe(0)
    expect(result.payableFees.bursaryAward).toBe(0)
  })

  it('full fees are payable (no bursary discount)', () => {
    const result = calculateAssessment(mortgageFreeInput)
    expect(result.payableFees.netYearlyFees).toBe(31_752)
    expect(result.payableFees.yearlyPayableFees).toBe(38_102.40)
  })
})

describe('Scholarship interaction', () => {
  /**
   * A partial scholarship reduces gross fees before bursary deduction.
   * Parent 1: PAYE, netPay = 25,000
   * Stage 1: 25,000
   * Stage 2: 25000 - 10000 - 2480 = 12,520
   * Stage 3: 12520 - 1500 - 4000 = 7,020
   * annualFees = 20,000, scholarship = 25%
   * Stage 4 uses annualFees = 20,000:
   *   requiredBursary = clamp(20000 - 7020, 0, 20000) = 12,980
   * scholarshipDeduction = 20000 * 0.25 = 5000
   * netYearlyFees = 20000 - 5000 - 12980 = 2020
   * vatAmount = 2020 * 0.20 = 404
   * yearlyPayableFees = 2020 + 404 = 2424
   * monthlyPayableFees = 2424 / 12 = 202
   */
  const scholarshipInput: AssessmentInput = {
    ...baseInput,
    earners: [makeEarner({ earnerLabel: 'PARENT_1', netPay: 25_000 })],
    notionalRent: 10_000,
    utilityCosts: 1_500,
    foodCosts: 4_000,
    annualFees: 20_000,
    councilTax: 2_480,
    schoolAgeChildrenCount: 1,
    schoolingYearsRemaining: 6,
    scholarshipPct: 25,
    vatRate: 20,
    manualAdjustment: 0,
    siblingPayableFees: [],
  }

  it('scholarship deduction is applied to gross fees', () => {
    const result = calculateAssessment(scholarshipInput)
    expect(result.payableFees.scholarshipDeduction).toBe(5_000)
  })

  it('calculates bursary against full annual fees (not post-scholarship)', () => {
    const result = calculateAssessment(scholarshipInput)
    // requiredBursary = 20000 - 7020 = 12980
    expect(result.stages.stage4_requiredBursary).toBe(12_980)
  })

  it('net yearly fees are reduced by both scholarship and bursary', () => {
    const result = calculateAssessment(scholarshipInput)
    // 20000 - 5000 - 12980 = 2020
    expect(result.payableFees.netYearlyFees).toBe(2_020)
  })

  it('calculates correct final payable fees', () => {
    const result = calculateAssessment(scholarshipInput)
    expect(result.payableFees.vatAmount).toBe(404)
    expect(result.payableFees.yearlyPayableFees).toBe(2_424)
    expect(result.payableFees.monthlyPayableFees).toBe(202)
  })
})

describe('Manual adjustment', () => {
  it('positive manual adjustment increases payable fees', () => {
    const input: AssessmentInput = {
      ...baseInput,
      earners: [makeEarner({ netPay: 15_000 })],
      notionalRent: 8_000,
      utilityCosts: 1_200,
      foodCosts: 4_000,
      annualFees: 31_752,
      councilTax: 2_480,
      schoolAgeChildrenCount: 1,
      schoolingYearsRemaining: 5,
      scholarshipPct: 0,
      vatRate: 20,
      manualAdjustment: 600,
      siblingPayableFees: [],
    }
    const result = calculateAssessment(input)
    expect(result.payableFees.adjustedYearlyPayableFees).toBe(
      result.payableFees.yearlyPayableFees + 600,
    )
  })

  it('negative manual adjustment decreases payable fees', () => {
    const input: AssessmentInput = {
      ...baseInput,
      earners: [makeEarner({ netPay: 15_000 })],
      notionalRent: 8_000,
      utilityCosts: 1_200,
      foodCosts: 4_000,
      annualFees: 31_752,
      councilTax: 2_480,
      schoolAgeChildrenCount: 1,
      schoolingYearsRemaining: 5,
      scholarshipPct: 0,
      vatRate: 20,
      manualAdjustment: -500,
      siblingPayableFees: [],
    }
    const result = calculateAssessment(input)
    expect(result.payableFees.adjustedYearlyPayableFees).toBe(
      Math.max(0, result.payableFees.yearlyPayableFees - 500),
    )
  })
})
