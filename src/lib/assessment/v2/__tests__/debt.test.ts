import { describe, it, expect } from 'vitest'
import {
  calculateDerivedYearlyDebtRepayments,
  calculateYearlyDebtExposure,
  calculateDebtOverNdiRatio,
  classifyDebt,
} from '../debt'
import type { DebtsRecord } from '@/types/assessment-v2'
import { debtRatioBands } from '../../../../../prisma/seed-data/profiling-reference'

// ─── calculateDerivedYearlyDebtRepayments (C123) ───────────────────────────

describe('calculateDerivedYearlyDebtRepayments', () => {
  it('returns 0 when schoolingYearsRemaining is 0', () => {
    const debts: DebtsRecord = { creditCards: 5_000 }
    expect(calculateDerivedYearlyDebtRepayments(debts, 0)).toBe(0)
  })

  it('returns 0 when schoolingYearsRemaining is negative', () => {
    const debts: DebtsRecord = { creditCards: 5_000, loans: 1_000 }
    expect(calculateDerivedYearlyDebtRepayments(debts, -3)).toBe(0)
  })

  it('sums every itemised debt line before dividing by years', () => {
    const debts: DebtsRecord = {
      creditCards: 4_000,
      loans: 6_000,
      leaseBalances: 2_000,
      schoolFeesOwedOrOther: 8_000,
    }
    // total 20,000 / 5 years = 4,000
    expect(calculateDerivedYearlyDebtRepayments(debts, 5)).toBe(4_000)
  })

  it('treats missing itemised fields as 0', () => {
    const debts: DebtsRecord = { loans: 3_000 }
    expect(calculateDerivedYearlyDebtRepayments(debts, 3)).toBe(1_000)
  })

  it('treats a fully empty debts record as 0', () => {
    expect(calculateDerivedYearlyDebtRepayments({}, 5)).toBe(0)
  })

  it.each([
    ['creditCards', 10_000],
    ['loans', 10_000],
    ['leaseBalances', 10_000],
    ['schoolFeesOwedOrOther', 10_000],
  ] as const)('includes %s in the sum', (key, amount) => {
    const debts: DebtsRecord = { [key]: amount }
    expect(calculateDerivedYearlyDebtRepayments(debts, 2)).toBe(5_000)
  })
})

// ─── calculateYearlyDebtExposure (C124, ASSUMPTION CALC-A2) ────────────────

describe('calculateYearlyDebtExposure', () => {
  it('nets repayments off adjusted savings', () => {
    expect(calculateYearlyDebtExposure(1_200, 5_000)).toBe(-3_800)
  })

  it('can be positive when repayments exceed savings', () => {
    expect(calculateYearlyDebtExposure(8_000, 2_000)).toBe(6_000)
  })

  it('is not floored — a savings surplus yields a negative exposure', () => {
    expect(calculateYearlyDebtExposure(0, 12_000)).toBe(-12_000)
  })

  it('is zero when repayments exactly equal savings', () => {
    expect(calculateYearlyDebtExposure(5_000, 5_000)).toBe(0)
  })
})

// ─── calculateDebtOverNdiRatio (C125, ASSUMPTION CALC-A2) ──────────────────

describe('calculateDebtOverNdiRatio', () => {
  it('returns 0 when householdNetIncome is 0', () => {
    expect(calculateDebtOverNdiRatio(5_000, 0)).toBe(0)
  })

  it('returns 0 when householdNetIncome is negative', () => {
    expect(calculateDebtOverNdiRatio(5_000, -1_000)).toBe(0)
  })

  it('floors a negative exposure to 0 before dividing', () => {
    expect(calculateDebtOverNdiRatio(-4_000, 40_000)).toBe(0)
  })

  it('computes the ratio of positive exposure over net income', () => {
    // 8,000 / 40,000 = 0.2
    expect(calculateDebtOverNdiRatio(8_000, 40_000)).toBeCloseTo(0.2)
  })

  it('can exceed 1 for severe debt exposure', () => {
    // 120,000 / 40,000 = 3
    expect(calculateDebtOverNdiRatio(120_000, 40_000)).toBe(3)
  })
})

// ─── classifyDebt (Appendix C.4, ASSUMPTION CALC-A3) ───────────────────────
//
// Driven from the real seed-data module (`prisma/seed-data/profiling-reference.ts`)
// so the engine and the seed can't silently drift apart — asserting against
// re-typed literals here would not catch a change to the seed's band edges.

describe('classifyDebt — against every seeded DebtRatioBand row', () => {
  it('seeds exactly 16 bands (Appendix C.4)', () => {
    expect(debtRatioBands).toHaveLength(16)
  })

  it('ZERO DEBT path: ratio of exactly 0 resolves to the null-months zero-debt row', () => {
    const result = classifyDebt(0, debtRatioBands)
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('ZERO DEBT path: a negative ratio also resolves to the zero-debt row', () => {
    const result = classifyDebt(-5, debtRatioBands)
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it.each(
    debtRatioBands.map((band) => [band.statusLabel, band] as const),
  )('classifies a representative ratio inside "%s"', (_label, band) => {
    // Pick a value strictly inside the band where possible; for the
    // open-ended top/bottom rows, pick a value comfortably past the one
    // finite bound.
    let representative: number
    if (band.ratioFloor === null) {
      // Only the ZERO DEBT row (ceiling 0) is open-ended at the bottom.
      representative = band.ratioCeiling as number
    } else if (band.ratioCeiling === null) {
      // Only the top row (floor 10) is open-ended at the top.
      representative = band.ratioFloor + 1_000
    } else {
      representative = (band.ratioFloor + band.ratioCeiling) / 2
    }

    const result = classifyDebt(representative, debtRatioBands)
    expect(result.statusLabel).toBe(band.statusLabel)
    expect(result.minRepaymentMonths).toBe(band.minRepaymentMonths)
  })

  it('boundary values resolve to the LOWER of two adjacent bands (shared-ceiling convention)', () => {
    // Every shared boundary in Appendix C.4's normalised ladder: the band
    // whose ceiling equals the boundary wins (ascending-ceiling, first
    // match, both ends inclusive) — see reference-bands.ts's documented
    // convention.
    const boundaries: Array<{ value: number; lowerLabel: string }> = [
      { value: 0.1, lowerLabel: 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 1' },
      { value: 0.3, lowerLabel: 'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 2' },
      { value: 0.5, lowerLabel: 'MANAGEABLE DEBT, LOW CREDIT RISK - level 1' },
      { value: 0.8, lowerLabel: 'MANAGEABLE DEBT, LOW CREDIT RISK - level 2' },
      { value: 1, lowerLabel: 'MANAGEABLE DEBT, MEDIUM CREDIT RISK - level 1' },
      { value: 2, lowerLabel: 'MANAGEABLE DEBT, MEDIUM CREDIT RISK - level 2' },
      { value: 3, lowerLabel: 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK - level 1' },
      { value: 4, lowerLabel: 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK - level 2' },
      { value: 5, lowerLabel: 'HEAVILY IN DEBT, HIGH CREDIT RISK - level 1' },
      { value: 6, lowerLabel: 'HEAVILY IN DEBT, HIGH CREDIT RISK - level 2' },
      { value: 7, lowerLabel: 'HEAVILY IN DEBT, HIGH CREDIT RISK - level 3' },
      { value: 8, lowerLabel: 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 1' },
      { value: 9, lowerLabel: 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 2' },
      { value: 10, lowerLabel: 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 3' },
    ]

    for (const { value, lowerLabel } of boundaries) {
      const result = classifyDebt(value, debtRatioBands)
      expect(result.statusLabel).toBe(lowerLabel)
    }
  })

  it('a value just above the top band floor (10) resolves to the open-ended top band', () => {
    const result = classifyDebt(15, debtRatioBands)
    expect(result.statusLabel).toBe('VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 4')
    expect(result.minRepaymentMonths).toBe(120)
  })

  it('falls back to the zero-debt label when no band matches (defensive, e.g. an empty bands array)', () => {
    const result = classifyDebt(2, [])
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })
})
