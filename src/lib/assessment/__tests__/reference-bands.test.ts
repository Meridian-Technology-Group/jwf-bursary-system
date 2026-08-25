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

  it('CH-52 — the grid now covers from £0, so low incomes resolve to the 0% band', () => {
    // Her confirmation: 0% applies "for an income from £0 to £29,000". The
    // bottom band's floor dropped from £27,001 to £0 so the table says so
    // instead of leaving it to the engine's shortcut.
    expect(resolveAffordabilityBand(affordabilityBands, 0)?.basePct).toBe(0)
    expect(resolveAffordabilityBand(affordabilityBands, 27_000)?.basePct).toBe(0)
    expect(resolveAffordabilityBand(affordabilityBands, 29_000)?.basePct).toBe(0)
  })

  it('still returns null above the seeded range — the engine holds the top band', () => {
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

  // CH-39 — the CALC-A1 anomaly is retired. The workbook's 7,8,7,8 tail was
  // Charlotte's own slip; she confirmed on 24 Aug 2026 that the categories run
  // 1 to 11 incrementally. £115,000 is now category 10, not 7.
  it('CH-39 — £115,000 resolves to category 10, the anomaly retired', () => {
    const band = resolveIncomeCategoryBand(incomeCategoryBands, 115_000)
    expect(band?.category).toBe(10)
    expect(band?.feesBenchmarkPct).toBe(30)
  })

  it('resolves the full category ladder 1..11, never stepping backwards', () => {
    const points = [
      [10_000, 1],
      [30_000, 2],
      [45_000, 3],
      [55_000, 4],
      [65_000, 5],
      [75_000, 6],
      [85_000, 7],
      [95_000, 8],
      [105_000, 9],
      [115_000, 10],
      [125_000, 11],
    ] as const
    for (const [income, category] of points) {
      expect(resolveIncomeCategoryBand(incomeCategoryBands, income)?.category).toBe(category)
    }
  })

  it('has no upper bound — very high incomes still resolve (to category 12)', () => {
    // CH-54 — the top band is now £140,000+ at category 12.
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 10_000_000)?.category).toBe(12)
  })

  it('CH-54 — the new band boundary at £140,000 splits 11 from 12', () => {
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 130_000)?.category).toBe(11)
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 139_999)?.category).toBe(11)
    expect(resolveIncomeCategoryBand(incomeCategoryBands, 140_000)?.category).toBe(12)
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
    // CH-38 — the coarse 0–50,000 "some savings" band is split; just-positive
    // equity now lands in her "negligible savings" level.
    expect(resolveFinancialEquityBand(financialEquityBands, 0.01)?.label).toBe('negligible savings')
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
  // CH-40 / Q9 — zero and below stay on ZERO DEBT. Her wording put zero in
  // level 1, but the ratio is floored at zero upstream, so following that
  // literally would make ZERO DEBT unreachable. See resolveDebtRatioBand.
  it('keeps zero and negative ratios on ZERO DEBT (Q9 open)', () => {
    expect(resolveDebtRatioBand(debtRatioBands, -1)?.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
    expect(resolveDebtRatioBand(debtRatioBands, 0)?.statusLabel).toBe('ZERO DEBT, NO CREDIT RISK')
  })

  it('CH-40 — the smallest positive ratio is level 1, not ZERO DEBT', () => {
    expect(resolveDebtRatioBand(debtRatioBands, 0.0001)?.statusLabel).toBe(
      'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 1',
    )
  })

  it('resolves shared boundaries toward the UPPER band — ceiling-exclusive', () => {
    // Each boundary now belongs to the band it opens, not the one it closes.
    expect(resolveDebtRatioBand(debtRatioBands, 0.1)?.minRepaymentMonths).toBe(1)
    expect(resolveDebtRatioBand(debtRatioBands, 0.3)?.minRepaymentMonths).toBe(3)
    expect(resolveDebtRatioBand(debtRatioBands, 1)?.minRepaymentMonths).toBe(12)
    expect(resolveDebtRatioBand(debtRatioBands, 10)?.minRepaymentMonths).toBe(120)
  })

  it('keeps values strictly inside a band unaffected by the convention change', () => {
    expect(resolveDebtRatioBand(debtRatioBands, 0.05)?.statusLabel).toBe(
      'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 1',
    )
    expect(resolveDebtRatioBand(debtRatioBands, 0.2)?.statusLabel).toBe(
      'SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 2',
    )
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
