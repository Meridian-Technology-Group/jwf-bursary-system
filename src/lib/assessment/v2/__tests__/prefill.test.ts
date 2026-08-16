import { describe, it, expect } from 'vitest'
import {
  emptyAssessmentPrefill,
  emptyIncomeRecord,
  isIncomeRecordEmpty,
  shouldEnableSecondEarner,
} from '../prefill'
import { calculateHouseholdNetIncome } from '../income'
import type { AssessorIncomeRecord } from '@/types/assessment-v2'

// ─── Epic 14 C4 (CG-15 / D14-3) — the empty first-load prefill ───────────────
// The CALC-07 applicant-section mappers were REMOVED with the behaviour they
// implemented; these tests pin the sanctioned replacement: a first load
// carries no applicant-declared figure anywhere.

describe('emptyAssessmentPrefill', () => {
  it('carries no figures, no assets, no debts, no toggles', () => {
    const p = emptyAssessmentPrefill()
    expect(p.parent1Income).toEqual({ total: 0, documentsConfirmed: false })
    expect(p.parent2Income).toEqual({ total: 0, documentsConfirmed: false })
    expect(p.propertyAssets).toEqual({})
    expect(p.debts).toEqual({})
    expect(p.cashSavings).toBe(0)
    expect(p.isasPepsShares).toBe(0)
    expect(p.usesCar).toBe(false)
    expect(p.usesPublicTransport).toBe(false)
    expect(p.portfolioType).toBe('RENTING')
  })

  it('returns fresh objects each call (no shared mutable state)', () => {
    const a = emptyAssessmentPrefill()
    const b = emptyAssessmentPrefill()
    expect(a).not.toBe(b)
    expect(a.parent1Income).not.toBe(b.parent1Income)
  })

  it('emptyIncomeRecord reads as empty to the second-earner derivation', () => {
    expect(isIncomeRecordEmpty(emptyIncomeRecord())).toBe(true)
  })
})

// ─── Second-earner derivation (review fix #1) ───────────────────────────────

describe('isIncomeRecordEmpty', () => {
  it('true for null/undefined and for a bare placeholder record', () => {
    expect(isIncomeRecordEmpty(null)).toBe(true)
    expect(isIncomeRecordEmpty(undefined)).toBe(true)
    expect(isIncomeRecordEmpty({ total: 0, documentsConfirmed: false })).toBe(true)
  })

  it('false when any income sub-block is present — even at £0', () => {
    expect(
      isIncomeRecordEmpty({ employed: { annualSalaryPaye: 0 }, total: 0, documentsConfirmed: false })
    ).toBe(false)
  })

  it('false when a nonzero total is carried without sub-blocks', () => {
    expect(isIncomeRecordEmpty({ total: 12_000, documentsConfirmed: false })).toBe(false)
  })
})

describe('shouldEnableSecondEarner', () => {
  const empty = { total: 0, documentsConfirmed: false }
  const populated = { employed: { annualSalaryPaye: 18_000 }, total: 18_000, documentsConfirmed: false }

  it('locked on when a submitted secondary forces two-earner mode', () => {
    expect(shouldEnableSecondEarner(true, null, empty)).toBe(true)
  })

  it('enabled by a populated STORED Parent 2 record', () => {
    expect(shouldEnableSecondEarner(false, populated, empty)).toBe(true)
  })

  it('enabled by a populated PREFILL Parent 2 record (single-primary submission with parent2Income)', () => {
    expect(shouldEnableSecondEarner(false, null, populated)).toBe(true)
  })

  it('disabled when there is no forced mode and both records are empty', () => {
    expect(shouldEnableSecondEarner(false, empty, empty)).toBe(false)
    expect(shouldEnableSecondEarner(false, null, null)).toBe(false)
  })
})

describe('regression — a real Parent 2 record is never silently discarded', () => {
  it('a STORED Parent 2 record enables the second earner and both earners sum', () => {
    // D14-3 removed the applicant-section prefill, so the ONLY ways Parent 2
    // enables are a submitted secondary contributor (forced) or a populated
    // STORED assessor record. The engine summing both earners is unchanged.
    const p1: AssessorIncomeRecord = {
      employed: { annualSalaryPaye: 30_000 },
      total: 0,
      documentsConfirmed: true,
    }
    const p2: AssessorIncomeRecord = {
      employed: { annualSalaryPaye: 18_000 },
      total: 0,
      documentsConfirmed: true,
    }

    expect(shouldEnableSecondEarner(false, p2, null)).toBe(true)
    expect(calculateHouseholdNetIncome([p1, p2])).toBe(48_000)
  })

  it('an empty prefill never enables the second earner on its own', () => {
    const prefill = emptyAssessmentPrefill()
    expect(shouldEnableSecondEarner(false, null, prefill.parent2Income)).toBe(false)
  })
})
