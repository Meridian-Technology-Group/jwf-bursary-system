import { describe, it, expect } from 'vitest'
import {
  incomeCategory,
  feesBenchmarkPct,
  propertyEquityTotals,
  propertyCategory,
  propertyEquityCategory,
  netFinancialEquity,
  financialEquityLabel,
  lifestyleSqueeze,
  type PropertyPortfolioType,
} from '../profiling'
import type { PropertyAssetsRecord, DebtsRecord } from '@/types/assessment-v2'
import {
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  lifestyleSqueezeBands,
} from '../../../../../prisma/seed-data/profiling-reference'

// Band rows are driven from the real seed-data module (CALC-01) rather than
// re-typed literals — this doubles as a regression guard that the engine and
// the seed stay in sync (same pattern as notional-spend.test.ts).

describe('incomeCategory / feesBenchmarkPct — Appendix C.1 band boundaries', () => {
  it.each([
    // [netIncome, expectedCategory, expectedPct]
    [0, 1, 2],
    [26_999.99, 1, 2],
    [27_000, 2, 3], // floor-inclusive
    [39_999.99, 2, 3], // ceiling-exclusive: 40,000 itself is the NEXT band
    [40_000, 3, 6],
    [49_999.99, 3, 6],
    [50_000, 4, 10],
    [59_999.99, 4, 10],
    [60_000, 5, 15],
    [69_999.99, 5, 15],
    [70_000, 6, 19],
    [79_999.99, 6, 19],
    [80_000, 7, 23],
    [89_999.99, 7, 23],
    [90_000, 7, 27],
    [99_999.99, 7, 27],
    [100_000, 8, 30],
    [109_999.99, 8, 30],
    // ── CALC-A1 anomaly: £110k–£119,999 maps BACK to category 7 ──
    [110_000, 7, 30],
    [115_000, 7, 30], // the exact vector named in the work-package spec
    [119_999.99, 7, 30],
    [120_000, 8, 30],
    [500_000, 8, 30],
  ])('netIncome %s → category %s, feesBenchmarkPct %s', (netIncome, expectedCategory, expectedPct) => {
    expect(incomeCategory(netIncome, incomeCategoryBands)).toBe(expectedCategory)
    expect(feesBenchmarkPct(netIncome, incomeCategoryBands)).toBe(expectedPct)
  })
})

describe('propertyEquityTotals', () => {
  it('every field is 0 when assets is empty', () => {
    const result = propertyEquityTotals({})
    expect(result).toEqual({ homeEquity: 0, secondEquity: 0, otherEquity: 0, totalEquity: 0, totalValue: 0 })
  })

  it('a missing mortgageBalance within a present block defaults to 0 (full equity)', () => {
    const assets: PropertyAssetsRecord = { home: { value: 200_000 } }
    const result = propertyEquityTotals(assets)
    expect(result.homeEquity).toBe(200_000)
    expect(result.totalEquity).toBe(200_000)
    expect(result.totalValue).toBe(200_000)
  })

  it('a missing block (second/other) contributes 0 to every total', () => {
    const assets: PropertyAssetsRecord = {
      home: { value: 500_000, mortgageBalance: 200_000 },
    }
    const result = propertyEquityTotals(assets)
    expect(result).toEqual({
      homeEquity: 300_000,
      secondEquity: 0,
      otherEquity: 0,
      totalEquity: 300_000,
      totalValue: 500_000,
    })
  })

  it('sums equity and value across all three blocks when present', () => {
    const assets: PropertyAssetsRecord = {
      home: { value: 500_000, mortgageBalance: 200_000 },
      second: { value: 300_000, mortgageBalance: 300_000 },
      other: { value: 100_000, mortgageBalance: 0 },
    }
    const result = propertyEquityTotals(assets)
    expect(result.homeEquity).toBe(300_000)
    expect(result.secondEquity).toBe(0)
    expect(result.otherEquity).toBe(100_000)
    expect(result.totalEquity).toBe(400_000)
    expect(result.totalValue).toBe(900_000)
  })
})

describe('propertyCategory — Appendix C.6 matrix', () => {
  it('RENTING is always category 1, regardless of assets', () => {
    expect(propertyCategory('RENTING', {})).toBe(1)
    expect(propertyCategory('RENTING', { home: { value: 5_000_000, mortgageBalance: 0 } })).toBe(1)
  })

  describe('SINGLE — classifies by `home`', () => {
    it.each([
      // [value, mortgageBalance, expectedCategory] — outright ⇔ mortgageBalance 0 (equity === value)
      [300_000, 100_000, 2], // <360k, mortgaged
      [359_999, 0, 4], // <360k, outright
      [360_000, 100_000, 3], // 360k boundary → 360-500k band, mortgaged
      [450_000, 0, 5], // 360-500k, outright
      [500_000, 100_000, 6], // 500k boundary → 500-800k band, mortgaged
      [700_000, 0, 7], // 500-800k, outright
      [800_000, 100_000, 8], // 800k boundary → 800k-1.2m band, mortgaged
      [1_000_000, 0, 9], // 800k-1.2m, outright
      [1_200_000, 100_000, 10], // 1.2m boundary → top band for SINGLE, mortgaged
      [1_200_000, 0, 11], // top band for SINGLE, outright
      [5_000_000, 500_000, 10], // well above top, mortgaged
      [5_000_000, 0, 11], // well above top, outright
    ])('home value %s, mortgageBalance %s → category %s', (value, mortgageBalance, expected) => {
      const assets: PropertyAssetsRecord = { home: { value, mortgageBalance } }
      expect(propertyCategory('SINGLE', assets)).toBe(expected)
    })

    it('a missing `home` block defaults to value 0 (outright, bottom band → category 4)', () => {
      expect(propertyCategory('SINGLE', {})).toBe(4)
    })
  })

  describe('DOUBLE — classifies by `second`, and continues past 1.2m to 12/13', () => {
    it.each([
      // [value, mortgageBalance, expectedCategory]
      [300_000, 100_000, 2],
      [300_000, 0, 4],
      [400_000, 100_000, 3],
      [400_000, 0, 5],
      [600_000, 100_000, 6],
      [600_000, 0, 7],
      [900_000, 100_000, 8],
      [900_000, 0, 9],
      [1_200_000, 100_000, 10], // 1.2m boundary → 1.2-1.6m band, mortgaged
      [1_500_000, 0, 11], // 1.2-1.6m, outright
      [1_600_000, 100_000, 12], // 1.6m boundary → top band, mortgaged
      [1_600_000, 0, 13], // top band, outright
    ])('second value %s, mortgageBalance %s → category %s', (value, mortgageBalance, expected) => {
      const assets: PropertyAssetsRecord = { second: { value, mortgageBalance } }
      expect(propertyCategory('DOUBLE', assets)).toBe(expected)
    })
  })

  describe('MULTIPLE — classifies by `other`, same bands as DOUBLE', () => {
    it.each([
      // [value, mortgageBalance, expectedCategory]
      [300_000, 100_000, 2],
      [300_000, 0, 4],
      [1_300_000, 200_000, 10],
      [1_300_000, 0, 11],
      [2_000_000, 500_000, 12],
      [2_000_000, 0, 13],
    ])('other value %s, mortgageBalance %s → category %s', (value, mortgageBalance, expected) => {
      const assets: PropertyAssetsRecord = { other: { value, mortgageBalance } }
      expect(propertyCategory('MULTIPLE', assets)).toBe(expected)
    })

    it('ignores `home`/`second` blocks when portfolio type is MULTIPLE', () => {
      const assets: PropertyAssetsRecord = {
        home: { value: 5_000_000, mortgageBalance: 0 },
        other: { value: 300_000, mortgageBalance: 300_000 },
      }
      expect(propertyCategory('MULTIPLE', assets)).toBe(2)
    })
  })

  it('the full 1–13 category range is reachable across portfolio types', () => {
    const reached = new Set<number>()
    reached.add(propertyCategory('RENTING', {}))
    const single: [number, number][] = [
      [300_000, 100_000],
      [400_000, 100_000],
      [300_000, 0],
      [400_000, 0],
      [600_000, 100_000],
      [600_000, 0],
      [900_000, 100_000],
      [900_000, 0],
      [1_300_000, 100_000],
      [1_300_000, 0],
    ]
    for (const [value, mortgageBalance] of single) {
      reached.add(propertyCategory('SINGLE', { home: { value, mortgageBalance } }))
    }
    reached.add(propertyCategory('DOUBLE', { second: { value: 1_700_000, mortgageBalance: 200_000 } }))
    reached.add(propertyCategory('DOUBLE', { second: { value: 1_700_000, mortgageBalance: 0 } }))

    expect(Array.from(reached).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })
})

describe('propertyEquityCategory — Appendix C.2 boundaries', () => {
  it.each([
    [-1, 1],
    [0, 1], // "0" is its own row (category 1), per the appendix's own "0→1"
    [0.01, 2],
    [50_000, 2], // shared boundary resolves to the LOWER band
    [50_000.01, 3],
    [75_000, 3],
    [75_000.01, 4],
    [100_000, 4],
    [100_000.01, 5],
    [150_000, 5],
    [150_000.01, 6],
    [250_000, 6],
    [250_000.01, 7],
    [400_000, 7],
    [400_000.01, 8],
    [600_000, 8],
    [600_000.01, 9],
    [900_000, 9],
    [900_000.01, 10],
    [1_200_000, 10],
    [1_200_000.01, 11],
    [1_600_000, 11],
    [1_600_000.01, 12],
    [10_000_000, 12],
  ])('totalEquity %s → category %s', (equity, expected) => {
    expect(propertyEquityCategory(equity, propertyEquityBands)).toBe(expected)
  })
})

describe('netFinancialEquity', () => {
  it('subtracts every itemised debt from cash and savings', () => {
    const debts: DebtsRecord = { creditCards: 1_000, loans: 2_000, leaseBalances: 500, schoolFeesOwedOrOther: 300 }
    expect(netFinancialEquity(10_000, debts)).toBe(6_200)
  })

  it('missing debt fields contribute 0', () => {
    expect(netFinancialEquity(10_000, {})).toBe(10_000)
    expect(netFinancialEquity(10_000, { creditCards: 4_000 })).toBe(6_000)
  })

  it('can go negative when debts exceed cash and savings', () => {
    expect(netFinancialEquity(1_000, { loans: 5_000 })).toBe(-4_000)
  })
})

describe('financialEquityLabel — Appendix C.3 boundaries', () => {
  it.each([
    [-1, 'in debt'],
    [-0.01, 'in debt'],
    [0, 'no debt, no equity'],
    [0.01, 'some savings'],
    [50_000, 'some savings'], // shared boundary → lower band
    [50_000.01, 'fair savings'],
    [75_000, 'fair savings'],
    [75_000.01, 'decent savings'],
    [100_000, 'decent savings'],
    [100_000.01, 'large savings'],
    [150_000, 'large savings'],
    [150_000.01, 'high savings'],
    [250_000, 'high savings'],
    [250_000.01, 'very high savings'],
    [400_000, 'very high savings'],
    [400_000.01, 'extremely high savings'],
    [600_000, 'extremely high savings'],
    [600_000.01, 'stratospheric savings - level 1'],
    [900_000, 'stratospheric savings - level 1'],
    [900_000.01, 'stratospheric savings - level 2'],
    [1_200_000, 'stratospheric savings - level 2'],
    [1_200_000.01, 'stratospheric savings - level 3'],
    [1_600_000, 'stratospheric savings - level 3'],
    [1_600_000.01, 'stratospheric savings - level 4'],
  ])('netFinancialEquity %s → %s', (value, expected) => {
    expect(financialEquityLabel(value, financialEquityBands)).toBe(expected)
  })
})

describe('lifestyleSqueeze', () => {
  // Harness: with householdNetIncome=100, ndiAfterNotionalSpend=100 and
  // yearlyDebtExposure=0 (so postDebtLifestyleSpend = 100), squeezeRatio
  // reduces algebraically to exactly `feesBenchmarkPct` — see the worked
  // comment in profiling.ts. This lets each Appendix C.5 status band be
  // hit with a clean, self-documenting ratio value.
  function ratioHarness(ratio: number) {
    return lifestyleSqueeze(
      {
        ndiAfterNotionalSpend: 100,
        householdNetIncome: 100,
        yearlyDebtExposure: 0,
        feesBenchmarkPct: ratio,
      },
      lifestyleSqueezeBands,
    )
  }

  it.each([
    [50, 'AFFORDABLE, NO IMPACT'],
    [99.99, 'AFFORDABLE, NO IMPACT'],
    [100, 'AFFORDABLE, NO IMPACT'], // shared boundary → lower band
    [100.01, 'SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT'],
    [110, 'SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT'],
    [120, 'SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT'],
    [120.01, 'NOTICEABLE LIFESTYLE SQUEEZE, SOME IMPACT'],
    [130, 'NOTICEABLE LIFESTYLE SQUEEZE, SOME IMPACT'],
    [140, 'NOTICEABLE LIFESTYLE SQUEEZE, SOME IMPACT'],
    [140.01, 'IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE'],
    [150, 'IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE'],
    [150.01, "VERY HIGH LIFESTYLE SQUEEZE, WON'T MANAGE OVER TIME"],
    [160, "VERY HIGH LIFESTYLE SQUEEZE, WON'T MANAGE OVER TIME"],
    [170, "VERY HIGH LIFESTYLE SQUEEZE, WON'T MANAGE OVER TIME"],
    [170.01, 'SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY'],
    [500, 'SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY'],
  ])('squeezeRatio %s%% → %s', (ratio, expectedLabel) => {
    const result = ratioHarness(ratio)
    expect(result.squeezeRatio).toBeCloseTo(ratio, 6)
    expect(result.statusLabel).toBe(expectedLabel)
  })

  it('computes ndiOverIncomePct and postDebtLifestylePct as percentages', () => {
    const result = lifestyleSqueeze(
      {
        ndiAfterNotionalSpend: 20_000,
        householdNetIncome: 40_000,
        yearlyDebtExposure: 5_000,
        feesBenchmarkPct: 19,
      },
      lifestyleSqueezeBands,
    )
    expect(result.ndiOverIncomePct).toBeCloseTo(50, 6) // 20,000 / 40,000
    expect(result.postDebtLifestylePct).toBeCloseTo(37.5, 6) // (20,000 − 5,000) / 40,000
    expect(result.feesBenchmarkAmount).toBeCloseTo(7_600, 6) // 19% of 40,000
  })

  it('÷0 guard: householdNetIncome 0 → ndiOverIncomePct and postDebtLifestylePct are null, feesBenchmarkAmount is 0', () => {
    const result = lifestyleSqueeze(
      {
        ndiAfterNotionalSpend: 10_000,
        householdNetIncome: 0,
        yearlyDebtExposure: 2_000,
        feesBenchmarkPct: 19,
      },
      lifestyleSqueezeBands,
    )
    expect(result.ndiOverIncomePct).toBeNull()
    expect(result.postDebtLifestylePct).toBeNull()
    expect(result.feesBenchmarkAmount).toBe(0)
    // postDebtLifestyleSpend (10,000 − 2,000 = 8,000) is non-zero, so the
    // squeeze ratio is still computable even though the household has no
    // net income on record.
    expect(result.squeezeRatio).not.toBeNull()
  })

  it('÷0 guard: ndiAfterNotionalSpend === yearlyDebtExposure → squeezeRatio and statusLabel are null', () => {
    const result = lifestyleSqueeze(
      {
        ndiAfterNotionalSpend: 5_000,
        householdNetIncome: 40_000,
        yearlyDebtExposure: 5_000,
        feesBenchmarkPct: 19,
      },
      lifestyleSqueezeBands,
    )
    expect(result.squeezeRatio).toBeNull()
    expect(result.statusLabel).toBeNull()
    // The income-denominator percentages are unaffected by this guard.
    expect(result.ndiOverIncomePct).toBeCloseTo(12.5, 6)
    expect(result.postDebtLifestylePct).toBe(0)
  })

  it('÷0 guard: both denominators zero → every ratio/percentage is null except feesBenchmarkAmount', () => {
    const result = lifestyleSqueeze(
      { ndiAfterNotionalSpend: 0, householdNetIncome: 0, yearlyDebtExposure: 0, feesBenchmarkPct: 19 },
      lifestyleSqueezeBands,
    )
    expect(result.ndiOverIncomePct).toBeNull()
    expect(result.postDebtLifestylePct).toBeNull()
    expect(result.squeezeRatio).toBeNull()
    expect(result.statusLabel).toBeNull()
    expect(result.feesBenchmarkAmount).toBe(0)
  })
})

// Sanity: the exported union type covers exactly the portfolio types the
// property-category matrix branches on (compile-time check via usage above,
// plus a runtime smoke test that TypeScript would reject an invalid value).
describe('PropertyPortfolioType', () => {
  it('accepts all four workbook portfolio types', () => {
    const types: PropertyPortfolioType[] = ['RENTING', 'SINGLE', 'DOUBLE', 'MULTIPLE']
    for (const t of types) {
      expect(() => propertyCategory(t, {})).not.toThrow()
    }
  })
})
