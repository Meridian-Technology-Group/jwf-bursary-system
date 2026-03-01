import { describe, it, expect } from 'vitest'
import { calculateHouseholdIncome } from '../stage1-income'
import type { EarnerInput } from '../types'

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

describe('calculateHouseholdIncome', () => {
  it('calculates income for a single PAYE earner', () => {
    const earners: EarnerInput[] = [makeEarner({ netPay: 30_000 })]
    expect(calculateHouseholdIncome(earners)).toBe(30_000)
  })

  it('sums income for two PAYE earners', () => {
    const earners: EarnerInput[] = [
      makeEarner({ earnerLabel: 'PARENT_1', netPay: 28_000 }),
      makeEarner({ earnerLabel: 'PARENT_2', netPay: 14_000 }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(42_000)
  })

  it('includes net dividends for a self-employed director', () => {
    const earners: EarnerInput[] = [
      makeEarner({
        employmentStatus: 'SELF_EMPLOYED_DIRECTOR',
        netPay: 12_000,
        netDividends: 25_000,
      }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(37_000)
  })

  it('counts benefitsIncluded in income for a benefits-only earner', () => {
    const earners: EarnerInput[] = [
      makeEarner({
        employmentStatus: 'BENEFITS',
        benefitsIncluded: 7_500,
      }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(7_500)
  })

  it('handles mixed earners: one PAYE and one self-employed sole trader', () => {
    const earners: EarnerInput[] = [
      makeEarner({ earnerLabel: 'PARENT_1', netPay: 35_000 }),
      makeEarner({
        earnerLabel: 'PARENT_2',
        employmentStatus: 'SELF_EMPLOYED_SOLE',
        netSelfEmployedProfit: 18_000,
      }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(53_000)
  })

  it('returns 0 for a zero-income earner', () => {
    const earners: EarnerInput[] = [makeEarner({ employmentStatus: 'UNEMPLOYED' })]
    expect(calculateHouseholdIncome(earners)).toBe(0)
  })

  it('returns 0 when earners array is empty', () => {
    expect(calculateHouseholdIncome([])).toBe(0)
  })

  it('does NOT include benefitsExcluded in income', () => {
    const earners: EarnerInput[] = [
      makeEarner({
        netPay: 20_000,
        benefitsIncluded: 3_000,
        benefitsExcluded: 5_000, // child disability benefits — must NOT be counted
      }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(23_000)
  })

  it('sums all income streams for a single earner correctly', () => {
    const earners: EarnerInput[] = [
      makeEarner({
        employmentStatus: 'SELF_EMPLOYED_DIRECTOR',
        netPay: 10_000,
        netDividends: 15_000,
        netSelfEmployedProfit: 5_000,
        pensionAmount: 2_000,
        benefitsIncluded: 1_500,
        benefitsExcluded: 3_000, // excluded — should not appear in result
      }),
    ]
    // 10000 + 15000 + 5000 + 2000 + 1500 = 33500
    expect(calculateHouseholdIncome(earners)).toBe(33_500)
  })

  it('clamps result to 0 if income fields are all 0', () => {
    // Confirms the min-0 clamp works even with explicit zero values
    const earners: EarnerInput[] = [makeEarner()]
    expect(calculateHouseholdIncome(earners)).toBe(0)
  })

  it('handles pensionAmount for old age pension earner', () => {
    const earners: EarnerInput[] = [
      makeEarner({ employmentStatus: 'OLD_AGE_PENSION', pensionAmount: 9_500 }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(9_500)
  })

  it('handles past pension earner', () => {
    const earners: EarnerInput[] = [
      makeEarner({
        employmentStatus: 'PAST_PENSION',
        pensionAmount: 14_000,
        netPay: 6_000,
      }),
    ]
    expect(calculateHouseholdIncome(earners)).toBe(20_000)
  })
})
