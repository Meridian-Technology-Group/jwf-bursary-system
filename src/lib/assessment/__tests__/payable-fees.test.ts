import { describe, it, expect } from 'vitest'
import { calculatePayableFees } from '../payable-fees'

describe('calculatePayableFees', () => {
  it('calculates standard result with scholarship, bursary, VAT', () => {
    // grossFees = 31752
    // scholarshipDeduction = 31752 * 0.10 = 3175.20
    // netYearlyFees = 31752 - 3175.20 - 10000 = 18576.80
    // vatAmount = 18576.80 * 0.20 = 3715.36
    // yearlyPayableFees = 18576.80 + 3715.36 = 22292.16
    // monthlyPayableFees = 22292.16 / 12 = 1857.68
    // adjustedYearly = 22292.16 + 0 = 22292.16
    // adjustedMonthly = 22292.16 / 12 = 1857.68
    const result = calculatePayableFees(31_752, 10, 10_000, 20, 0)
    expect(result.grossFees).toBe(31_752)
    expect(result.scholarshipDeduction).toBe(3_175.20)
    expect(result.bursaryAward).toBe(10_000)
    expect(result.netYearlyFees).toBe(18_576.80)
    expect(result.vatAmount).toBe(3_715.36)
    expect(result.yearlyPayableFees).toBe(22_292.16)
    expect(result.monthlyPayableFees).toBe(1_857.68)
    expect(result.adjustedYearlyPayableFees).toBe(22_292.16)
    expect(result.adjustedMonthlyPayableFees).toBe(1_857.68)
  })

  it('calculates with zero scholarship', () => {
    // grossFees = 31752, scholarship = 0, bursary = 5000, vat = 20
    // scholarshipDeduction = 0
    // netYearlyFees = 31752 - 0 - 5000 = 26752
    // vatAmount = 26752 * 0.20 = 5350.40
    // yearlyPayableFees = 26752 + 5350.40 = 32102.40
    const result = calculatePayableFees(31_752, 0, 5_000, 20, 0)
    expect(result.scholarshipDeduction).toBe(0)
    expect(result.netYearlyFees).toBe(26_752)
    expect(result.vatAmount).toBe(5_350.40)
    expect(result.yearlyPayableFees).toBe(32_102.40)
  })

  it('returns zero net fees when bursary covers all fees after scholarship', () => {
    // grossFees = 30000, scholarship = 0, bursary = 30000 (full)
    // netYearlyFees = max(0, 30000 - 0 - 30000) = 0
    // vatAmount = 0
    // yearlyPayableFees = 0
    const result = calculatePayableFees(30_000, 0, 30_000, 20, 0)
    expect(result.netYearlyFees).toBe(0)
    expect(result.vatAmount).toBe(0)
    expect(result.yearlyPayableFees).toBe(0)
    expect(result.monthlyPayableFees).toBe(0)
    expect(result.adjustedYearlyPayableFees).toBe(0)
    expect(result.adjustedMonthlyPayableFees).toBe(0)
  })

  it('applies a positive manual adjustment (surcharge)', () => {
    // grossFees = 10000, no scholarship, no bursary, vat = 20
    // netYearlyFees = 10000
    // vatAmount = 2000
    // yearlyPayableFees = 12000
    // adjustedYearly = 12000 + 500 = 12500
    const result = calculatePayableFees(10_000, 0, 0, 20, 500)
    expect(result.yearlyPayableFees).toBe(12_000)
    expect(result.adjustedYearlyPayableFees).toBe(12_500)
    expect(result.adjustedMonthlyPayableFees).toBeCloseTo(12_500 / 12, 2)
  })

  it('applies a negative manual adjustment (discount)', () => {
    // yearlyPayableFees = 12000, manualAdjustment = -1000
    // adjustedYearly = 11000
    const result = calculatePayableFees(10_000, 0, 0, 20, -1_000)
    expect(result.yearlyPayableFees).toBe(12_000)
    expect(result.adjustedYearlyPayableFees).toBe(11_000)
  })

  it('clamps adjustedYearlyPayableFees to 0 when adjustment creates negative', () => {
    // yearlyPayableFees = 1000, manualAdjustment = -5000 => raw = -4000 => clamped to 0
    const result = calculatePayableFees(1_000, 0, 0, 0, -5_000)
    expect(result.adjustedYearlyPayableFees).toBe(0)
    expect(result.adjustedMonthlyPayableFees).toBe(0)
  })

  it('calculates VAT correctly for non-standard rate', () => {
    // grossFees = 20000, no scholarship/bursary, VAT = 15%
    // netYearlyFees = 20000
    // vatAmount = 20000 * 0.15 = 3000
    // yearlyPayableFees = 23000
    const result = calculatePayableFees(20_000, 0, 0, 15, 0)
    expect(result.vatAmount).toBe(3_000)
    expect(result.yearlyPayableFees).toBe(23_000)
  })

  it('monthlyPayableFees equals yearlyPayableFees divided by 12', () => {
    const result = calculatePayableFees(31_752, 0, 0, 20, 0)
    const expectedMonthly = Math.round((result.yearlyPayableFees / 12) * 100) / 100
    expect(result.monthlyPayableFees).toBe(expectedMonthly)
  })

  it('adjustedMonthlyPayableFees equals adjustedYearlyPayableFees divided by 12', () => {
    const result = calculatePayableFees(31_752, 5, 5_000, 20, 600)
    const expectedAdjMonthly = Math.round((result.adjustedYearlyPayableFees / 12) * 100) / 100
    expect(result.adjustedMonthlyPayableFees).toBe(expectedAdjMonthly)
  })

  it('clamps netYearlyFees to 0 when bursary exceeds fees minus scholarship', () => {
    // grossFees = 10000, scholarship = 50% (5000), bursary = 8000
    // raw netYearlyFees = 10000 - 5000 - 8000 = -3000 => clamped to 0
    const result = calculatePayableFees(10_000, 50, 8_000, 20, 0)
    expect(result.netYearlyFees).toBe(0)
    expect(result.vatAmount).toBe(0)
    expect(result.yearlyPayableFees).toBe(0)
  })

  it('handles zero VAT rate', () => {
    const result = calculatePayableFees(20_000, 0, 5_000, 0, 0)
    expect(result.vatAmount).toBe(0)
    expect(result.netYearlyFees).toBe(15_000)
    expect(result.yearlyPayableFees).toBe(15_000)
  })
})
