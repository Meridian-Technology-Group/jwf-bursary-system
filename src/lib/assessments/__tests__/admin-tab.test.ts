// Epic 14 C8 (CG-24, LA-7) — the merged YoY history table.

import { describe, expect, it } from 'vitest'

import { mergeYoyHistory, parsePreSystemHistory } from '../admin-tab'
import type { YoyFinancialsTableRow } from '@/lib/assessment/yoy-financials'

function systemRow(
  academicYear: string,
  netIncome: number,
  savings: number,
  equity: number,
  debt: number,
): YoyFinancialsTableRow {
  return {
    applicationId: `app-${academicYear}`,
    applicationReference: `R-${academicYear}`,
    academicYear,
    totalHouseholdNetIncome: netIncome,
    manualAdjustment: null,
    totalCashSavings: savings,
    totalPropertyEquity: equity,
    yearlyDebtExposure: debt,
    lifestyleSqueezeLabel: 'OK',
    deltaTotalHouseholdNetIncome: null,
    deltaTotalCashSavings: null,
    deltaTotalPropertyEquity: null,
    deltaYearlyDebtExposure: null,
  }
}

describe('mergeYoyHistory', () => {
  it("reproduces Charlotte's example: manual first year n/a, deltas thereafter", () => {
    // Her workbook example rows: 2023/24 (62150/8400/0/5400) then
    // 2024/25 (40200/0/0/8700) with deltas -21950/-8400/0/3300.
    const manual = [
      {
        academicYear: '2023/24',
        netIncome: 62_150,
        savings: 8_400,
        propertyEquity: 0,
        debtExposure: 5_400,
        livingArrangement: null,
        lifestyleSqueeze: null,
      },
      {
        academicYear: '2024/25',
        netIncome: 40_200,
        savings: 0,
        propertyEquity: 0,
        debtExposure: 8_700,
        livingArrangement: 'rent',
        lifestyleSqueeze: 'IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE',
      },
    ]
    const rows = mergeYoyHistory(manual, [])
    expect(rows[0].deltaNetIncome).toBeNull() // n/a first year
    expect(rows[1].deltaNetIncome).toBe(-21_950)
    expect(rows[1].deltaSavings).toBe(-8_400)
    expect(rows[1].deltaPropertyEquity).toBe(0)
    expect(rows[1].deltaDebtExposure).toBe(3_300)
    expect(rows[1].livingArrangement).toBe('rent')
  })

  it('computes deltas across the manual → system seam', () => {
    const manual = [
      { academicYear: '2024/25', netIncome: 40_200, savings: 0, propertyEquity: 0, debtExposure: 8_700 },
    ]
    const system = [systemRow('2025/26', 45_000, 2_000, 0, 6_000)]
    const rows = mergeYoyHistory(manual, system)
    expect(rows.map((r) => r.source)).toEqual(['MANUAL', 'SYSTEM'])
    expect(rows[1].deltaNetIncome).toBe(4_800)
    expect(rows[1].deltaSavings).toBe(2_000)
    expect(rows[1].deltaDebtExposure).toBe(-2_700)
  })

  it('prefers the SYSTEM row on a duplicate academic year', () => {
    const manual = [{ academicYear: '2025/26', netIncome: 1 }]
    const system = [systemRow('2025/26', 45_000, 0, 0, 0)]
    const rows = mergeYoyHistory(manual, system)
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('SYSTEM')
    expect(rows[0].netIncome).toBe(45_000)
  })
})

describe('parsePreSystemHistory', () => {
  it('drops malformed entries and non-arrays defensively', () => {
    expect(parsePreSystemHistory(null)).toEqual([])
    expect(parsePreSystemHistory('junk')).toEqual([])
    expect(
      parsePreSystemHistory([
        { academicYear: '2023/24', netIncome: 100 },
        { netIncome: 5 }, // no year → dropped
        'garbage',
        { academicYear: '   ' }, // blank year → dropped
      ])
    ).toEqual([
      {
        academicYear: '2023/24',
        netIncome: 100,
        savings: null,
        propertyEquity: null,
        debtExposure: null,
        livingArrangement: null,
        lifestyleSqueeze: null,
      },
    ])
  })
})
