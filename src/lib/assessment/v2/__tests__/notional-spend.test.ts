import { describe, it, expect } from 'vitest'
import { calculateNotionalSpend } from '../notional-spend'
import type { NotionalSpendInput, ReferenceBundle } from '../types'
import {
  notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
} from '../../../../../prisma/seed-data/profiling-reference'

// Appendix A values, via the real seed-data module (CALC-01) rather than
// re-typed literals — this doubles as a regression guard that the engine and
// the seed stay in sync.
const ref: ReferenceBundle = {
  notionalCosts: notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
}

function baseInput(overrides: Partial<NotionalSpendInput> = {}): NotionalSpendInput {
  return {
    familyTypeCategory: 1,
    netIncome: 42_000,
    rentAddBackType: 'NONE',
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: false,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 0,
    isasPepsShares: 0,
    schoolingYearsRemaining: 5,
    derivedYearlyDebtRepayments: 0,
    ...overrides,
  }
}

function lineByKey(result: ReturnType<typeof calculateNotionalSpend>, key: string) {
  const line = result.lines.find((l) => l.key === key)
  if (!line) throw new Error(`no line for key ${key}`)
  return line
}

describe('calculateNotionalSpend — essentials/category values wired from Appendix A', () => {
  it.each([
    [1, 8_879],
    [2, 13_398.5],
    [3, 16_854],
    [4, 20_341.5],
    [5, 23_890],
    [6, 27_294.5],
  ])('category %s essentials deduction is %s', (category, expected) => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: category }), ref)
    const line = lineByKey(result, 'essentials')
    expect(line.amount).toBe(expected)
    expect(line.direction).toBe('DEDUCTION')
    expect(line.signedAmount).toBe(-expected)
  })

  it('deducts the correct notional rent per category', () => {
    const rentByCategory = [19_000, 19_000, 22_000, 25_000, 28_000, 31_000]
    rentByCategory.forEach((expected, i) => {
      const result = calculateNotionalSpend(baseInput({ familyTypeCategory: i + 1 }), ref)
      expect(lineByKey(result, 'rent').amount).toBe(expected)
    })
  })

  it('always deducts council tax (flat £2,480) and the JWF allowance (flat £1,700)', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 3 }), ref)
    expect(lineByKey(result, 'councilTax').amount).toBe(2_480)
    expect(lineByKey(result, 'jwfAllowance').amount).toBe(1_700)
  })

  it('always deducts the category notional-savings benchmark', () => {
    const benchmarkByCategory = [3_000, 4_500, 6_000, 7_500, 9_000, 10_500]
    benchmarkByCategory.forEach((expected, i) => {
      const result = calculateNotionalSpend(baseInput({ familyTypeCategory: i + 1 }), ref)
      expect(lineByKey(result, 'notionalSavingsBenchmark').amount).toBe(expected)
    })
  })
})

describe('calculateNotionalSpend — rent add-back combinations', () => {
  it('NONE: no add-back', () => {
    const result = calculateNotionalSpend(baseInput({ rentAddBackType: 'NONE' }), ref)
    expect(lineByKey(result, 'rentAddBack').amount).toBe(0)
  })

  it('FULL_MORTGAGE_FREE: adds back 100% of notional rent', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 3, rentAddBackType: 'FULL_MORTGAGE_FREE' }), ref)
    expect(lineByKey(result, 'rentAddBack').amount).toBe(22_000)
    expect(lineByKey(result, 'rentAddBack').signedAmount).toBe(22_000)
  })

  it('FULL_RENT_FREE: adds back 100% of notional rent', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 3, rentAddBackType: 'FULL_RENT_FREE' }), ref)
    expect(lineByKey(result, 'rentAddBack').amount).toBe(22_000)
  })

  it('PARTIAL_LOWER_RENT: adds back 25% of notional rent', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 3, rentAddBackType: 'PARTIAL_LOWER_RENT' }), ref)
    expect(lineByKey(result, 'rentAddBack').amount).toBe(5_500)
  })

  it('multi-property add-back is independent of rentAddBackType and stacks on top', () => {
    const result = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'PARTIAL_LOWER_RENT', multiPropertyRentAddBack: true }),
      ref,
    )
    expect(lineByKey(result, 'rentAddBack').amount).toBe(5_500)
    expect(lineByKey(result, 'multiPropertyRentAddBack').amount).toBe(22_000)
    expect(lineByKey(result, 'multiPropertyRentAddBack').signedAmount).toBe(22_000)
  })

  it('multi-property add-back is 0 when the flag is false, regardless of rentAddBackType', () => {
    const result = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'FULL_MORTGAGE_FREE', multiPropertyRentAddBack: false }),
      ref,
    )
    expect(lineByKey(result, 'multiPropertyRentAddBack').amount).toBe(0)
  })
})

describe('calculateNotionalSpend — CH-21 rent add-back manual override', () => {
  it('a filled override replaces the dropdown-derived figure', () => {
    const result = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'FULL_MORTGAGE_FREE', rentAddBackOverride: 1_234.56 }),
      ref,
    )
    expect(lineByKey(result, 'rentAddBack').amount).toBe(1_234.56)
    expect(lineByKey(result, 'rentAddBack').signedAmount).toBe(1_234.56)
  })

  it('override wins even when the dropdown says NONE', () => {
    const result = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'NONE', rentAddBackOverride: 5_000 }),
      ref,
    )
    expect(lineByKey(result, 'rentAddBack').amount).toBe(5_000)
  })

  it('null / undefined override = the dropdown-derived figure, byte-identical', () => {
    const derived = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'PARTIAL_LOWER_RENT' }),
      ref,
    )
    const withNull = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 3, rentAddBackType: 'PARTIAL_LOWER_RENT', rentAddBackOverride: null }),
      ref,
    )
    expect(withNull).toEqual(derived)
    expect(lineByKey(withNull, 'rentAddBack').amount).toBe(5_500)
  })

  it('invalid overrides (negative, NaN) are ignored — the derived figure applies', () => {
    for (const bad of [-100, Number.NaN]) {
      const result = calculateNotionalSpend(
        baseInput({ familyTypeCategory: 3, rentAddBackType: 'FULL_MORTGAGE_FREE', rentAddBackOverride: bad }),
        ref,
      )
      expect(lineByKey(result, 'rentAddBack').amount).toBe(22_000)
    }
  })

  it('the override touches ONLY C57 — C56 rent and C58 multi-property stay on the reference notional', () => {
    const result = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 3,
        rentAddBackType: 'FULL_MORTGAGE_FREE',
        rentAddBackOverride: 1_000,
        multiPropertyRentAddBack: true,
      }),
      ref,
    )
    expect(lineByKey(result, 'rent').amount).toBe(22_000)
    expect(lineByKey(result, 'rentAddBack').amount).toBe(1_000)
    expect(lineByKey(result, 'multiPropertyRentAddBack').amount).toBe(22_000)
  })
})

describe('calculateNotionalSpend — CH-22 council-tax manual override', () => {
  it('a filled override replaces the reference default on the C59 deduct', () => {
    const result = calculateNotionalSpend(baseInput({ councilTaxOverride: 1_875 }), ref)
    expect(lineByKey(result, 'councilTax').amount).toBe(1_875)
    expect(lineByKey(result, 'councilTax').signedAmount).toBe(-1_875)
  })

  it('the C60 support add-back recharges the OVERRIDDEN figure, still exactly cancelling the deduct', () => {
    const result = calculateNotionalSpend(
      baseInput({ councilTaxOverride: 1_875, councilTaxSupport: true }),
      ref,
    )
    expect(lineByKey(result, 'councilTaxAddBack').amount).toBe(1_875)
    expect(
      lineByKey(result, 'councilTax').signedAmount + lineByKey(result, 'councilTaxAddBack').signedAmount,
    ).toBe(0)
  })

  it('an explicit £0 override is honoured (zero deduct, zero add-back)', () => {
    const result = calculateNotionalSpend(
      baseInput({ councilTaxOverride: 0, councilTaxSupport: true }),
      ref,
    )
    expect(lineByKey(result, 'councilTax').amount).toBe(0)
    expect(lineByKey(result, 'councilTaxAddBack').amount).toBe(0)
  })

  it('null / undefined override = the reference default, byte-identical', () => {
    const derived = calculateNotionalSpend(baseInput(), ref)
    const withNull = calculateNotionalSpend(baseInput({ councilTaxOverride: null }), ref)
    expect(withNull).toEqual(derived)
    expect(lineByKey(withNull, 'councilTax').amount).toBe(2_480)
  })
})

describe('calculateNotionalSpend — council tax support add-back', () => {
  it('adds back full council tax when councilTaxSupport is true', () => {
    const result = calculateNotionalSpend(baseInput({ councilTaxSupport: true }), ref)
    expect(lineByKey(result, 'councilTaxAddBack').amount).toBe(2_480)
    expect(lineByKey(result, 'councilTaxAddBack').signedAmount).toBe(2_480)
  })

  it('adds back nothing when councilTaxSupport is false', () => {
    const result = calculateNotionalSpend(baseInput({ councilTaxSupport: false }), ref)
    expect(lineByKey(result, 'councilTaxAddBack').amount).toBe(0)
  })
})

describe('calculateNotionalSpend — transportation only when the uses* flag is true', () => {
  it('deducts nothing for car/public-transport when both flags are false', () => {
    const result = calculateNotionalSpend(baseInput({ usesCar: false, usesPublicTransport: false }), ref)
    expect(lineByKey(result, 'car').amount).toBe(0)
    expect(lineByKey(result, 'publicTransport').amount).toBe(0)
  })

  it('deducts notional car spend (flat £3,600) only when usesCar is true', () => {
    const result = calculateNotionalSpend(baseInput({ usesCar: true }), ref)
    expect(lineByKey(result, 'car').amount).toBe(3_600)
    expect(lineByKey(result, 'car').signedAmount).toBe(-3_600)
  })

  it('deducts notional public-transport spend by category only when usesPublicTransport is true', () => {
    const ptByCategory = [1_800, 3_000, 3_600, 4_200, 4_800, 5_400]
    ptByCategory.forEach((expected, i) => {
      const result = calculateNotionalSpend(
        baseInput({ familyTypeCategory: i + 1, usesPublicTransport: true }),
        ref,
      )
      expect(lineByKey(result, 'publicTransport').amount).toBe(expected)
    })
  })

  it('deducts both simultaneously when both flags are true', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 2, usesCar: true, usesPublicTransport: true }), ref)
    expect(lineByKey(result, 'car').amount).toBe(3_600)
    expect(lineByKey(result, 'publicTransport').amount).toBe(3_000)
  })
})

describe('calculateNotionalSpend — savings test (Appendix F #7)', () => {
  it('adjustedSavings 5000, debtRepayments 1200, notionalSavings 6000 (cat 3) → test -2200, add-back 0', () => {
    // adjustedSavings = (cashSavings + isasPepsShares) / children / years.
    // Category 3 → schoolAgeChildren 2 (from FamilyCategoryMeta); use 1 year so
    // adjustedSavings = cashSavings + isasPepsShares directly = 5000.
    const result = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 3,
        cashSavings: 10_000,
        isasPepsShares: 0,
        schoolAgeChildrenCount: 2,
        schoolingYearsRemaining: 1,
        derivedYearlyDebtRepayments: 1_200,
      }),
      ref,
    )
    expect(result.adjustedSavings).toBe(5_000)
    expect(result.savingsTestNumber).toBe(-2_200)
    expect(lineByKey(result, 'savingsTestAddBack').amount).toBe(0)
  })

  it('adjustedSavings 12000, debtRepayments 1200, notionalSavings 6000 (cat 3) → test +4800, add-back 4800', () => {
    const result = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 3,
        cashSavings: 12_000,
        isasPepsShares: 0,
        schoolAgeChildrenCount: 1,
        schoolingYearsRemaining: 1,
        derivedYearlyDebtRepayments: 1_200,
      }),
      ref,
    )
    expect(result.adjustedSavings).toBe(12_000)
    expect(result.savingsTestNumber).toBe(4_800)
    expect(lineByKey(result, 'savingsTestAddBack').amount).toBe(4_800)
    expect(lineByKey(result, 'savingsTestAddBack').signedAmount).toBe(4_800)
  })

  it('defaults schoolAgeChildrenCount from FamilyCategoryMeta when not supplied', () => {
    // Category 4 → schoolAgeChildren 3 (Appendix A). adjustedSavings = 30000/3/1 = 10000.
    const result = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 4,
        cashSavings: 30_000,
        isasPepsShares: 0,
        schoolingYearsRemaining: 1,
      }),
      ref,
    )
    expect(result.adjustedSavings).toBe(10_000)
  })

  it('an explicit schoolAgeChildrenCount overrides the FamilyCategoryMeta default', () => {
    const result = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 4,
        cashSavings: 30_000,
        isasPepsShares: 0,
        schoolAgeChildrenCount: 1,
        schoolingYearsRemaining: 1,
      }),
      ref,
    )
    expect(result.adjustedSavings).toBe(30_000)
  })
})

describe('calculateNotionalSpend — fee-insurance add-back', () => {
  it('adds back the full insured amount', () => {
    const result = calculateNotionalSpend(baseInput({ feeInsuranceAnnual: 4_500 }), ref)
    expect(lineByKey(result, 'feeInsuranceAddBack').amount).toBe(4_500)
    expect(lineByKey(result, 'feeInsuranceAddBack').signedAmount).toBe(4_500)
  })

  it('is 0 when there is no insurance', () => {
    const result = calculateNotionalSpend(baseInput({ feeInsuranceAnnual: 0 }), ref)
    expect(lineByKey(result, 'feeInsuranceAddBack').amount).toBe(0)
  })
})

describe('calculateNotionalSpend — totals and NDI sign behaviour', () => {
  it('totalNotionalSpend is the sum of every signed line, and NDI = netIncome + total', () => {
    const result = calculateNotionalSpend(
      baseInput({ familyTypeCategory: 1, netIncome: 42_000, usesCar: true, councilTaxSupport: true }),
      ref,
    )
    const manualTotal = result.lines.reduce((sum, l) => sum + l.signedAmount, 0)
    expect(result.totalNotionalSpend).toBe(manualTotal)
    expect(result.ndiAfterNotionalSpend).toBe(42_000 + result.totalNotionalSpend)
  })

  it('totalNotionalSpend is negative in the normal (no add-backs) case', () => {
    const result = calculateNotionalSpend(baseInput({ familyTypeCategory: 1, netIncome: 42_000 }), ref)
    expect(result.totalNotionalSpend).toBeLessThan(0)
    expect(result.ndiAfterNotionalSpend).toBeLessThan(42_000)
  })

  it('add-backs can push ndiAfterNotionalSpend above what deductions alone would give', () => {
    const withoutAddBacks = calculateNotionalSpend(baseInput({ familyTypeCategory: 3, netIncome: 60_000 }), ref)
    const withAddBacks = calculateNotionalSpend(
      baseInput({
        familyTypeCategory: 3,
        netIncome: 60_000,
        rentAddBackType: 'FULL_MORTGAGE_FREE',
        councilTaxSupport: true,
      }),
      ref,
    )
    expect(withAddBacks.ndiAfterNotionalSpend).toBeGreaterThan(withoutAddBacks.ndiAfterNotionalSpend)
  })

  it('throws when the ReferenceBundle is missing a notional-cost row for the category', () => {
    const brokenRef: ReferenceBundle = { ...ref, notionalCosts: [] }
    expect(() => calculateNotionalSpend(baseInput(), brokenRef)).toThrow()
  })
})
