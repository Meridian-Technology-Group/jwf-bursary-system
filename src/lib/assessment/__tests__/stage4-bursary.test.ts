import { describe, it, expect } from 'vitest'
import { calculateBursaryImpact } from '../stage4-bursary'

describe('calculateBursaryImpact', () => {
  it('calculates a partial bursary when HNDI is positive but less than fees', () => {
    // requiredBursary = 31752 - 11020 = 20732
    expect(calculateBursaryImpact(11_020, 31_752)).toBe(20_732)
  })

  it('returns full bursary (annualFees) when HNDI is zero', () => {
    expect(calculateBursaryImpact(0, 31_752)).toBe(31_752)
  })

  it('returns full bursary when HNDI is negative', () => {
    // Family cannot cover living costs, must receive full bursary
    expect(calculateBursaryImpact(-5_000, 31_752)).toBe(31_752)
  })

  it('returns 0 bursary when HNDI exactly equals annual fees', () => {
    // Family can just afford fees — no bursary needed
    expect(calculateBursaryImpact(31_752, 31_752)).toBe(0)
  })

  it('returns 0 bursary when HNDI exceeds annual fees', () => {
    // Wealthy family — no bursary awarded
    expect(calculateBursaryImpact(50_000, 31_752)).toBe(0)
  })

  it('returns 0 when annual fees are 0', () => {
    expect(calculateBursaryImpact(10_000, 0)).toBe(0)
  })

  it('returns 0 when HNDI is slightly above fees', () => {
    expect(calculateBursaryImpact(31_753, 31_752)).toBe(0)
  })

  it('returns full fees when HNDI is very large negative', () => {
    expect(calculateBursaryImpact(-100_000, 31_752)).toBe(31_752)
  })

  it('handles small partial bursary correctly', () => {
    // HNDI = fees - 1 => bursary = 1
    expect(calculateBursaryImpact(31_751, 31_752)).toBe(1)
  })

  it('clamps to annualFees even when formula result would exceed it', () => {
    // HNDI = -50000, fees = 10000 => raw = 60000, clamped to 10000
    expect(calculateBursaryImpact(-50_000, 10_000)).toBe(10_000)
  })
})
