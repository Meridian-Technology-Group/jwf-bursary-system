import { describe, it, expect } from 'vitest'
import { calculateLivingCosts } from '../stage3-living'

describe('calculateLivingCosts', () => {
  it('deducts utility and food costs from net assets', () => {
    // 21520 - 2000 - 8500 = 11020
    expect(calculateLivingCosts(21_520, 2_000, 8_500)).toBe(11_020)
  })

  it('returns a negative number when costs exceed net assets', () => {
    // 5000 - 3000 - 4000 = -2000
    expect(calculateLivingCosts(5_000, 3_000, 4_000)).toBe(-2_000)
  })

  it('returns 0 when net assets exactly equal combined costs', () => {
    expect(calculateLivingCosts(10_000, 4_000, 6_000)).toBe(0)
  })

  it('handles zero utility and food costs', () => {
    expect(calculateLivingCosts(25_000, 0, 0)).toBe(25_000)
  })

  it('handles zero net assets with costs present (very negative result)', () => {
    expect(calculateLivingCosts(0, 2_500, 7_000)).toBe(-9_500)
  })

  it('handles negative net assets from Stage 2 (compounds the negative)', () => {
    // Already negative after Stage 2, costs make it more negative
    expect(calculateLivingCosts(-5_000, 2_000, 3_000)).toBe(-10_000)
  })

  it('handles decimal values correctly', () => {
    const result = calculateLivingCosts(21_520.5, 2_000.25, 8_500.75)
    expect(result).toBeCloseTo(11_019.5, 5)
  })
})
