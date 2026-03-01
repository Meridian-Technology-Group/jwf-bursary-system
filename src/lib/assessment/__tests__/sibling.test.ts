import { describe, it, expect } from 'vitest'
import { applySiblingDeductions } from '../sibling'

describe('applySiblingDeductions', () => {
  it('returns hndi unchanged when there are no siblings', () => {
    expect(applySiblingDeductions(15_000, [])).toBe(15_000)
  })

  it('deducts a single sibling payable fee', () => {
    // hndi 15000 - sibling fees 8000 = 7000
    expect(applySiblingDeductions(15_000, [8_000])).toBe(7_000)
  })

  it('chains deductions for two siblings in order', () => {
    // hndi 20000 - first sibling 8000 = 12000 - second sibling 5000 = 7000
    expect(applySiblingDeductions(20_000, [8_000, 5_000])).toBe(7_000)
  })

  it('allows result to go negative when sibling fees exceed hndi', () => {
    // hndi 5000 - sibling fees 8000 = -3000
    expect(applySiblingDeductions(5_000, [8_000])).toBe(-3_000)
  })

  it('handles multiple siblings where total fees greatly exceed hndi', () => {
    // hndi 10000 - 6000 - 7000 = -3000
    expect(applySiblingDeductions(10_000, [6_000, 7_000])).toBe(-3_000)
  })

  it('works correctly with zero sibling fees', () => {
    expect(applySiblingDeductions(12_000, [0, 0])).toBe(12_000)
  })

  it('works correctly when hndi is already negative', () => {
    // hndi already -2000, deduct 3000 more = -5000
    expect(applySiblingDeductions(-2_000, [3_000])).toBe(-5_000)
  })

  it('handles fractional sibling fees', () => {
    // hndi 10000 - 3333.33 = 6666.67
    expect(applySiblingDeductions(10_000, [3_333.33])).toBeCloseTo(6_666.67, 2)
  })
})
