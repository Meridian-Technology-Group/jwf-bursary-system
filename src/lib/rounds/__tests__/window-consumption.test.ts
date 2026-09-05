// Epic 14 D2 (CG-01) — round-window consumption by invitation sends.

import { describe, expect, it } from 'vitest'
import {
  applyWindowToDeadlineRound,
  invitationScenarioFields,
  openingDateFromWindow,
  scenarioForInvitation,
  windowForScenario,
  type StoredRoundWindow,
} from '../window-consumption'
import { getTaxYearLabels, resolveTaxYearBasisYear } from '@/lib/portal/tax-year'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const baseRound = {
  closeDate: d('2027-08-19'),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
}

function windows(overrides: Partial<StoredRoundWindow> = {}): StoredRoundWindow[] {
  return [
    {
      scenario: 'NA_NEXT_WINTER',
      opensOn: d('2026-11-10'),
      submitBy: d('2027-04-11'),
      defaultTaxYear: '2025/26',
      ...overrides,
    },
  ]
}

describe('scenarioForInvitation', () => {
  it('routes ROLLING_OVER to RA regardless of date', () => {
    expect(scenarioForInvitation('ROLLING_OVER', d('2027-01-15'), 2027)).toBe('RA')
  })

  it('splits next-year NEW invites winter/spring on the 12 Apr cutover (LA-4)', () => {
    expect(scenarioForInvitation('NEW', d('2027-01-15'), 2027)).toBe('NA_NEXT_WINTER')
    expect(scenarioForInvitation('NEW', d('2027-04-12'), 2027)).toBe('NA_NEXT_SPRING')
  })

  it('treats INTERNAL and null situations as NEW-type', () => {
    expect(scenarioForInvitation('INTERNAL', d('2027-05-01'), 2027)).toBe('NA_NEXT_SPRING')
    expect(scenarioForInvitation(null, d('2027-05-01'), 2027)).toBe('NA_NEXT_SPRING')
  })
})

describe('applyWindowToDeadlineRound', () => {
  it("fills a NULL new-default from the window's submitBy", () => {
    const out = applyWindowToDeadlineRound(baseRound, windows()[0], 'NEW')
    expect(out.defaultSubmissionDeadlineNew).toEqual(d('2027-04-11'))
    expect(out.defaultSubmissionDeadlineRolling).toBeNull()
  })

  it('NEVER overrides an explicitly-set E1 column', () => {
    const set = { ...baseRound, defaultSubmissionDeadlineNew: d('2027-03-01') }
    const out = applyWindowToDeadlineRound(set, windows()[0], 'NEW')
    expect(out.defaultSubmissionDeadlineNew).toEqual(d('2027-03-01'))
  })

  it('fills the ROLLING column for rolling-over invitations', () => {
    const ra: StoredRoundWindow = {
      scenario: 'RA',
      opensOn: d('2027-04-12'),
      submitBy: d('2027-05-22'),
      defaultTaxYear: null,
    }
    const out = applyWindowToDeadlineRound(baseRound, ra, 'ROLLING_OVER')
    expect(out.defaultSubmissionDeadlineRolling).toEqual(d('2027-05-22'))
    expect(out.defaultSubmissionDeadlineNew).toBeNull()
  })

  it('passes through untouched with no window / no submitBy', () => {
    expect(applyWindowToDeadlineRound(baseRound, null, 'NEW')).toEqual(baseRound)
    const noSubmit = { ...windows()[0], submitBy: null }
    expect(applyWindowToDeadlineRound(baseRound, noSubmit, 'NEW')).toEqual(baseRound)
  })
})

describe('openingDateFromWindow', () => {
  it('prefers window opensOn > round openDate > derived default', () => {
    const w = windows()[0]
    expect(openingDateFromWindow(w, d('2026-09-01'), d('2026-11-10'))).toEqual(
      d('2026-11-10'),
    )
    expect(
      openingDateFromWindow(null, d('2026-09-01'), d('2026-11-10')),
    ).toEqual(d('2026-09-01'))
    expect(openingDateFromWindow(null, null, d('2026-11-10'))).toEqual(
      d('2026-11-10'),
    )
  })
})

describe('invitationScenarioFields', () => {
  it('winter NEW invite: window fills the null deadline and supplies opening date', () => {
    const out = invitationScenarioFields({
      situation: 'NEW',
      academicYear: '2027/28',
      onDate: d('2027-01-15'),
      deadlineRound: baseRound,
      roundOpenDate: null,
      windows: windows(),
    })
    expect(out.deadlineRound?.defaultSubmissionDeadlineNew).toEqual(d('2027-04-11'))
    expect(out.openingDate).toEqual(d('2026-11-10'))
  })

  it('no stored window: derived resolver default supplies the opening date', () => {
    const out = invitationScenarioFields({
      situation: 'NEW',
      academicYear: '2027/28',
      onDate: d('2027-01-15'),
      deadlineRound: baseRound,
      roundOpenDate: null,
      windows: [],
    })
    // NA_NEXT_WINTER derived default: 10 Nov of the year before entry.
    expect(out.openingDate).toEqual(d('2026-11-10'))
    expect(out.deadlineRound).toEqual(baseRound)
  })

  it('no round (unparseable academic year): everything passes through', () => {
    const out = invitationScenarioFields({
      situation: 'NEW',
      academicYear: null,
      onDate: d('2027-01-15'),
      deadlineRound: null,
      roundOpenDate: null,
      windows: windows(),
    })
    expect(out).toEqual({ deadlineRound: null, openingDate: null })
  })
})

describe('D2 disagreement — RESOLVED by CH-47b: the scenario now wins', () => {
  /**
   * This suite used to pin the opposite precedence — "the RULE ENGINE WINS
   * until decided", with a note that a silent flip should fail loudly. It has
   * been decided: Charlotte said yes to switching the winter window on
   * 24 Aug 2026, and Epic 19 WP-D5 implemented it. Updated rather than deleted,
   * because the two behaviours and the boundary between them are exactly what a
   * future reader needs.
   */
  it('the round year alone still gives 2026/27 — unchanged when no scenario is supplied', () => {
    // Back-compat: callers that pass no basis year (the contribute path) keep
    // the old wording. This is not the disagreement any more, just the default.
    expect(getTaxYearLabels('2027/28').sa302TaxYearLabel).toBe('2026/27')
  })

  it("inside the winter window the labels now agree with her scenario table", () => {
    // A 2027/28 round worked in Jan 2027: the 2026/27 tax year has NOT ended,
    // so the form must ask for 2025/26 — which is what RoundWindow's own
    // NA_NEXT_WINTER default has always said.
    const basisYear = resolveTaxYearBasisYear({
      academicYear: '2027/28',
      applicationType: 'NEW',
      onDate: d('2027-01-15'),
    })
    expect(getTaxYearLabels('2027/28', { basisYear }).sa302TaxYearLabel).toBe(
      '2025/26',
    )
    expect(windows()[0].defaultTaxYear).toBe('2025/26')
  })

  it('outside the winter window nothing moves', () => {
    // The live production shape on the day WP-D5 shipped: a 2026/27 round in
    // Aug 2026 resolves to NA_CURRENT, so no label changes for any real family.
    const basisYear = resolveTaxYearBasisYear({
      academicYear: '2026/27',
      applicationType: 'NEW',
      onDate: d('2026-08-26'),
    })
    expect(getTaxYearLabels('2026/27', { basisYear })).toEqual(
      getTaxYearLabels('2026/27'),
    )
  })
})
