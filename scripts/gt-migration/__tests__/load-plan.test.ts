/**
 * The loader's pure layer: reason-code crosswalk, gap-code rule, and the
 * per-account plan. Synthetic fixtures only (04-toolkit.md §8); never real rows.
 */
import { describe, expect, it } from 'vitest'
import type { AssessmentV2Input, AssessmentV2Output } from '../../../src/lib/assessment/v2/orchestrator'
import {
  crosswalkReasonCodes,
  gapReasonLabel,
  gapReasonLabels,
  resolveLabels,
  stripDisplayNumber,
  FIRST_ASSESSMENT,
  GAP_FALLBACK,
  GAP_IMMATERIAL,
  MAJOR_ASSETS,
  MAJOR_INCOME,
  OTHER,
} from '../load/reason-codes'
import { composeSynopsis, defaultSchoolAgeChildren, formatLongDate, parseGtDate, planAccount, PlanError, type LoadAccount } from '../load/plan'

describe('reason-code crosswalk (C8)', () => {
  it('maps GT numbers to the new labels, splitting on commas and semicolons', () => {
    const r = crosswalkReasonCodes({ yoyCodes: '6 - Salary increase, 77 - x; 34 - Reduced savings', majorIncome: 'No', majorAssets: 'No', isNew: false })
    expect(r.labels).toEqual(['Salary increase', 'Self-employed net profit increase', 'Decreased savings'])
    expect(r.unmapped).toEqual([])
  })

  it('an unmapped GT code loads as Other and is reported', () => {
    const r = crosswalkReasonCodes({ yoyCodes: '29 - New asset acquired since last year', majorIncome: '', majorAssets: '', isNew: false })
    expect(r.labels).toEqual([OTHER])
    expect(r.unmapped).toEqual(['29 - New asset acquired since last year'])
  })

  it('new awards are first assessments; major-change Yes adds 27 / 35; her rulings add more', () => {
    const r = crosswalkReasonCodes({
      yoyCodes: 'n/a',
      majorIncome: 'Yes',
      majorAssets: 'yes',
      isNew: true,
      addLabels: ['42 - Sibling on full/partial fees taking up most or all of NDI'],
    })
    expect(r.labels).toEqual([FIRST_ASSESSMENT, MAJOR_INCOME, MAJOR_ASSETS, 'Sibling on full/partial fees taking up most or all of NDI'])
  })

  it('always yields at least one code', () => {
    expect(crosswalkReasonCodes({ yoyCodes: '', majorIncome: '', majorAssets: '', isNew: false }).labels).toEqual([OTHER])
  })

  it('resolves labels by text whatever the display number, and refuses a missing one', () => {
    const active = [{ id: 'a', label: '14 - Salary increase' }, { id: 'b', label: '43 - Other' }]
    expect(resolveLabels(['Salary increase', 'other'], active, 'reason code')).toEqual(['a', 'b'])
    expect(() => resolveLabels(['Inheritance'], active, 'reason code')).toThrow(/Inheritance/)
    expect(stripDisplayNumber('27 - Major change in income')).toBe('Major change in income')
  })
})

describe('gap code (S19)', () => {
  it('none within a penny; immaterial under £100; the 2020 benchmark otherwise; her pick wins', () => {
    expect(gapReasonLabel(0)).toBeNull()
    expect(gapReasonLabel(0.01)).toBeNull()
    expect(gapReasonLabel(-99.99)).toBe(GAP_IMMATERIAL)
    expect(gapReasonLabel(100)).toBe(GAP_FALLBACK)
    expect(gapReasonLabel(-2500, '11 - Affordability Adjusted Calculation Preferred')).toBe('Affordability Adjusted Calculation Preferred')
    expect(gapReasonLabel(null)).toBeNull()
  })
})

describe('gap codes from her returned report (Phase 2)', () => {
  it('keeps all her picks in order, numbers stripped, duplicates dropped', () => {
    expect(gapReasonLabels(2500, ['3 - Original Old Assessment Benchmark (year 2020)', 'SE income partially or not declared to HMRC', '3 - Original Old Assessment Benchmark (year 2020)'])).toEqual([
      'Original Old Assessment Benchmark (year 2020)',
      'SE income partially or not declared to HMRC',
    ])
  })

  it('none within a penny, even where she coded one; the fallback when she gave none', () => {
    expect(gapReasonLabels(0, ['Immaterial gap, less than £100'])).toEqual([])
    expect(gapReasonLabels(-40)).toEqual([GAP_IMMATERIAL])
    expect(gapReasonLabels(-4000, [])).toEqual([GAP_FALLBACK])
  })
})

describe('school-age children (her 15 Oct check)', () => {
  it('takes the family category default, as a new assessment does', () => {
    expect([1, 2, 3, 4, 5, 6].map(defaultSchoolAgeChildren)).toEqual([1, 1, 2, 3, 4, 5])
  })
})

describe('dates and synopsis', () => {
  it('parses both GT date forms to noon UTC', () => {
    expect(parseGtDate('16 May 2026')?.toISOString()).toBe('2026-05-16T12:00:00.000Z')
    expect(parseGtDate('2026-04-15')?.toISOString()).toBe('2026-04-15T12:00:00.000Z')
    expect(parseGtDate('')).toBeNull()
  })

  it('keeps GT text verbatim and adds the migration footer, dates written out', () => {
    const s = composeSynopsis('Family note.', '16 May 2026', '2026-09-29')
    expect(s.startsWith('Family note.\n\n— Migrated from Grant Tracker on 29 September 2026. GT assessment completed 16 May 2026.')).toBe(true)
    expect(composeSynopsis('', '', '2026-09-29', '2026-04-15')).toContain('the review was received 15 April 2026')
    expect(composeSynopsis('', '2026-04-05', '2026-10-10')).toContain('on 10 October 2026. GT assessment completed 5 April 2026.')
  })

  it('formats a date in long form and keeps text it cannot parse', () => {
    expect(formatLongDate('2026-10-10')).toBe('10 October 2026')
    expect(formatLongDate('30 May 2025')).toBe('30 May 2025')
    expect(formatLongDate('not a date ')).toBe('not a date')
  })
})

// ── the account plan ────────────────────────────────────────────────────────

const account = (over: Partial<LoadAccount> = {}): LoadAccount => ({
  key: 'k1',
  reference: 'WS-TEST01-TEST, Pupil',
  school: 'WHITGIFT',
  type: 'Rolling-over',
  sheetYear: 9,
  fees: 26175,
  scholPct: 0,
  award: 10000,
  payable: 19410,
  monthly: 1617.5,
  flags: [],
  fund: 'JWF',
  email: 'Parent@Example.test',
  surname: 'Test',
  forenames: 'Pupil',
  parent: { title: 'Mrs', firstName: 'Pat', lastName: 'Test', source: 'GT' },
  yoyCodes: '1 - No real change',
  majorIncome: 'No',
  majorAssets: 'No',
  latest: { completed: '16 May 2026', eid: 'E1' },
  gt: { id: 'G1' },
  synopsis: 'Note.',
  ...over,
})

const input = (vatRate = 20) =>
  ({
    earners: [{ total: 0, documentsConfirmed: true, employed: { annualSalaryPaye: 40000 } }],
    manualAdjustment: 0,
    familyTypeCategory: 3,
    rentAddBackType: 'NONE',
    rentAddBackOverride: null,
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: true,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: 0,
    isasPepsShares: 0,
    schoolingYearsRemaining: 5,
    propertyAssets: {},
    portfolioType: 'RENTING',
    debts: {},
    siblingPayableFees: [],
    annualFees: 26175,
    scholarshipPct: 0,
    bursaryAwardBeforeVat: 10000,
    nextYearFees: 26175,
    vatRate,
    confirmedPayableFees: 19410,
  }) as unknown as AssessmentV2Input

const output = (recommended = 19410, legs: { theoreticalBenchmarkDi?: number; affordabilityAdjustedDi?: number } = {}) =>
  ({
    householdNetIncome: 40000,
    actualRemainingDi: recommended,
    theoreticalBenchmarkDi: legs.theoreticalBenchmarkDi ?? recommended,
    affordabilityAdjustedDi: legs.affordabilityAdjustedDi ?? recommended,
    recommendedPayableFees: recommended,
    incomeCategory: 3,
    propertyCategoryDerived: 1,
    adjustedSavings: 0,
    awardSummary: { scholarshipSpendBeforeVat: 0, netFeesBeforeVat: 16175, yearlyPayableFeesInclVat: 19410, gapAmount: 0 },
  }) as unknown as AssessmentV2Output

describe('planAccount (02-target-model Part 1)', () => {
  it('carries the postcode district taken from her synopsis, or none', () => {
    expect(planAccount(account({ postcode: 'CR0' }), input(), output(), '2026-10-10').assessmentSave.postcode).toBe('CR0')
    expect(planAccount(account(), input(), output(), '2026-10-10').assessmentSave.postcode).toBeNull()
  })

  it('carries the DOB GT agrees on to the child, contact and application (Epic 23 T2), else null', () => {
    const p = planAccount(account(), input(), output(), '2026-10-16', '2014-09-02')
    expect(p.child.dob).toBe('2014-09-02')
    expect(p.contact.childDob?.toISOString()).toBe('2014-09-02T00:00:00.000Z')
    expect(p.application.childDob?.toISOString()).toBe('2014-09-02T00:00:00.000Z')
    const none = planAccount(account(), input(), output(), '2026-10-16')
    expect([none.child.dob, none.contact.childDob, none.application.childDob]).toEqual([null, null, null])
  })

  it('a rolling-over Whitgift account', () => {
    const p = planAccount(account(), input(), output(), '2026-09-29')
    expect(p.leadEmail).toBe('parent@example.test')
    expect(p.application).toMatchObject({
      applicationType: 'ROLLING_OVER',
      isReassessment: true,
      formStatus: 'SUBMITTED',
      migrationSource: 'GRANT_TRACKER',
      entryYear: 2026,
      entryYearGroup: 'Y9',
      childName: 'Pupil Test',
    })
    expect(p.contact.situation).toBe('ROLLING_OVER')
    expect(p.assessmentLock).toMatchObject({ status: 'ROLLED_OVER', awardFundType: 'JWF', vatRate: 20 })
    expect(p.recommendation).toMatchObject({ confirmedPayableFees: 19410, bursaryAward: 10000, gapAmount: 0, lastPayableFees: null })
    expect(p.reasonLabels).toEqual(['No real change'])
    expect(p.gapLabels).toEqual([])
    expect(p.reasonsFrom).toBe('GT')
    expect(p.account).toEqual({ benchmarkPayableFees: 19410, annualFeesOverride: null })
    expect(p.assessmentSave.nextYearAnnualFees).toBeNull()
    expect(p.assessmentSave.earnersV2?.[0].incomeDetail.total).toBe(40000)
  })

  it('a new award locks as NEW_AWARD with the first-assessment code', () => {
    const p = planAccount(account({ type: 'New award', yoyCodes: 'n/a' }), input(), output(), '2026-09-29')
    expect(p.application.applicationType).toBe('NEW')
    expect(p.contact.situation).toBe('NEW')
    expect(p.assessmentLock.status).toBe('NEW_AWARD')
    expect(p.reasonLabels).toEqual([FIRST_ASSESSMENT])
  })

  it('her 21 Oct ruling: a new award loads as rolling-over, keeping its first-assessment code', () => {
    const p = planAccount(account({ type: 'New award', yoyCodes: 'n/a', rollOver: true }), input(), output(), '2026-09-29')
    expect(p.application).toMatchObject({ applicationType: 'ROLLING_OVER', isReassessment: true })
    expect(p.contact.situation).toBe('ROLLING_OVER')
    expect(p.assessmentLock.status).toBe('ROLLED_OVER')
    expect(p.reasonLabels).toEqual([FIRST_ASSESSMENT])
  })

  it('an OP account: 0% VAT and its own fee on the account', () => {
    const p = planAccount(account({ school: 'OP_PARTNER', fees: 17000 }), input(0), output(), '2026-09-29')
    expect(p.assessmentLock.vatRate).toBe(0)
    expect(p.account.annualFeesOverride).toBe(17000)
  })

  it('refuses a mapper/school VAT disagreement', () => {
    expect(() => planAccount(account({ school: 'OP_PARTNER' }), input(20), output(), '2026-09-29')).toThrow(PlanError)
  })

  it('a material gap gets a gap code; her corrected reference wins', () => {
    const p = planAccount(account({ referenceCorrected: 'WS-TEST01-TEST, Pupil Two' }), input(), output(17000), '2026-09-29')
    expect(p.recommendation.gapAmount).toBe(2410)
    expect(p.gapLabels).toEqual([GAP_FALLBACK])
    expect(p.reference).toBe('WS-TEST01-TEST, Pupil Two')
  })

  it('falls back to the received date when GT holds no completion date', () => {
    const p = planAccount(account({ latest: { completed: '', received: '2026-04-15' } }), input(), output(), '2026-09-29')
    expect(p.submittedAt.toISOString()).toBe('2026-04-15T12:00:00.000Z')
  })

  it('her reference-leg ruling takes the recommendation and gap from that leg, and says so', () => {
    const p = planAccount(
      account({ overrides: { referenceLeg: 'AFFORDABILITY' } }),
      input(),
      output(25000, { affordabilityAdjustedDi: 18000.455 }),
      '2026-09-29',
    )
    expect(p.recommendation.recommendedPayableFees).toBe(18000.46)
    expect(p.assessmentSave.recommendedPayableFees).toBe(18000.46)
    expect(p.recommendation.gapAmount).toBe(1409.54)
    expect(p.expect).toMatchObject({ recommendedPayableFees: 18000.46, gapAmount: 1409.54, referenceLeg: 'AFFORDABILITY' })
    // the snapshot keeps every leg as calculated
    expect(p.assessmentSave.actualRemainingDi).toBe(25000)
    expect(p.assessmentLock.synopsis).toContain('taken from the affordability-adjusted leg')
  })

  it('her returned report replaces the GT crosswalk and the gap fallback', () => {
    const m5 = {
      reasonLabels: ['Sudden unemployment', 'New job and increased pay'],
      gapLabels: ['Original Old Assessment Benchmark (year 2020)', 'Additional wealth outside the scope of direct family'],
      batch: 'batch5',
    }
    const p = planAccount(account({ m5, yoyCodes: '29 - unmapped GT code' }), input(), output(17000), '2026-09-29')
    expect(p.reasonsFrom).toBe('M5')
    expect(p.reasonLabels).toEqual(m5.reasonLabels)
    expect(p.unmappedReasons).toEqual([])
    expect(p.gapLabels).toEqual(m5.gapLabels)
  })

  it('her gap codes are dropped where the gap is nil', () => {
    const m5 = { reasonLabels: ['No real change'], gapLabels: ['Immaterial gap, less than £100'], batch: 'batch2' }
    const p = planAccount(account({ m5 }), input(), output(), '2026-09-29')
    expect(p.recommendation.gapAmount).toBe(0)
    expect(p.gapLabels).toEqual([])
    expect(p.reasonLabels).toEqual(['No real change'])
  })

  it('a negative reference leg floors at £0', () => {
    const p = planAccount(account({ overrides: { referenceLeg: 'THEORETICAL' } }), input(), output(5000, { theoreticalBenchmarkDi: -300 }), '2026-09-29')
    expect(p.recommendation.recommendedPayableFees).toBe(0)
    expect(p.recommendation.gapAmount).toBe(19410)
  })

  it('without a ruling the recommendation stays on the actual leg and the synopsis is unchanged', () => {
    const p = planAccount(account(), input(), output(19410, { affordabilityAdjustedDi: 1 }), '2026-09-29')
    expect(p.recommendation.recommendedPayableFees).toBe(19410)
    expect(p.expect.referenceLeg).toBe('ACTUAL')
    expect(p.assessmentLock.synopsis).not.toContain('leg')
  })

  it.each([
    ['excluded', { excluded: 'pastoral' }],
    ['a pastoral boarder', { fund: 'PB' }],
    ['no parent surname', { parent: null }],
    ['a school year out of range', { sheetYear: 14 }],
    ['no dates at all', { latest: { completed: '' } }],
  ] as const)('refuses %s', (_, over) => {
    expect(() => planAccount(account(over as Partial<LoadAccount>), input(), output(), '2026-09-29')).toThrow(PlanError)
  })
})
