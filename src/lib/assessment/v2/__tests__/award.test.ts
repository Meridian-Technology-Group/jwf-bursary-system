import { describe, it, expect } from 'vitest'
import {
  actualRemainingDI,
  theoreticalBenchmarkDI,
  affordabilityAdjustedDI,
  recommendedPayableFees,
  awardSummary,
} from '../award'
import { theoreticalNotionalTotal } from '../../reference-bands'
import type { ReferenceBundle } from '../types'
import {
  notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
} from '../../../../../prisma/seed-data/profiling-reference'

// Real seed-data module (CALC-01), like the sibling CALC-03/04/05 test files —
// this doubles as a regression guard against the engine and the seed drifting
// apart.
const ref: ReferenceBundle = {
  notionalCosts: notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
}

const CATEGORIES = [1, 2, 3, 4, 5, 6] as const

// ─── actualRemainingDI (C154) ───────────────────────────────────────────────

describe('actualRemainingDI', () => {
  it('deducts sibling fees (sequentially) then this pupil\'s annual fees', () => {
    // NDI 50,000; siblings 10,000 + 5,000; annual fees 20,000 → 50000-10000-5000-20000 = 15000
    expect(actualRemainingDI(50_000, [10_000, 5_000], 20_000)).toBe(15_000)
  })

  it('matches applySiblingDeductions ordering semantics with no siblings', () => {
    expect(actualRemainingDI(40_000, [], 15_000)).toBe(25_000)
  })

  it('can go negative when fees exceed remaining NDI', () => {
    expect(actualRemainingDI(10_000, [8_000], 5_000)).toBe(-3_000)
  })
})

// ─── theoreticalBenchmarkDI (C156) — Appendix F vectors 3 + 4 ──────────────

describe('theoreticalBenchmarkDI — Appendix F vector 3 (theoretical notional totals)', () => {
  it.each([
    [1, 37_459],
    [2, 43_178.5],
    [3, 50_234],
    [4, 57_321.5],
    [5, 64_470],
    [6, 71_474.5],
  ])('category %s theoretical notional total is %s', (category, expected) => {
    expect(theoreticalNotionalTotal(ref.notionalCosts, category)).toBe(expected)
  })
})

describe('theoreticalBenchmarkDI — Appendix F vector 4 (net income £32,600)', () => {
  it.each([
    [1, -7_859],
    [2, -15_078.5],
    [3, -23_634],
    [4, -32_221.5],
    [5, -40_870],
    [6, -49_374.5],
  ])('category %s theoretical available cash is %s', (category, expected) => {
    expect(theoreticalBenchmarkDI(32_600, category, ref)).toBeCloseTo(expected, 5)
  })

  it('throws when the ReferenceBundle is missing notional-cost rows for the category', () => {
    const brokenRef: ReferenceBundle = { ...ref, notionalCosts: [] }
    expect(() => theoreticalBenchmarkDI(32_600, 1, brokenRef)).toThrow()
  })

  it('includes BOTH transport modes unconditionally (LINKED NOTIONALS G47), unlike the actual leg', () => {
    // The theoretical total already includes PUBLIC_TRANSPORT + CAR
    // unconditionally (see the vector-3 total assertions above); prove the
    // divergence from the actual leg concretely: stripping PUBLIC_TRANSPORT
    // out of the category's theoretical total changes the result, so the
    // theoretical leg is NOT silently gated by a `usesPublicTransport`-style
    // flag the way `notional-spend.ts`'s `publicTransport` deduction is.
    const withTransport = theoreticalBenchmarkDI(32_600, 2, ref)
    const publicTransportAmount =
      ref.notionalCosts.find((c) => c.category === 2 && c.costType === 'PUBLIC_TRANSPORT')?.amount ?? 0
    const strippedRef: ReferenceBundle = {
      ...ref,
      notionalCosts: ref.notionalCosts.filter((c) => !(c.category === 2 && c.costType === 'PUBLIC_TRANSPORT')),
    }
    expect(() => theoreticalBenchmarkDI(32_600, 2, strippedRef)).toThrow()
    expect(publicTransportAmount).toBeGreaterThan(0)
    expect(withTransport).toBeLessThan(32_600) // sanity: the total deducts a positive amount
  })
})

// ─── affordabilityAdjustedDI (C158) — Appendix F vector 4 + A6 + grid steps ─

describe('affordabilityAdjustedDI — Appendix F vector 4 (net income £32,600, band 32,001–35,000 → base 2%)', () => {
  it.each([
    [1, 652],
    [2, 489],
    [3, 326],
    [4, 163],
    [5, 0],
    [6, -163],
  ])('category %s affordability-adjusted DI is %s', (category, expected) => {
    expect(affordabilityAdjustedDI(32_600, category, ref.affordabilityBands)).toBeCloseTo(expected, 5)
  })
})

describe('affordabilityAdjustedDI — ASSUMPTION(CALC-A6) edge cases', () => {
  it('net income exactly £27,000 (at/below the bottom band) → £0 outright', () => {
    expect(affordabilityAdjustedDI(27_000, 1, ref.affordabilityBands)).toBe(0)
  })

  it('net income £27,001 (bottom band, 0% base) → £0 via the normal grid path', () => {
    expect(affordabilityAdjustedDI(27_001, 1, ref.affordabilityBands)).toBe(0)
  })

  it('net income exactly £105,000 (top band, 45% base) resolves via the normal grid', () => {
    expect(affordabilityAdjustedDI(105_000, 1, ref.affordabilityBands)).toBeCloseTo(105_000 * 0.45, 5)
  })

  it('net income £200,000 (above the top band ceiling) holds the top band\'s basePct', () => {
    // Top band basePct 45, category 1 → no adjustment.
    expect(affordabilityAdjustedDI(200_000, 1, ref.affordabilityBands)).toBeCloseTo(200_000 * 0.45, 5)
  })

  it('net income £200,000 still applies the category adjustment on top of the held basePct', () => {
    // basePct 45 - 0.5*(6-1) = 42.5%
    expect(affordabilityAdjustedDI(200_000, 6, ref.affordabilityBands)).toBeCloseTo(200_000 * 0.425, 5)
  })
})

describe('affordabilityAdjustedDI — non-uniform grid steps', () => {
  it('£75,001 → 20% (the 18→20 jump at £75k)', () => {
    expect(affordabilityAdjustedDI(75_001, 1, ref.affordabilityBands)).toBeCloseTo(75_001 * 0.2, 5)
  })

  it('£103,500 → 45%', () => {
    expect(affordabilityAdjustedDI(103_500, 1, ref.affordabilityBands)).toBeCloseTo(103_500 * 0.45, 5)
  })
})

describe('affordabilityAdjustedDI — category adjustment can go negative', () => {
  it('category 6 in the 0% band → -2.5%, a negative £ figure', () => {
    expect(affordabilityAdjustedDI(29_000, 6, ref.affordabilityBands)).toBeCloseTo(29_000 * -0.025, 5)
  })
})

// ─── recommendedPayableFees (C160) — Appendix F vector 5 ───────────────────

describe('recommendedPayableFees — Appendix F vector 5 (award floor)', () => {
  it.each(CATEGORIES)(
    'category %s: with the £32,600 example, min-of-three is negative → recommended payable fees is £0',
    (category) => {
      const theoretical = theoreticalBenchmarkDI(32_600, category, ref)
      const affordability = affordabilityAdjustedDI(32_600, category, ref.affordabilityBands)
      // Actual leg deliberately not the binding constraint here (Number.POSITIVE_INFINITY) —
      // the vector's point is that theoretical/affordability alone floor the award to 0.
      const result = recommendedPayableFees(Number.POSITIVE_INFINITY, theoretical, affordability)
      expect(result).toBe(0)
    },
  )

  it('is the smallest of the three when all three are positive', () => {
    expect(recommendedPayableFees(30_000, 10_000, 20_000)).toBe(10_000)
  })

  it('floors at £0 even when every leg is negative', () => {
    expect(recommendedPayableFees(-5_000, -10_000, -1_000)).toBe(0)
  })

  it('picks the actual leg when it is the smallest', () => {
    expect(recommendedPayableFees(1_000, 5_000, 8_000)).toBe(1_000)
  })
})

// ─── awardSummary (C163–C172) — Appendix F vector 6 ────────────────────────

describe('awardSummary — Appendix F vector 6 (VAT identities)', () => {
  it('fees 31,450, 10% scholarship → scholarship value (incl VAT) 3,774', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 0,
    })
    expect(result.scholarshipValueInclVat).toBe(3_774)
  })

  it('bursary award (after VAT) 12,000 → school spend before VAT 10,000', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12_000,
    })
    expect(result.bursarySpendBeforeVat).toBe(10_000)
  })

  it('payable = 31,450 − 3,774 − 12,000 = 15,676', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12_000,
    })
    expect(result.payableFeesNextYear).toBe(15_676)
  })

  it('honours an explicit vatRate override instead of DEFAULT_VAT_RATE', () => {
    const result = awardSummary({
      nextYearFees: 10_000,
      scholarshipPct: 20,
      bursaryAwardAfterVat: 1_000,
      vatRate: 0,
    })
    // 0% VAT: scholarship = 10000*0.20*1.0 = 2000; spend before VAT = 1000/1.0 = 1000.
    expect(result.scholarshipValueInclVat).toBe(2_000)
    expect(result.bursarySpendBeforeVat).toBe(1_000)
    expect(result.payableFeesNextYear).toBe(7_000)
  })

  it('floors payableFeesNextYear at £0 when scholarship + bursary exceed the fees', () => {
    const result = awardSummary({
      nextYearFees: 5_000,
      scholarshipPct: 50,
      bursaryAwardAfterVat: 10_000,
    })
    expect(result.payableFeesNextYear).toBe(0)
  })

  it('gapAmount is null when either confirmedPayableFees or recommendedPayableFees is missing', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12_000,
    })
    expect(result.gapAmount).toBeNull()
  })

  it('gapAmount = confirmedPayableFees − recommendedPayableFees when both are present', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12_000,
      confirmedPayableFees: 18_000,
      recommendedPayableFees: 15_676,
    })
    expect(result.gapAmount).toBe(18_000 - 15_676)
  })

  it('gapAmount can be negative (confirmed less than recommended)', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardAfterVat: 12_000,
      confirmedPayableFees: 10_000,
      recommendedPayableFees: 15_676,
    })
    expect(result.gapAmount).toBe(10_000 - 15_676)
  })
})
