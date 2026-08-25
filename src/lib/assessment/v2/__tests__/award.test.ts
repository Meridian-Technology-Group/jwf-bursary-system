import { describe, it, expect } from 'vitest'
import {
  actualRemainingDI,
  theoreticalBenchmarkDI,
  affordabilityAdjustedDI,
  recommendedPayableFees,
  awardSummary,
  maxPayableFeesInclVat,
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

// ─── CH-52 — maxPayableFeesInclVat + the affordability cap ─────────────────

describe('maxPayableFeesInclVat — the single definition of "maximum payable fees"', () => {
  it("grosses the school's pre-VAT fee up once", () => {
    expect(maxPayableFeesInclVat(26_175)).toBe(31_410)
    expect(maxPayableFeesInclVat(25_200)).toBe(30_240)
  })

  it('honours an explicit VAT rate', () => {
    expect(maxPayableFeesInclVat(10_000, 0)).toBe(10_000)
    expect(maxPayableFeesInclVat(10_000, 5)).toBe(10_500)
  })
})

describe('affordabilityAdjustedDI — CH-52 cap at the full VAT-inclusive fee', () => {
  // Whitgift 2026-27: £26,175 ex VAT → £31,410 the parent could ever pay.
  const cap = maxPayableFeesInclVat(26_175)

  it('leaves a contribution below the fee untouched', () => {
    const uncapped = affordabilityAdjustedDI(60_000, 1, affordabilityBands)
    const capped = affordabilityAdjustedDI(60_000, 1, affordabilityBands, cap)
    expect(uncapped).toBeLessThan(cap)
    expect(capped).toBe(uncapped)
  })

  it('caps a very high income at the full fee rather than holding the top %', () => {
    // £500,000 held the top band's 45% before CH-52 — £225,000, far past the fee.
    const uncapped = affordabilityAdjustedDI(500_000, 1, affordabilityBands)
    expect(uncapped).toBeGreaterThan(cap)
    expect(affordabilityAdjustedDI(500_000, 1, affordabilityBands, cap)).toBe(cap)
  })

  it('binds at her crossing point: £98,001 is where 35% first exceeds the fee', () => {
    // Her worked example's intent. At category 1 the band % is unadjusted.
    const at98001 = affordabilityAdjustedDI(98_001, 1, affordabilityBands)
    expect(at98001).toBeCloseTo(34_300.35, 2)
    expect(at98001).toBeGreaterThan(cap)
    expect(affordabilityAdjustedDI(98_001, 1, affordabilityBands, cap)).toBe(cap)

    // One band lower, 32% of £98,000 is £31,360 — still under the fee, so a
    // family there keeps qualifying. This is the boundary, not £89,257.
    const at98000 = affordabilityAdjustedDI(98_000, 1, affordabilityBands)
    expect(at98000).toBeCloseTo(31_360, 2)
    expect(at98000).toBeLessThan(cap)
  })

  it('caps on a mid-range income too when the family category lifts the %', () => {
    // The cap is not only a top-of-grid concern.
    const capped = affordabilityAdjustedDI(104_000, 1, affordabilityBands, 5_000)
    expect(capped).toBe(5_000)
  })

  it('is unaffected by the cap below the grid — the leg is £0 either way', () => {
    expect(affordabilityAdjustedDI(20_000, 1, affordabilityBands, cap)).toBe(0)
  })
})

// ─── awardSummary (C163–C172) — CH-36 before-VAT model ─────────────────────

/**
 * CH-36 — Charlotte's award-summary spec of 24 Aug 2026 (`image012.png`),
 * which closes D8 and OVERTURNS `ASSUMPTION(CALC-A5)`. Everything is computed
 * before VAT; VAT is applied exactly once, at the end, to the payable line.
 *
 *   autofill 1  fees before VAT
 *   manual 1    scholarship %
 *   autofill 4  scholarship spend before VAT = autofill1 x manual1
 *   manual 2    bursary award/spend before VAT
 *   autofill 2  net fees before VAT          = autofill1 - autofill4 - manual2
 *   autofill 3  yearly payable incl. VAT     = autofill2 x 1.20
 */
describe('awardSummary — CH-36 before-VAT chain', () => {
  it('fees 31,450 at 10% → scholarship spend before VAT 3,145 (no VAT added)', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 0,
    })
    expect(result.scholarshipSpendBeforeVat).toBe(3_145)
  })

  it('net fees before VAT = 31,450 − 3,145 − 12,000 = 16,305', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 12_000,
    })
    expect(result.netFeesBeforeVat).toBe(16_305)
  })

  it('yearly payable INCLUDING VAT = 16,305 × 1.20 = 19,566', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 12_000,
    })
    expect(result.yearlyPayableFeesInclVat).toBe(19_566)
  })

  it('applies VAT ONCE — the payable line is exactly the net line grossed up', () => {
    const result = awardSummary({
      nextYearFees: 26_175,
      scholarshipPct: 15,
      bursaryAwardBeforeVat: 4_000,
    })
    expect(result.yearlyPayableFeesInclVat).toBeCloseTo(
      result.netFeesBeforeVat * 1.2,
      2,
    )
  })

  it('a 0% scholarship leaves the fee untouched before the bursary is deducted', () => {
    const result = awardSummary({
      nextYearFees: 26_175,
      scholarshipPct: 0,
      bursaryAwardBeforeVat: 0,
    })
    expect(result.scholarshipSpendBeforeVat).toBe(0)
    expect(result.netFeesBeforeVat).toBe(26_175)
    expect(result.yearlyPayableFeesInclVat).toBe(31_410)
  })

  it('honours an explicit vatRate override instead of DEFAULT_VAT_RATE', () => {
    const result = awardSummary({
      nextYearFees: 10_000,
      scholarshipPct: 20,
      bursaryAwardBeforeVat: 1_000,
      vatRate: 0,
    })
    // 0% VAT: scholarship spend = 2,000; net = 7,000; payable = net x 1.0.
    expect(result.scholarshipSpendBeforeVat).toBe(2_000)
    expect(result.netFeesBeforeVat).toBe(7_000)
    expect(result.yearlyPayableFeesInclVat).toBe(7_000)
  })

  it('floors netFeesBeforeVat at £0 when scholarship + bursary exceed the fees', () => {
    const result = awardSummary({
      nextYearFees: 5_000,
      scholarshipPct: 50,
      bursaryAwardBeforeVat: 10_000,
    })
    expect(result.netFeesBeforeVat).toBe(0)
    // A floored net must not produce VAT on a negative remainder.
    expect(result.yearlyPayableFeesInclVat).toBe(0)
  })

  it('a full bursary (award = fees) leaves the parent paying nothing', () => {
    const result = awardSummary({
      nextYearFees: 26_175,
      scholarshipPct: 0,
      bursaryAwardBeforeVat: 26_175,
    })
    expect(result.netFeesBeforeVat).toBe(0)
    expect(result.yearlyPayableFeesInclVat).toBe(0)
  })

  it('gapAmount is null when either confirmedPayableFees or recommendedPayableFees is missing', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 12_000,
    })
    expect(result.gapAmount).toBeNull()
  })

  it('gapAmount = confirmedPayableFees − recommendedPayableFees when both are present', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 12_000,
      confirmedPayableFees: 18_000,
      recommendedPayableFees: 15_676,
    })
    expect(result.gapAmount).toBe(18_000 - 15_676)
  })

  it('gapAmount can be negative (confirmed less than recommended)', () => {
    const result = awardSummary({
      nextYearFees: 31_450,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 12_000,
      confirmedPayableFees: 10_000,
      recommendedPayableFees: 15_676,
    })
    expect(result.gapAmount).toBe(10_000 - 15_676)
  })
})
