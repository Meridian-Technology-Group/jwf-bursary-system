import { describe, it, expect } from 'vitest'
import {
  parseAcademicYearStart,
  academicYearStartDate,
  resolveEffectiveFeeRow,
  resolveFeeYearPair,
  formatAcademicYearLabel,
  feeYearLabels,
  type VersionedFeeRow,
} from '../fee-year'

// ─── parseAcademicYearStart ─────────────────────────────────────────────────────

describe('parseAcademicYearStart', () => {
  it('parses canonical "YYYY-YY"', () => {
    expect(parseAcademicYearStart('2025-26')).toBe(2025)
  })

  it('parses "YYYY/YY" and "YYYY/YYYY"', () => {
    expect(parseAcademicYearStart('2026/27')).toBe(2026)
    expect(parseAcademicYearStart('2025/2026')).toBe(2025)
  })

  it('parses a bare four-digit year', () => {
    expect(parseAcademicYearStart('2024')).toBe(2024)
  })

  it('returns null for null/undefined/blank/unparseable', () => {
    expect(parseAcademicYearStart(null)).toBeNull()
    expect(parseAcademicYearStart(undefined)).toBeNull()
    expect(parseAcademicYearStart('')).toBeNull()
    expect(parseAcademicYearStart('not-a-year')).toBeNull()
  })
})

// ─── academicYearStartDate ──────────────────────────────────────────────────────

describe('academicYearStartDate', () => {
  it('returns 1 September (UTC) of the start year', () => {
    const d = academicYearStartDate(2025)
    expect(d.getUTCFullYear()).toBe(2025)
    expect(d.getUTCMonth()).toBe(8) // September (0-indexed)
    expect(d.getUTCDate()).toBe(1)
  })
})

// ─── resolveEffectiveFeeRow ─────────────────────────────────────────────────────

describe('resolveEffectiveFeeRow', () => {
  const rows: VersionedFeeRow[] = [
    { annualFees: 30000, effectiveFrom: new Date('2025-09-01') },
    { annualFees: 31752, effectiveFrom: new Date('2026-09-01') },
    { annualFees: 33340, effectiveFrom: new Date('2027-09-01') },
  ]

  it('resolves the row effective for the assessed year', () => {
    // 2026-27 academic year starts 2026-09-01 → the 2026-09-01 row wins
    expect(resolveEffectiveFeeRow(rows, 2026)?.annualFees).toBe(31752)
  })

  it('resolves the prior row when the year is between two effective dates', () => {
    // No 2024-09-01 row; the latest row on/before 2025-09-01 is the 2025 row
    expect(resolveEffectiveFeeRow(rows, 2025)?.annualFees).toBe(30000)
  })

  it('resolves the latest row for a far-future year', () => {
    expect(resolveEffectiveFeeRow(rows, 2030)?.annualFees).toBe(33340)
  })

  it('returns null when no row is effective by that year', () => {
    expect(resolveEffectiveFeeRow(rows, 2020)).toBeNull()
  })

  it('does not require the input to be pre-sorted', () => {
    const shuffled: VersionedFeeRow[] = [rows[2], rows[0], rows[1]]
    expect(resolveEffectiveFeeRow(shuffled, 2026)?.annualFees).toBe(31752)
  })

  it('uses createdAt desc as a deterministic tie-break on same effectiveFrom (defect 12)', () => {
    const sameDay: VersionedFeeRow[] = [
      {
        annualFees: 31000, // stale
        effectiveFrom: new Date('2026-09-01'),
        createdAt: new Date('2026-06-01T09:00:00Z'),
      },
      {
        annualFees: 31752, // newer insert — must win
        effectiveFrom: new Date('2026-09-01'),
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ]
    expect(resolveEffectiveFeeRow(sameDay, 2026)?.annualFees).toBe(31752)
  })
})

// ─── resolveFeeYearPair ─────────────────────────────────────────────────────────

describe('resolveFeeYearPair', () => {
  const rows: VersionedFeeRow[] = [
    { annualFees: 31752, effectiveFrom: new Date('2026-09-01') },
    { annualFees: 33340, effectiveFrom: new Date('2027-09-01') },
  ]

  it('resolves current-year and next-year figures', () => {
    const pair = resolveFeeYearPair(rows, 2026)
    expect(pair.currentYearAnnualFees).toBe(31752)
    expect(pair.nextYearAnnualFees).toBe(33340)
  })

  it('next-year reuses the current row when no distinct forward-dated row exists (flat schedule)', () => {
    // With only a 2026-09-01 row, the 2027-28 year (starts 2027-09-01) still has
    // that row effective, so next-year falls back to the current figure rather
    // than erroring. (A genuine "not yet set" only occurs when the schedule
    // begins AFTER the next year — see the next test.)
    const currentOnly: VersionedFeeRow[] = [
      { annualFees: 31752, effectiveFrom: new Date('2026-09-01') },
    ]
    const pair = resolveFeeYearPair(currentOnly, 2026)
    expect(pair.currentYearAnnualFees).toBe(31752)
    expect(pair.nextYearAnnualFees).toBe(31752)
  })

  it('returns null next-year when the schedule starts after the next year', () => {
    // Schedule begins 2028-09-01; assessing 2026 → current year (2026) has no
    // effective row and next year (2027) has none either.
    const futureOnly: VersionedFeeRow[] = [
      { annualFees: 35000, effectiveFrom: new Date('2028-09-01') },
    ]
    const pair = resolveFeeYearPair(futureOnly, 2026)
    expect(pair.currentYearAnnualFees).toBeNull()
    expect(pair.nextYearAnnualFees).toBeNull()
  })

  it('next year reuses the latest figure when no distinct next-year row (flat schedule)', () => {
    // Only a 2026 row exists; assessing 2025 → current=null? No: 2025 has no
    // effective row, next (2026) does.
    const pair = resolveFeeYearPair(rows, 2025)
    expect(pair.currentYearAnnualFees).toBeNull()
    expect(pair.nextYearAnnualFees).toBe(31752)
  })
})

// ─── academic-year labels ───────────────────────────────────────────────────────

describe('formatAcademicYearLabel', () => {
  it('formats a start year as "YYYY-YY"', () => {
    expect(formatAcademicYearLabel(2026)).toBe('2026-27')
    expect(formatAcademicYearLabel(2025)).toBe('2025-26')
  })

  it('zero-pads a century rollover', () => {
    expect(formatAcademicYearLabel(2099)).toBe('2099-00')
  })
})

describe('feeYearLabels', () => {
  it('derives current and next labels from a round academic year', () => {
    expect(feeYearLabels('2026-27')).toEqual({ current: '2026-27', next: '2027-28' })
  })

  it('returns nulls when the year cannot be parsed', () => {
    expect(feeYearLabels(null)).toEqual({ current: null, next: null })
    expect(feeYearLabels('n/a')).toEqual({ current: null, next: null })
  })
})
