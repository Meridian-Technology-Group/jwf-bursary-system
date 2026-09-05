import { describe, it, expect } from 'vitest'
import {
  calculateDerivedYearlyDebtRepayments,
  calculateYearlyDebtExposure,
  calculateDebtOverNdiRatio,
  classifyDebt,
} from '../debt'
import type { DebtsRecord } from '@/types/assessment-v2'
import { debtRatioBandsRespec } from '../../../../../prisma/seed-data/profiling-reference'

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
  it('seeds exactly 12 bands (benchmark-bands respec, 5 Sep 2026)', () => {
    expect(debtRatioBandsRespec).toHaveLength(12)
  })

  // CH-40 — ceiling-exclusive per Charlotte (24 Aug 2026), applied to every
  // boundary ABOVE zero.
  //
  // Zero itself is deliberately left on ZERO DEBT, contrary to her literal
  // wording — this is **Q9**. She described ZERO DEBT as "a negative number",
  // but `calculateDebtOverNdiRatio` floors the exposure at zero before dividing
  // (see its own test above, "floors a negative exposure to 0"), so the ratio
  // can never be negative. Following her wording would make ZERO DEBT
  // unreachable and label every debt-free household "SMALL DEBT LEVEL",
  // including one with a large savings surplus. Part 5's reported values are
  // among those she has already signed off, so this is asked, not guessed.
  it('CH-40 / Q9 — a ratio of exactly 0 stays on ZERO DEBT', () => {
    const result = classifyDebt(0, debtRatioBandsRespec)
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('CH-40 — the smallest positive ratio lands on the first positive band', () => {
    const result = classifyDebt(0.0001, debtRatioBandsRespec)
    expect(result.statusLabel).toBe('SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK')
  })

  it('ZERO DEBT path: a negative ratio also resolves to the zero-debt row', () => {
    const result = classifyDebt(-5, debtRatioBandsRespec)
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it.each(
    debtRatioBandsRespec.map((band) => [band.statusLabel, band] as const),
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

    const result = classifyDebt(representative, debtRatioBandsRespec)
    expect(result.statusLabel).toBe(band.statusLabel)
    expect(result.minRepaymentMonths).toBe(band.minRepaymentMonths)
  })

  it('CH-40 — boundary values resolve to the UPPER band (ceiling-exclusive)', () => {
    // Her `<` logic, confirmed 24 Aug 2026: a boundary OPENS its band rather
    // than closing the one below, so every shared boundary in Appendix C.4's
    // normalised ladder now belongs to the band above it.
    const boundaries: Array<{ value: number; upperLabel: string }> = [
      { value: 0.01, upperLabel: 'MANAGEABLE DEBT, LOW CREDIT RISK' },
      { value: 0.03, upperLabel: 'MANAGEABLE DEBT, MEDIUM CREDIT RISK' },
      { value: 0.07, upperLabel: 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK' },
      { value: 0.1, upperLabel: 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK' },
      { value: 0.15, upperLabel: 'HEAVILY IN DEBT, FAIR CREDIT RISK' },
      { value: 0.2, upperLabel: 'HEAVILY IN DEBT, HIGH CREDIT RISK' },
      { value: 0.3, upperLabel: 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK' },
      { value: 0.4, upperLabel: 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK' },
      { value: 0.5, upperLabel: 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET' },
      { value: 1, upperLabel: 'AT RISK OF BANKRUPTCY' },
    ]

    for (const { value, upperLabel } of boundaries) {
      const result = classifyDebt(value, debtRatioBandsRespec)
      expect(result.statusLabel).toBe(upperLabel)
    }
  })

  it('a value just above the top band floor (1) resolves to the open-ended top band', () => {
    const result = classifyDebt(15, debtRatioBandsRespec)
    expect(result.statusLabel).toBe('AT RISK OF BANKRUPTCY')
    expect(result.minRepaymentMonths).toBe(12)
  })

  it('falls back to the zero-debt label when no band matches (defensive, e.g. an empty bands array)', () => {
    const result = classifyDebt(2, [])
    expect(result.minRepaymentMonths).toBeNull()
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })
})
