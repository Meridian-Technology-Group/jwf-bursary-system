import { describe, it, expect } from 'vitest'
import {
  resolveBand,
  resolveAffordabilityBand,
  resolveIncomeCategoryBand,
  resolvePropertyEquityBand,
  resolveFinancialEquityBand,
  resolveDebtRatioBand,
  resolveLifestyleSqueezeBand,
  getNotionalCostAmount,
  theoreticalNotionalTotal,
  getFamilyCategoryMeta,
} from '../reference-bands'
import {
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
  notionalCostConfigs,
  familyCategoryMetas,
} from '../../../../prisma/seed-data/profiling-reference'

describe('resolveBand (generic)', () => {
  it('returns null when no band matches', () => {
    const bands = [{ floor: 0, ceiling: 10 }]
    expect(resolveBand(bands, 20)).toBeNull()
    expect(resolveBand(bands, -1)).toBeNull()
  })

  it('is floor- and ceiling-inclusive by default', () => {
    const bands = [{ floor: 0, ceiling: 10 }]
    expect(resolveBand(bands, 0)).toBe(bands[0])
    expect(resolveBand(bands, 10)).toBe(bands[0])
  })

  it('resolves ties at a shared ceiling toward the lower/earlier band', () => {
    const low = { floor: null, ceiling: 10 }
    const high = { floor: 10, ceiling: 20 }
    // Value sits exactly on the shared boundary (10) — low band wins.
    expect(resolveBand([high, low], 10)).toBe(low)
  })

  it('supports ceilingExclusive mode', () => {
    const bands = [{ floor: 0, ceiling: 10 }]
    expect(resolveBand(bands, 10, { ceilingExclusive: true })).toBeNull()
    expect(resolveBand(bands, 9.999, { ceilingExclusive: true })).toBe(bands[0])
  })

  it('treats a null ceiling as open-ended (sorts last)', () => {
    const bands = [
      { floor: 0, ceiling: 10 },
      { floor: 10, ceiling: null },
    ]
    expect(resolveBand(bands, 1_000_000)).toBe(bands[1])
  })
})

describe('resolveAffordabilityBand (Appendix B)', () => {
  it('resolves the table-8 worked example net income (£32,600) to the 2% band', () => {
    const band = resolveAffordabilityBand(affordabilityBands, 32_600)
    expect(band?.basePct).toBe(2)
  })

  it('resolves band-edge values correctly', () => {
    expect(resolveAffordabilityBand(affordabilityBands, 29_000)?.basePct).toBe(0)
    expect(resolveAffordabilityBand(affordabilityBands, 29_001)?.basePct).toBe(1)
    expect(resolveAffordabilityBand(affordabilityBands, 75_000)?.basePct).toBe(18)
    expect(resolveAffordabilityBand(affordabilityBands, 75_001)?.basePct).toBe(20) // the 18→20 jump
    expect(resolveAffordabilityBand(affordabilityBands, 105_000)?.basePct).toBe(45)
  })

  it('returns null outside the seeded range (CALC-A6 clamp handled by the award engine, not here)', () => {
    expect(resolveAffordabilityBand(affordabilityBands, 27_000)).toBeNull()
    expect(resolveAffordabilityBand(affordabilityBands, 105_001)).toBeNull()
  })
})

describe('resolveIncomeCategoryBand (Appendix C.1)', () => {
  it('is floor-inclusive, ceiling-exclusive', () => {
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 26_999)?.category).toBe(1)
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 27_000)?.category).toBe(2)
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 39_999)?.category).toBe(2)
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 40_000)?.category).toBe(3)
  })

  it('preserves the CALC-A1 anomaly: £115,000 resolves to category 7, not 8', () => {
    const band = resolveIncomeCategoryBand(incomeCategoryBands, 115_000)
    expect(band?.category).toBe(7)
    expect(band?.feesBenchmarkPct).toBe(30)
  })

  it('resolves the full category tail 1,2,3,4,5,6,7,7,8,7,8', () => {
    const points = [
      [10_000, 1],
      [30_000, 2],
      [45_000, 3],
      [55_000, 4],
      [65_000, 5],
      [75_000, 6],
      [85_000, 7],
      [95_000, 7],
      [105_000, 8],
      [115_000, 7],
      [125_000, 8],
    ] as const
    for (const [income, category] of points) {
      expect(resolveIncomeCategoryBand(incomeCategoryBands, income)?.category).toBe(category)
    }
  })

  it('has no upper bound — very high incomes still resolve (to category 8)', () => {
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 10_000_000)?.category).toBe(8)
  })
})

describe('resolvePropertyEquityBand (Appendix C.2)', () => {
  it('classifies zero/negative equity as category 1', () => {
    expect(resolvePropertyEquityBand(propertyEquityBands, -5_000)?.category).toBe(1)
    expect(resolvePropertyEquityBand(propertyEquityBands, 0)?.category).toBe(1)
  })

  it('resolves band-edge values toward the lower band', () => {
    expect(resolvePropertyEquityBand(propertyEquityBands, 50_000)?.category).toBe(2)
    expect(resolvePropertyEquityBand(propertyEquityBands, 50_001)?.category).toBe(3)
  })

  it('has no upper bound — very high equity resolves to category 12', () => {
    expect(resolvePropertyEquityBand(propertyEquityBands, 5_000_000)?.category).toBe(12)
  })
})

describe('resolveFinancialEquityBand (Appendix C.3)', () => {
  it('separates negative, exactly-zero, and just-positive equity', () => {
    expect(resolveFinancialEquityBand(financialEquityBands, -100)?.label).toBe('in debt')
    expect(resolveFinancialEquityBand(financialEquityBands, -0.01)?.label).toBe('in debt')
    expect(resolveFinancialEquityBand(financialEquityBands, 0)?.label).toBe('no debt, no equity')
    expect(resolveFinancialEquityBand(financialEquityBands, 0.01)?.label).toBe('some savings')
  })

  it('resolves the stratospheric levels', () => {
    expect(resolveFinancialEquityBand(financialEquityBands, 700_000)?.label).toBe(
      'stratospheric savings - level 1',
    )
    expect(resolveFinancialEquityBand(financialEquityBands, 2_000_000)?.label).toBe(
      'stratospheric savings - level 4',
    )
  })
})

describe('resolveDebtRatioBand (Appendix C.4, normalised per CALC-A3)', () => {
  it('classifies zero and negative exposure as no credit risk', () => {
    expect(resolveDebtRatioBand(debtRatioBands, 0)?.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
    expect(resolveDebtRatioBand(debtRatioBands, -1)?.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('resolves shared boundaries toward the lower band (0.1, 0.3, 1, 10)', () => {
    expect(resolveDebtRatioBand(debtRatioBands, 0.1)?.minRepaymentMonths).toBe(0) // "<1mo" band, not "1"
    expect(resolveDebtRatioBand(debtRatioBands, 0.3)?.minRepaymentMonths).toBe(1)
    expect(resolveDebtRatioBand(debtRatioBands, 1)?.minRepaymentMonths).toBe(9)
    expect(resolveDebtRatioBand(debtRatioBands, 10)?.minRepaymentMonths).toBe(108)
  })

  it('has no upper bound — very high ratios resolve to the worst band', () => {
    const band = resolveDebtRatioBand(debtRatioBands, 50)
    expect(band?.minRepaymentMonths).toBe(120)
    expect(band?.statusLabel).toBe('VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 4')
  })
})

describe('resolveLifestyleSqueezeBand (Appendix C.5)', () => {
  it('resolves band-edge percentages toward the lower band', () => {
    expect(resolveLifestyleSqueezeBand(lifestyleSqueezeBands, 99)?.statusLabel).toBe(
      'AFFORDABLE, NO IMPACT',
    )
    expect(resolveLifestyleSqueezeBand(lifestyleSqueezeBands, 100)?.statusLabel).toBe(
      'AFFORDABLE, NO IMPACT',
    )
    expect(resolveLifestyleSqueezeBand(lifestyleSqueezeBands, 100.01)?.statusLabel).toBe(
      'SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT',
    )
    expect(resolveLifestyleSqueezeBand(lifestyleSqueezeBands, 170)?.statusLabel).toBe(
      'VERY HIGH LIFESTYLE SQUEEZE, WON\'T MANAGE OVER TIME',
    )
    expect(resolveLifestyleSqueezeBand(lifestyleSqueezeBands, 170.01)?.statusLabel).toBe(
      'SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY',
    )
  })
})

describe('getNotionalCostAmount / theoreticalNotionalTotal (Appendix A, Appendix F)', () => {
  it('looks up a single notional cost line by category', () => {
    expect(getNotionalCostAmount(notionalCostConfigs, 1, 'RENT')).toBe(19_000)
    expect(getNotionalCostAmount(notionalCostConfigs, 6, 'ESSENTIALS')).toBe(27_294.5)
  })

  it('reproduces the Appendix F essentials totals (cat 1→6)', () => {
    const expected = [8_879, 13_398.5, 16_854, 20_341.5, 23_890, 27_294.5]
    expected.forEach((amount, i) => {
      expect(getNotionalCostAmount(notionalCostConfigs, i + 1, 'ESSENTIALS')).toBe(amount)
    })
  })

  it('reproduces the Appendix F theoretical notional totals (cat 1→6)', () => {
    const expected = [37_459, 43_178.5, 50_234, 57_321.5, 64_470, 71_474.5]
    expected.forEach((total, i) => {
      expect(theoreticalNotionalTotal(notionalCostConfigs, i + 1)).toBe(total)
    })
  })

  it('returns null for an unknown category', () => {
    expect(theoreticalNotionalTotal(notionalCostConfigs, 99)).toBeNull()
    expect(getNotionalCostAmount(notionalCostConfigs, 99, 'RENT')).toBeNull()
  })
})

describe('getFamilyCategoryMeta (Appendix A row 1)', () => {
  it('resolves family members and school-age children per category', () => {
    expect(getFamilyCategoryMeta(familyCategoryMetas, 1)).toMatchObject({
      familyMembers: 2,
      schoolAgeChildren: 1,
    })
    expect(getFamilyCategoryMeta(familyCategoryMetas, 6)).toMatchObject({
      familyMembers: 7,
      schoolAgeChildren: 5,
    })
  })

  it('returns null for an unknown category', () => {
    expect(getFamilyCategoryMeta(familyCategoryMetas, 99)).toBeNull()
  })
})
