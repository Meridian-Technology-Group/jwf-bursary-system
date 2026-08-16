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
import { getTaxYearLabels } from '@/lib/portal/tax-year'

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

describe('D2 documented disagreement — tax year (rule engine wins)', () => {
  it('winter window wants 2025/26 but the Epic 02 rule engine keeps 2026/27', () => {
    // A 2027/28 round: the rule engine derives the (Y-1)/Y tax year from the
    // round year alone — 2026/27 — even during the winter window when that
    // year has not ended. Charlotte's table wants 2025/26 there. Per the
    // Epic 14 plan the RULE ENGINE WINS until decided; this test pins the
    // agreed precedence so a silent flip fails loudly.
    expect(getTaxYearLabels('2027/28').sa302TaxYearLabel).toBe('2026/27')
    expect(windows()[0].defaultTaxYear).toBe('2025/26')
  })
})
