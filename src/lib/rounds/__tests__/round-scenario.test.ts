// Epic 14 D1 (CG-01, LA-4) — the round-scenario resolver's boundary matrix.

import { describe, expect, it } from 'vitest'

import {
  academicYearStartFor,
  defaultTaxYearLabel,
  isAfterTaxYearCutover,
  resolveRoundScenario,
} from '../round-scenario'

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

describe('academic year boundary (20 Aug)', () => {
  it('19 Aug still belongs to the previous academic year; 20 Aug starts the new one', () => {
    expect(academicYearStartFor(d('2026-08-19'))).toBe(2025)
    expect(academicYearStartFor(d('2026-08-20'))).toBe(2026)
  })
})

describe('LA-4 — the fixed 12 April tax-year cutover', () => {
  it('11 Apr is before the cutover; 12 Apr is after', () => {
    expect(isAfterTaxYearCutover(d('2027-04-11'))).toBe(false)
    expect(isAfterTaxYearCutover(d('2027-04-12'))).toBe(true)
  })

  it('drives the default tax-year label', () => {
    expect(defaultTaxYearLabel(d('2027-04-11'))).toBe('2025/26')
    expect(defaultTaxYearLabel(d('2027-04-12'))).toBe('2026/27')
  })
})

describe('resolveRoundScenario — the four scenarios', () => {
  it('ROLLING_OVER is always RA with the fixed 12 Apr → 22 May window', () => {
    const r = resolveRoundScenario({
      applicationType: 'ROLLING_OVER',
      onDate: d('2027-04-15'),
      roundStartYear: 2027,
    })
    expect(r.scenario).toBe('RA')
    expect(r.opensOn.toISOString().slice(0, 10)).toBe('2027-04-12')
    expect(r.submitBy.toISOString().slice(0, 10)).toBe('2027-05-22')
    expect(r.defaultTaxYear).toBe('2026/27')
  })

  it('NEW into the current academic year → NA_CURRENT, open 20 Aug – 19 Aug', () => {
    const r = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2026-12-01'), // academic year 2026/27
      roundStartYear: 2026,
    })
    expect(r.scenario).toBe('NA_CURRENT')
    expect(r.opensOn.toISOString().slice(0, 10)).toBe('2026-08-20')
    expect(r.submitBy.toISOString().slice(0, 10)).toBe('2027-08-19')
  })

  it('NEW for next year in the winter window → NA_NEXT_WINTER with the PREVIOUS tax year', () => {
    // Applying Jan 2027 for entry Sept 2027 (round 2027/28): the 2026/27 tax
    // year has not ended, so income is declared for 2025/26.
    const r = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-01-15'),
      roundStartYear: 2027,
    })
    expect(r.scenario).toBe('NA_NEXT_WINTER')
    expect(r.defaultTaxYear).toBe('2025/26')
    expect(r.opensOn.toISOString().slice(0, 10)).toBe('2026-11-10')
    expect(r.submitBy.toISOString().slice(0, 10)).toBe('2027-04-11')
  })

  it('NEW for next year after 12 Apr → NA_NEXT_SPRING with the CURRENT tax year', () => {
    const r = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-04-12'),
      roundStartYear: 2027,
    })
    expect(r.scenario).toBe('NA_NEXT_SPRING')
    expect(r.defaultTaxYear).toBe('2026/27')
    expect(r.opensOn.toISOString().slice(0, 10)).toBe('2027-04-12')
    expect(r.submitBy.toISOString().slice(0, 10)).toBe('2027-08-19')
  })

  it('the 11/12 Apr edge flips winter → spring exactly at the cutover', () => {
    const winter = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-04-11'),
      roundStartYear: 2027,
    })
    const spring = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-04-12'),
      roundStartYear: 2027,
    })
    expect(winter.scenario).toBe('NA_NEXT_WINTER')
    expect(spring.scenario).toBe('NA_NEXT_SPRING')
    expect(winter.defaultTaxYear).toBe('2025/26')
    expect(spring.defaultTaxYear).toBe('2026/27')
  })

  it('the 19/20 Aug edge flips current-year → next-year-current', () => {
    // On 19 Aug 2027 the 2027/28 round is still "next year" (spring window);
    // on 20 Aug 2027 it IS the current academic year.
    const before = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-08-19'),
      roundStartYear: 2027,
    })
    const after = resolveRoundScenario({
      applicationType: 'NEW',
      onDate: d('2027-08-20'),
      roundStartYear: 2027,
    })
    expect(before.scenario).toBe('NA_NEXT_SPRING')
    expect(after.scenario).toBe('NA_CURRENT')
  })

  it('22 May edge is data, not logic: RA submitBy defaults to 22 May and a RoundWindow row overrides it', () => {
    const r = resolveRoundScenario({
      applicationType: 'ROLLING_OVER',
      onDate: d('2027-05-22'),
      roundStartYear: 2027,
    })
    expect(r.submitBy.toISOString().slice(0, 10)).toBe('2027-05-22')
  })
})
