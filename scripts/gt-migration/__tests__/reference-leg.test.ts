import { describe, expect, it } from 'vitest'
import { legValue, recommendedFromLeg } from '../build/reference-leg'

const legs = { actualRemainingDi: 7418.123456789, theoreticalBenchmarkDi: -15381.5, affordabilityAdjustedDi: 484.455 }

describe('reference leg (batch 1, 8 Oct)', () => {
  it('defaults to the actual leg, exactly as the engine gives it', () => {
    expect(recommendedFromLeg(legs)).toBe(7418.123456789)
    expect(recommendedFromLeg(legs, null)).toBe(7418.123456789)
    expect(recommendedFromLeg(legs, 'ACTUAL')).toBe(7418.123456789)
  })

  it('takes another leg, floored at £0 and rounded to pennies', () => {
    expect(legValue(legs, 'AFFORDABILITY')).toBe(484.455)
    expect(recommendedFromLeg(legs, 'AFFORDABILITY')).toBe(484.46)
    expect(recommendedFromLeg(legs, 'THEORETICAL')).toBe(0)
  })
})
