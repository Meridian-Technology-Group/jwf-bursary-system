import { describe, it, expect } from 'vitest'
import { calculateNetAssets, calculateDerivedSavings } from '../stage2-assets'
import type { SavingsInput } from '../types'

const noSavings: SavingsInput = {
  cashSavings: 0,
  isasPepsShares: 0,
  schoolAgeChildrenCount: 1,
  schoolingYearsRemaining: 5,
}

describe('calculateDerivedSavings', () => {
  it('calculates annualised savings correctly', () => {
    // (12000 + 6000) / 2 children / 3 years = 3000
    expect(calculateDerivedSavings(12_000, 6_000, 2, 3)).toBe(3_000)
  })

  it('returns 0 when schoolingYearsRemaining is 0 (prevents division by zero)', () => {
    expect(calculateDerivedSavings(50_000, 10_000, 2, 0)).toBe(0)
  })

  it('returns 0 when schoolAgeChildrenCount is 0 (prevents division by zero)', () => {
    expect(calculateDerivedSavings(50_000, 10_000, 0, 5)).toBe(0)
  })

  it('returns 0 when both savings are 0', () => {
    expect(calculateDerivedSavings(0, 0, 2, 5)).toBe(0)
  })

  it('handles a single child with 1 year remaining', () => {
    // (10000 + 5000) / 1 / 1 = 15000
    expect(calculateDerivedSavings(10_000, 5_000, 1, 1)).toBe(15_000)
  })

  it('handles only ISAs/PEPs/shares with no cash savings', () => {
    // (0 + 24000) / 2 / 6 = 2000
    expect(calculateDerivedSavings(0, 24_000, 2, 6)).toBe(2_000)
  })
})

describe('calculateNetAssets', () => {
  it('applies standard notional rent deduction for a renting family', () => {
    // income 42000 - rent 18000 - councilTax 2480 + savings 0 = 21520
    const result = calculateNetAssets(42_000, 18_000, false, 0, 2_480, noSavings)
    expect(result).toBe(21_520)
  })

  it('adds notional rent back for a mortgage-free family (no rent deduction)', () => {
    // income 42000 - rent 18000 + rent 18000 (mortgage free) - councilTax 2480 = 39520
    const result = calculateNetAssets(42_000, 18_000, true, 0, 2_480, noSavings)
    expect(result).toBe(39_520)
  })

  it('adds additional property income', () => {
    // income 42000 - rent 18000 + propIncome 6000 - councilTax 2480 = 27520
    const result = calculateNetAssets(42_000, 18_000, false, 6_000, 2_480, noSavings)
    expect(result).toBe(27_520)
  })

  it('adds annualised savings to the result', () => {
    const savings: SavingsInput = {
      cashSavings: 12_000,
      isasPepsShares: 6_000,
      schoolAgeChildrenCount: 2,
      schoolingYearsRemaining: 3,
    }
    // income 42000 - rent 18000 - councilTax 2480 + derivedSavings 3000 = 24520
    const result = calculateNetAssets(42_000, 18_000, false, 0, 2_480, savings)
    expect(result).toBe(24_520)
  })

  it('returns 0 for savings when schoolingYearsRemaining is 0', () => {
    const savings: SavingsInput = {
      cashSavings: 50_000,
      isasPepsShares: 30_000,
      schoolAgeChildrenCount: 2,
      schoolingYearsRemaining: 0,
    }
    // savings contribution = 0, standard calc applies
    // income 30000 - rent 10000 - councilTax 2480 + 0 = 17520
    const result = calculateNetAssets(30_000, 10_000, false, 0, 2_480, savings)
    expect(result).toBe(17_520)
  })

  it('handles zero savings gracefully', () => {
    const result = calculateNetAssets(30_000, 10_000, false, 0, 2_480, noSavings)
    // 30000 - 10000 - 2480 = 17520
    expect(result).toBe(17_520)
  })

  it('can produce a negative result when costs exceed income', () => {
    // Very low income with high rent
    const result = calculateNetAssets(5_000, 15_000, false, 0, 2_480, noSavings)
    // 5000 - 15000 - 2480 = -12480
    expect(result).toBe(-12_480)
  })

  it('combines mortgage-free, additional property income and savings', () => {
    const savings: SavingsInput = {
      cashSavings: 6_000,
      isasPepsShares: 6_000,
      schoolAgeChildrenCount: 1,
      schoolingYearsRemaining: 6,
    }
    // income 80000 - rent 18000 + rent 18000 (mfree) + propIncome 12000 - councilTax 2480 + derivedSavings 2000 = 91520
    const result = calculateNetAssets(80_000, 18_000, true, 12_000, 2_480, savings)
    expect(result).toBe(91_520)
  })
})
