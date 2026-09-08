import { describe, it, expect } from 'vitest'
import {
  calculateDerivedYearlyDebtRepayments,
  calculateYearlyDebtExposure,
  calculateDebtOverNdiRatio,
  classifyDebt,
  savingsVariantFor,
  minRepaymentMonthsWithoutFees,
} from '../debt'
import type { DebtsRecord } from '@/types/assessment-v2'
import {
  debtRatioBandsRespec,
  debtRatioBandsSavingsBelowDebt,
  debtRatioBandsSavingsAboveDebt,
} from '../../../../../prisma/seed-data/profiling-reference'

// ─── calculateDerivedYearlyDebtRepayments (C123) ───────────────────────────
//
// Part 5 respec (Charlotte, 8 Sep 2026): a FIXED five-year horizon, replacing
// the remaining-schooling-years divisor. The figure no longer depends on how
// far through school the pupil is.

describe('calculateDerivedYearlyDebtRepayments', () => {
  it('her worked example: Kaluba £8,000 / 5 = £1,600', () => {
    expect(calculateDerivedYearlyDebtRepayments({ creditCards: 8_000 })).toBe(1_600)
  })

  it('sums every itemised debt line before dividing by five', () => {
    const debts: DebtsRecord = {
      creditCards: 4_000,
      loans: 6_000,
      leaseBalances: 2_000,
      schoolFeesOwedOrOther: 8_000,
    }
    // total 20,000 / 5 years = 4,000
    expect(calculateDerivedYearlyDebtRepayments(debts)).toBe(4_000)
  })

  it('treats missing itemised fields as 0', () => {
    expect(calculateDerivedYearlyDebtRepayments({ loans: 3_000 })).toBe(600)
  })

  it('treats a fully empty debts record as 0', () => {
    expect(calculateDerivedYearlyDebtRepayments({})).toBe(0)
  })

  it.each([
    ['creditCards', 10_000],
    ['loans', 10_000],
    ['leaseBalances', 10_000],
    ['schoolFeesOwedOrOther', 10_000],
  ] as const)('includes %s in the sum', (key, amount) => {
    const debts: DebtsRecord = { [key]: amount }
    expect(calculateDerivedYearlyDebtRepayments(debts)).toBe(2_000)
  })

  it('no longer varies with the remaining schooling years', () => {
    // The old signature took schoolingYearsRemaining and returned 0 at 0 years.
    // Regression guard: the figure is now horizon-independent.
    const debts: DebtsRecord = { loans: 10_000 }
    expect(calculateDerivedYearlyDebtRepayments(debts)).toBe(2_000)
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

// ─── calculateDebtOverNdiRatio (C125) ──────────────────────────────────────
//
// Part 5 respec (Charlotte, 8 Sep 2026): `total debt / 5 / NDI`. Savings are
// no longer netted off — they select the band table instead.

describe('calculateDebtOverNdiRatio', () => {
  it('her worked example: Kaluba 8,000 / 5 / 24,907 = 0.0642', () => {
    expect(calculateDebtOverNdiRatio(8_000, 24_907)).toBeCloseTo(0.0642, 4)
  })

  it('her worked example: the live DW assessment 43,000 / 5 / 5,685 = 1.5127', () => {
    // She quotes 1.5127; the exact value is 1.51275…, which she truncated.
    expect(calculateDebtOverNdiRatio(43_000, 5_685)).toBeCloseTo(1.5127, 3)
  })

  it('returns 0 when householdNetIncome is 0', () => {
    expect(calculateDebtOverNdiRatio(5_000, 0)).toBe(0)
  })

  it('returns 0 when householdNetIncome is negative', () => {
    expect(calculateDebtOverNdiRatio(5_000, -1_000)).toBe(0)
  })

  it('is 0 for a debt-free household regardless of savings', () => {
    // The respec's point: savings no longer move this number at all.
    expect(calculateDebtOverNdiRatio(0, 40_000)).toBe(0)
  })

  it('computes debt over five years as a share of net income', () => {
    // 8,000 / 5 / 40,000 = 0.04
    expect(calculateDebtOverNdiRatio(8_000, 40_000)).toBeCloseTo(0.04)
  })

  it('can exceed 1 for severe debt', () => {
    // 600,000 / 5 / 40,000 = 3
    expect(calculateDebtOverNdiRatio(600_000, 40_000)).toBe(3)
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
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('CH-40 — the smallest positive ratio lands on the first positive band', () => {
    const result = classifyDebt(0.0001, debtRatioBandsRespec)
    expect(result.statusLabel).toBe('SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK')
  })

  it('ZERO DEBT path: a negative ratio also resolves to the zero-debt row', () => {
    const result = classifyDebt(-5, debtRatioBandsRespec)
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
      // Only the top row (floor 1) is open-ended at the top.
      representative = band.ratioFloor + 1_000
    } else {
      representative = (band.ratioFloor + band.ratioCeiling) / 2
    }

    const result = classifyDebt(representative, debtRatioBandsRespec)
    expect(result.statusLabel).toBe(band.statusLabel)
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
  })

  it('falls back to the zero-debt label when no band matches (defensive, e.g. an empty bands array)', () => {
    const result = classifyDebt(2, [])
    expect(result.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })
})

// ─── minRepaymentMonthsWithoutFees (respec, 6 Sep 2026) ────────────────────
//
// Computed per assessment — ((total debt − total savings) / NDI) × 12,
// rounded; negative → null ("not applicable"). No longer a band column.

describe('minRepaymentMonthsWithoutFees', () => {
  it("her Kaluba example: (8,000 − 9,700) / 24,907 × 12 → negative → null ('not applicable')", () => {
    expect(minRepaymentMonthsWithoutFees(8_000, 9_700, 24_907)).toBeNull()
  })

  it('her AJ example: (72,814 − 7,874) / 25,937.50 × 12 = 30.04 → 30', () => {
    expect(minRepaymentMonthsWithoutFees(72_814, 7_874, 25_937.5)).toBe(30)
  })

  it('rounds to the nearest month, not down', () => {
    // (10,000 − 0) / 20,000 × 12 = 6 exactly; nudge the debt to force .5+.
    expect(minRepaymentMonthsWithoutFees(10_000, 0, 20_000)).toBe(6)
    expect(minRepaymentMonthsWithoutFees(10_917, 0, 20_000)).toBe(7) // 6.55
  })

  it('zero months when debt exactly equals savings', () => {
    expect(minRepaymentMonthsWithoutFees(5_000, 5_000, 20_000)).toBe(0)
  })

  it('null when NDI is zero or negative (no meaningful "months of NDI")', () => {
    expect(minRepaymentMonthsWithoutFees(10_000, 0, 0)).toBeNull()
    expect(minRepaymentMonthsWithoutFees(10_000, 0, -2_915)).toBeNull()
  })
})

// ─── Part 5 respec (Charlotte, 8 Sep 2026) — the four commentary tables ─────
//
// Driven from the real seed-data module so the engine and the seed cannot
// drift apart.

describe('savingsVariantFor', () => {
  it('picks the cushioned table when savings exceed debt (her Kaluba case)', () => {
    expect(savingsVariantFor(9_700, 8_000)).toBe('SAVINGS_ABOVE_DEBT')
  })

  it('picks the uncushioned table when debt exceeds savings (her DW case)', () => {
    expect(savingsVariantFor(0, 43_000)).toBe('SAVINGS_BELOW_DEBT')
  })

  it('treats equal savings and debt as uncushioned — nothing is left over', () => {
    expect(savingsVariantFor(8_000, 8_000)).toBe('SAVINGS_BELOW_DEBT')
  })

  it('a debt-free household with any savings is cushioned', () => {
    expect(savingsVariantFor(1, 0)).toBe('SAVINGS_ABOVE_DEBT')
  })

  it('a household with neither savings nor debt is uncushioned (reads ZERO DEBT)', () => {
    expect(savingsVariantFor(0, 0)).toBe('SAVINGS_BELOW_DEBT')
  })
})

describe('classifyDebt — her two savings variants', () => {
  const below = debtRatioBandsSavingsBelowDebt
  const above = debtRatioBandsSavingsAboveDebt

  it('seeds 12 rows per variant', () => {
    expect(below).toHaveLength(12)
    expect(above).toHaveLength(12)
  })

  it('her Kaluba example: ratio 0.0642, savings > debt → cushioned wording', () => {
    const ratio = calculateDebtOverNdiRatio(8_000, 24_907)
    const variant = savingsVariantFor(9_700, 8_000)
    expect(classifyDebt(ratio, [...below, ...above], variant).statusLabel).toBe(
      'SMALL DEBT CUSHIONED BY SAVINGS, NEGLIGIBLE SAVINGS USE',
    )
  })

  it('her DW example: ratio 1.5127, savings < debt → debt spiral', () => {
    const ratio = calculateDebtOverNdiRatio(43_000, 5_685)
    const variant = savingsVariantFor(0, 43_000)
    expect(classifyDebt(ratio, [...below, ...above], variant).statusLabel).toBe(
      'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY',
    )
  })

  it('the same ratio reads differently in each variant', () => {
    const all = [...below, ...above]
    expect(classifyDebt(0.25, all, 'SAVINGS_BELOW_DEBT').statusLabel).toBe(
      'MANAGEABLE DEBT, MEDIUM CREDIT RISK',
    )
    expect(classifyDebt(0.25, all, 'SAVINGS_ABOVE_DEBT').statusLabel).toBe(
      'MANAGEABLE DEBT CUSHIONED BY SAVINGS, MEDIUM SAVINGS USE',
    )
  })

  it('zero debt reads ZERO DEBT uncushioned, but cushioned when savings exist', () => {
    const all = [...below, ...above]
    expect(classifyDebt(0, all, 'SAVINGS_BELOW_DEBT').statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
    expect(classifyDebt(0, all, 'SAVINGS_ABOVE_DEBT').statusLabel).toBe(
      'DEBT CUSHIONED BY SAVINGS, NO CREDIT RISK',
    )
  })

  // Her re-thresholding: uniform 0.1 steps to 1.0, then open-ended. Boundaries
  // stay ceiling-exclusive (CH-40), so each boundary opens its own band.
  it('boundary values resolve to the upper band (ceiling-exclusive)', () => {
    const boundaries: Array<[number, string]> = [
      [0.1, 'MANAGEABLE DEBT, LOW CREDIT RISK'],
      [0.2, 'MANAGEABLE DEBT, MEDIUM CREDIT RISK'],
      [0.3, 'MATERIAL DEBT IMPACT, FAIR CREDIT RISK'],
      [0.4, 'MATERIAL DEBT IMPACT, HIGH CREDIT RISK'],
      [0.5, 'HEAVILY IN DEBT, FAIR CREDIT RISK'],
      [0.6, 'HEAVILY IN DEBT, HIGH CREDIT RISK'],
      [0.7, 'VERY HEAVILY IN DEBT, HIGH CREDIT RISK'],
      [0.8, 'VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK'],
      [0.9, 'DEBT GETTING OUT OF CONTROL, NO SAFETY NET'],
      [1, 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY'],
    ]
    for (const [value, label] of boundaries) {
      expect(classifyDebt(value, below, 'SAVINGS_BELOW_DEBT').statusLabel).toBe(label)
    }
  })

  it('a pre-respec generation (no variant on its rows) still resolves', () => {
    // Rows seeded before the split carry no savingsVariant; asking for the
    // cushioned table must not resolve to nothing.
    expect(classifyDebt(0.25, debtRatioBandsRespec, 'SAVINGS_ABOVE_DEBT').statusLabel).toBeTruthy()
  })
})
