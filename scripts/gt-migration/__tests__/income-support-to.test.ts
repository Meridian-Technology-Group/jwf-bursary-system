/**
 * C6X (25 Sep): her per-account rulings that re-classify a GT income-support
 * figure as another kind of income. The figure must leave `benefits.other`,
 * land on the named line, and leave the household income total unchanged.
 */
import { describe, expect, it } from 'vitest'
import {
  mapAssessment,
  type AccountOverrides,
  type CanonicalAccount,
  type Controls,
} from '../build/map-assessment'
import type { AssessorIncomeRecord } from '../../../src/types/assessment-v2'

const account = (overrides: AccountOverrides | null): CanonicalAccount => ({
  key: 'k',
  school: 'WHITGIFT',
  type: 'ROLLING',
  sheetYear: 9,
  fees: 30000,
  scholPct: 0,
  award: 10000,
  payable: 24000,
  flags: [],
  latest: null,
  overrides,
})

const controls = (entries: Record<string, number>): Controls =>
  new Map([
    ['ENTER A FIGURE BETWEEN 1 AND 6', ['5']],
    ...Object.entries(entries).map(([k, v]) => [k, [v.toFixed(4)]] as [string, string[]]),
  ])

const mapped = (ov: AccountOverrides | null, c: Record<string, number>) => {
  const r = mapAssessment(account(ov), controls(c))
  if (r.status !== 'MAPPED') throw new Error(r.status)
  return r
}

/** Every line the engine sums into household income (income.ts). */
const total = (earners: readonly AssessorIncomeRecord[]) =>
  earners.reduce((sum, e) => {
    const s = e.selfEmployed
    const u = e.unemployed
    const b = e.benefits
    return (
      sum +
      (e.employed?.annualSalaryPaye ?? 0) +
      (s ? s.grossSalaried + s.propertyIncome + s.dividends + s.otherInvestmentIncome : 0) +
      (u ? u.finalGrossPay + u.redundancy + u.jsa + u.grantSupport + u.leavePay : 0) +
      (b ? b.universalCredit + b.housingBenefit + b.childBenefit + b.childWorkingTaxCredit + b.pipOrDla + b.other : 0) +
      (e.thirdParty?.incomeSupportReceived ?? 0)
    )
  }, 0)

describe('C6X income support re-classified', () => {
  it('moves it to dividends on the earner that held it', () => {
    const c = { 'First Earner yearly income support': 38400, 'First Earner yearly company profits': 11205, 'Second Earner yearly net pay': 52407 }
    const before = mapped(null, c)
    const after = mapped({ incomeSupportTo: { to: 'DIVIDENDS', amount: 38400 } }, c)
    const [e1, e2] = after.input.earners
    expect(e1.selfEmployed?.dividends).toBe(38400)
    expect(e1.selfEmployed?.otherInvestmentIncome).toBe(11205)
    expect(e1.benefits).toBeUndefined()
    expect(e2.selfEmployed).toBeUndefined()
    expect(total(after.input.earners)).toBe(total(before.input.earners))
  })

  it('moves a figure split across both earners into friends & family on the first', () => {
    const c = { 'First Earner yearly income support': 5299, 'Second Earner yearly income support': 6900 }
    const after = mapped({ incomeSupportTo: { to: 'FRIENDS_FAMILY', amount: 12199 } }, c)
    expect(after.input.earners).toHaveLength(1)
    expect(after.input.earners[0].thirdParty?.incomeSupportReceived).toBe(12199)
    expect(after.input.earners[0].benefits).toBeUndefined()
    expect(total(after.input.earners)).toBe(12199)
  })

  it('adds to a friends & family figure GT already holds', () => {
    const c = { 'First Earner yearly income support': 4800, 'Friends and Family Arrangements Total': 1000 }
    const after = mapped({ incomeSupportTo: { to: 'FRIENDS_FAMILY', amount: 4800 } }, c)
    expect(after.input.earners[0].thirdParty?.incomeSupportReceived).toBe(5800)
  })

  it.each([
    ['REDUNDANCY', 'redundancy'],
    ['STUDENT_SUPPORT', 'grantSupport'],
  ] as const)('moves it to %s on the second earner, keeping that earner', (to, field) => {
    const c = { 'First Earner yearly net pay': 43291, 'Second Earner yearly income support': 13082, 'Second Earner other benefits': 8988 }
    const before = mapped(null, c)
    const after = mapped({ incomeSupportTo: { to, amount: 13082 } }, c)
    const e2 = after.input.earners[1]
    expect(e2.unemployed?.[field]).toBe(13082)
    expect(e2.benefits?.other).toBe(8988)
    expect(total(after.input.earners)).toBe(total(before.input.earners))
  })

  it('moves it to property income, adding to the household property-income control', () => {
    const c = { 'First Earner yearly income support': 4000, 'ADD BACK IN THE ADDITIONAL YEARLY PROPERTY INCOME': 2000 }
    const after = mapped({ incomeSupportTo: { to: 'PROPERTY_INCOME', amount: 4000 } }, c)
    expect(after.input.earners[0].selfEmployed?.propertyIncome).toBe(6000)
  })

  it('refuses a ruling whose amount GT no longer holds', () => {
    const c = { 'First Earner yearly income support': 9000 }
    expect(() => mapped({ incomeSupportTo: { to: 'PROPERTY_INCOME', amount: 4000 } }, c)).toThrow(/C6X k/)
  })

  it('leaves the rest of the calculation alone', () => {
    const c = { 'Second Earner yearly income support': 9000, 'APPROX VALUE OF OWNED HOME': 415000, 'OUTSTANDING MORTGAGE BALANCE': 288000 }
    const before = mapped(null, c)
    const after = mapped({ incomeSupportTo: { to: 'PROPERTY_INCOME', amount: 9000 } }, c)
    const { earners: _b, ...restBefore } = before.input
    const { earners: _a, ...restAfter } = after.input
    expect(restAfter).toEqual(restBefore)
  })
})
