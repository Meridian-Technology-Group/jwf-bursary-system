import { describe, it, expect } from 'vitest'
import {
  MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
  isManualAdjustmentApplied,
  normaliseManualAdjustment,
  validateManualAdjustment,
} from '../manual-adjustment'

describe('normaliseManualAdjustment', () => {
  it('passes finite numbers through, sign intact', () => {
    expect(normaliseManualAdjustment(12_500)).toBe(12_500)
    expect(normaliseManualAdjustment(-12_500)).toBe(-12_500)
    expect(normaliseManualAdjustment(0)).toBe(0)
  })

  it('treats null / undefined / NaN / Infinity as no adjustment', () => {
    expect(normaliseManualAdjustment(null)).toBe(0)
    expect(normaliseManualAdjustment(undefined)).toBe(0)
    expect(normaliseManualAdjustment(Number.NaN)).toBe(0)
    expect(normaliseManualAdjustment(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('isManualAdjustmentApplied', () => {
  it('is true for a material amount in either direction', () => {
    expect(isManualAdjustmentApplied(0.01)).toBe(true)
    expect(isManualAdjustmentApplied(-0.01)).toBe(true)
    expect(isManualAdjustmentApplied(12_500)).toBe(true)
  })

  it('is false for zero, sub-penny noise, and absent values', () => {
    expect(isManualAdjustmentApplied(0)).toBe(false)
    expect(isManualAdjustmentApplied(0.001)).toBe(false)
    expect(isManualAdjustmentApplied(null)).toBe(false)
    expect(isManualAdjustmentApplied(undefined)).toBe(false)
  })
})

describe('validateManualAdjustment — the reason is mandatory when the amount is non-zero', () => {
  it('accepts a zero amount with no reason', () => {
    expect(validateManualAdjustment({ amount: 0, reason: null })).toEqual({ ok: true })
    expect(validateManualAdjustment({ amount: undefined, reason: undefined })).toEqual({ ok: true })
  })

  it('accepts a zero amount that still carries a leftover reason (harmless)', () => {
    expect(validateManualAdjustment({ amount: 0, reason: 'was needed last year' })).toEqual({
      ok: true,
    })
  })

  it('accepts a POSITIVE amount with a reason', () => {
    expect(
      validateManualAdjustment({ amount: 12_500, reason: "Second parent's income added" }),
    ).toEqual({ ok: true })
  })

  it('accepts a NEGATIVE amount with a reason', () => {
    expect(
      validateManualAdjustment({ amount: -4_000, reason: 'Maintenance double-counted' }),
    ).toEqual({ ok: true })
  })

  it('REJECTS a non-zero amount with no reason', () => {
    expect(validateManualAdjustment({ amount: 12_500, reason: null })).toEqual({
      ok: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    })
  })

  it('REJECTS a non-zero amount with a whitespace-only reason', () => {
    expect(validateManualAdjustment({ amount: -12_500, reason: '   \n\t ' })).toEqual({
      ok: false,
      error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE,
    })
  })

  it('REJECTS a non-finite amount outright', () => {
    const result = validateManualAdjustment({ amount: Number.NaN, reason: 'anything' })
    expect(result.ok).toBe(false)
  })
})
