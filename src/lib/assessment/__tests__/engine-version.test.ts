import { describe, it, expect } from 'vitest'
import { CURRENT_CALCULATION_VERSION, selectEngineVersion } from '../engine-version'

describe('CURRENT_CALCULATION_VERSION (CALC-14)', () => {
  it('is 2 — the shared default every assessment-creation path stamps new rows with', () => {
    expect(CURRENT_CALCULATION_VERSION).toBe(2)
  })

  it('resolves to the v2 engine via selectEngineVersion', () => {
    expect(selectEngineVersion(CURRENT_CALCULATION_VERSION)).toBe('v2')
  })
})

describe('selectEngineVersion', () => {
  it('selects v2 only for an explicit calculationVersion of 2', () => {
    expect(selectEngineVersion(2)).toBe('v2')
  })

  it('selects v1 for calculationVersion 1', () => {
    expect(selectEngineVersion(1)).toBe('v1')
  })

  it('selects v1 for null / undefined (pre-CALC-02 rows)', () => {
    expect(selectEngineVersion(null)).toBe('v1')
    expect(selectEngineVersion(undefined)).toBe('v1')
  })

  it('selects v1 for any other version number (defensive default)', () => {
    expect(selectEngineVersion(0)).toBe('v1')
    expect(selectEngineVersion(3)).toBe('v1')
  })
})
