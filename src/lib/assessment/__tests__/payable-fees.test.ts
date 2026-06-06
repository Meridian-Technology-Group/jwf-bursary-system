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

  // ── D8 — VAT applicability (keep current 20% behaviour, configurable) ──────
  describe('VAT (D8)', () => {
    it('applies 20% VAT to the post-bursary net fee (current behaviour)', () => {
      // net = 31752 - 0 - 0 = 31752; vat = 6350.40; yearly = 38102.40
      const result = calculatePayableFees(31_752, 0, 0, 20, 0)
      expect(result.vatAmount).toBe(6_350.40)
      expect(result.yearlyPayableFees).toBe(38_102.40)
    })

    it('emits zero VAT when the rate is 0 (the swap-in if D8 lands "not applied")', () => {
      const result = calculatePayableFees(31_752, 0, 0, 0, 0)
      expect(result.vatAmount).toBe(0)
      expect(result.yearlyPayableFees).toBe(31_752)
    })
  })

  // ── Epic 07 — next-year payable view ────────────────────────────────────────
  describe('next-year payable view (Epic 07)', () => {
    it('returns null next-year fields when nextYearGrossFees is omitted', () => {
      const result = calculatePayableFees(31_752, 0, 5_000, 20, 0)
      expect(result.nextYearGrossFees).toBeNull()
      expect(result.nextYearNetYearlyFees).toBeNull()
      expect(result.nextYearVatAmount).toBeNull()
      expect(result.nextYearYearlyPayableFees).toBeNull()
      expect(result.nextYearMonthlyPayableFees).toBeNull()
    })

    it('current-year result is byte-for-byte unchanged when next-year supplied', () => {
      const without = calculatePayableFees(31_752, 10, 10_000, 20, 0)
      const withNext = calculatePayableFees(31_752, 10, 10_000, 20, 0, 33_340)
      expect(withNext.grossFees).toBe(without.grossFees)
      expect(withNext.netYearlyFees).toBe(without.netYearlyFees)
      expect(withNext.vatAmount).toBe(without.vatAmount)
      expect(withNext.yearlyPayableFees).toBe(without.yearlyPayableFees)
      expect(withNext.monthlyPayableFees).toBe(without.monthlyPayableFees)
      expect(withNext.adjustedYearlyPayableFees).toBe(without.adjustedYearlyPayableFees)
    })

    it('computes next-year payable holding scholarship % + bursary flat (D14 default)', () => {
      // current gross 31752, scholarship 0, bursary 10000, vat 20
      // next gross 33340: net = 33340 - 0 - 10000 = 23340
      // vat = 23340 * 0.20 = 4668; yearly = 28008; monthly = 2334
      const result = calculatePayableFees(31_752, 0, 10_000, 20, 0, 33_340)
      expect(result.nextYearGrossFees).toBe(33_340)
      expect(result.nextYearNetYearlyFees).toBe(23_340)
      expect(result.nextYearVatAmount).toBe(4_668)
      expect(result.nextYearYearlyPayableFees).toBe(28_008)
      expect(result.nextYearMonthlyPayableFees).toBe(2_334)
    })

    it('next-year payable exceeds current-year payable when fees rise (uplift visible)', () => {
      const result = calculatePayableFees(31_752, 0, 10_000, 20, 0, 33_340)
      expect(result.nextYearYearlyPayableFees).toBeGreaterThan(result.yearlyPayableFees)
    })

    it('clamps next-year net to 0 when bursary covers the higher fee too', () => {
      const result = calculatePayableFees(30_000, 0, 35_000, 20, 0, 31_000)
      expect(result.nextYearNetYearlyFees).toBe(0)
      expect(result.nextYearYearlyPayableFees).toBe(0)
      expect(result.nextYearMonthlyPayableFees).toBe(0)
    })

    it('applies the manual adjustment to the next-year payable too', () => {
      // next gross 33340, no scholarship/bursary, vat 0, adj +600
      // net = 33340; yearly before adj = 33340; after adj = 33940
      const result = calculatePayableFees(31_752, 0, 0, 0, 600, 33_340)
      expect(result.nextYearYearlyPayableFees).toBe(33_940)
    })

    // ── D14 — payable monthly is current-year ÷ 12 by default ──────────────────
    it('current-year monthly remains current-year yearly ÷ 12 regardless of next-year fee (D14 default)', () => {
      const result = calculatePayableFees(31_752, 0, 10_000, 20, 0, 33_340)
      const expected = Math.round((result.yearlyPayableFees / 12) * 100) / 100
      expect(result.monthlyPayableFees).toBe(expected)
    })
  })
})
