// Synthetic fixtures only: no real family's data belongs in this repo.
import { describe, expect, it } from 'vitest'
import {
  mapAssessment,
  schoolingYearsRemaining,
  DEFAULT_RULES,
  C,
  type CanonicalAccount,
  type Controls,
  type MappingRules,
} from '../build/map-assessment'
import { calculateEarnerAggregateIncome } from '../../../src/lib/assessment/v2/income'

const account = (over: Partial<CanonicalAccount> = {}): CanonicalAccount => ({
  key: 'k1',
  school: 'TRINITY',
  type: 'Rolling-over',
  sheetYear: 9,
  fees: 20000,
  scholPct: 10,
  award: 8000,
  payable: 12000,
  flags: [],
  latest: { eid: 'E1' },
  sheetFamilyType: '3',
  ...over,
})

const controls = (values: Record<string, number | string>): Controls =>
  new Map(Object.entries(values).map(([k, v]) => [k, [String(v)]]))

const base = { [C.familyType]: 3 }

function mapped(acc: CanonicalAccount, ctl: Controls, rules: MappingRules = DEFAULT_RULES) {
  const r = mapAssessment(acc, ctl, rules)
  if (r.status !== 'MAPPED') throw new Error(`expected MAPPED, got ${r.status}`)
  return r
}

describe('mapAssessment — not assessed', () => {
  it('skips pastoral boarders', () => {
    expect(mapAssessment(account({ flags: ['PB_NO_GT'] }), controls(base))).toEqual({
      status: 'NOT_ASSESSED',
      reason: 'PASTORAL_BOARDER',
    })
  })

  it('skips an assessment with no form data', () => {
    expect(mapAssessment(account(), undefined)).toMatchObject({ reason: 'NO_FORM_DATA' })
    expect(mapAssessment(account(), new Map())).toMatchObject({ reason: 'NO_FORM_DATA' })
  })

  it('falls back to her schedule for family type, and refuses when neither has one', () => {
    const r = mapped(account({ sheetFamilyType: '2' }), controls({ 'First Earner yearly net pay': 1 }))
    expect(r.input.familyTypeCategory).toBe(2)
    expect(r.notes.some((n) => n.startsWith('§4'))).toBe(true)
    expect(mapAssessment(account({ sheetFamilyType: null }), controls({ 'First Earner yearly net pay': 1 }))).toMatchObject({
      reason: 'NO_FAMILY_TYPE',
    })
  })
})

describe('mapAssessment — income reproduces GT', () => {
  it('sums every earner control, child and housing benefit, and maintenance', () => {
    const r = mapped(
      account(),
      controls({
        ...base,
        'First Earner yearly net pay': 30000,
        'First earner child benefits': 1500,
        'First earner housing benefits': 800,
        'First Earner yearly company profits': 2000,
        'Second Earner yearly net pay': 10000,
        [C.maintenance]: 1200,
      }),
    )
    expect(r.input.earners).toHaveLength(2)
    expect(calculateEarnerAggregateIncome(r.input.earners)).toBe(30000 + 1500 + 800 + 2000 + 10000 + 1200)
  })

  it('creates a second earner only when a second-earner field is non-zero', () => {
    const r = mapped(account(), controls({ ...base, 'First Earner yearly net pay': 30000, 'Second Earner yearly net pay': 0 }))
    expect(r.input.earners).toHaveLength(1)
  })
})

describe('mapAssessment — C5 rent-free marker', () => {
  const ctl = controls({ ...base, 'First Earner yearly net pay': 20000, 'First Earner yearly income support': 12000 })

  it('takes the marker out of income and adds rent back', () => {
    const r = mapped(account(), ctl)
    expect(calculateEarnerAggregateIncome(r.input.earners)).toBe(20000)
    expect(r.input.rentAddBackType).toBe('FULL_RENT_FREE')
  })

  it('leaves it as income when ruled so', () => {
    const r = mapped(account(), ctl, { ...DEFAULT_RULES, rentFree: 'KEEP_AS_INCOME' })
    expect(calculateEarnerAggregateIncome(r.input.earners)).toBe(32000)
    expect(r.input.rentAddBackType).not.toBe('FULL_RENT_FREE')
  })

  it('ignores income support that is not exactly a marker', () => {
    const r = mapped(account(), controls({ ...base, 'First Earner yearly income support': 12001 }))
    expect(calculateEarnerAggregateIncome(r.input.earners)).toBe(12001)
  })
})

describe('mapAssessment — property (C7, C16)', () => {
  it('rents when there is no home', () => {
    expect(mapped(account(), controls(base)).input.portfolioType).toBe('RENTING')
  })

  it('applies the mortgage-free add-back only to an owner with no mortgage', () => {
    const outright = mapped(account(), controls({ ...base, [C.homeValue]: 400000 }))
    expect(outright.input.rentAddBackType).toBe('FULL_MORTGAGE_FREE')
    const mortgaged = mapped(account(), controls({ ...base, [C.homeValue]: 400000, [C.homeMortgage]: 100000 }))
    expect(mortgaged.input.rentAddBackType).toBe('NONE')
    const off = mapped(account(), controls({ ...base, [C.homeValue]: 400000 }), { ...DEFAULT_RULES, mortgageFreeAddBack: false })
    expect(off.input.rentAddBackType).toBe('NONE')
  })

  it('puts other properties where the engine reads them for each portfolio type', () => {
    const ctl = controls({ ...base, [C.homeValue]: 400000, [C.otherValue]: 250000, [C.otherMortgage]: 50000 })
    const second = mapped(account(), ctl)
    expect(second.input.portfolioType).toBe('DOUBLE')
    expect(second.input.propertyAssets.second).toEqual({ value: 250000, mortgageBalance: 50000 })
    const portfolio = mapped(account(), ctl, { ...DEFAULT_RULES, otherProperty: 'PORTFOLIO' })
    expect(portfolio.input.portfolioType).toBe('MULTIPLE')
    expect(portfolio.input.propertyAssets.other).toEqual({ value: 250000, mortgageBalance: 50000 })
  })
})

describe('mapAssessment — C12 debt', () => {
  const ctl = controls({ ...base, [C.creditCards]: 3000, [C.loans]: 2400, [C.leases]: 600, [C.foundationDebt]: 500 })

  it('multiplies loan and lease figures by the repayment horizon by default', () => {
    expect(mapped(account(), ctl).input.debts).toEqual({
      creditCards: 3000,
      loans: 12000,
      leaseBalances: 3000,
      schoolFeesOwedOrOther: 500,
    })
  })

  it('takes them as entered when ruled so, as GT itself did', () => {
    const r = mapped(account(), ctl, { ...DEFAULT_RULES, debt: 'AS_ENTERED' })
    expect(r.input.debts.loans).toBe(2400)
    expect(r.input.debts.leaseBalances).toBe(600)
  })
})

describe('mapAssessment — school, fees and years', () => {
  it('passes her schedule through as the award inputs', () => {
    const r = mapped(account(), controls(base))
    expect(r.input).toMatchObject({
      annualFees: 20000,
      nextYearFees: 20000,
      scholarshipPct: 10,
      bursaryAwardBeforeVat: 8000,
      confirmedPayableFees: 12000,
      vatRate: 20,
      siblingPayableFees: [],
    })
  })

  it('charges no VAT at Old Palace', () => {
    expect(mapped(account({ school: 'OP_PARTNER' }), controls(base)).input.vatRate).toBe(0)
  })

  it('counts years to Year 13, or Year 11 at Old Palace, including 2026-27', () => {
    expect(schoolingYearsRemaining(account({ sheetYear: 9 }))).toBe(5)
    expect(schoolingYearsRemaining(account({ sheetYear: 13 }))).toBe(1)
    expect(schoolingYearsRemaining(account({ school: 'OP_PARTNER', sheetYear: 10 }))).toBe(2)
    expect(schoolingYearsRemaining(account({ school: 'OP_PARTNER', sheetYear: 11 }))).toBe(1)
    expect(schoolingYearsRemaining(account({ school: 'OP_PARTNER', sheetYear: 7 }))).toBe(5)
  })
})
