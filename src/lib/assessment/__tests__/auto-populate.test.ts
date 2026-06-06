import { describe, it, expect } from 'vitest'
import {
  applyFamilyTypeDefaults,
  deriveOverriddenFields,
  type OverridableField,
} from '../auto-populate'

describe('applyFamilyTypeDefaults (auto-populate-then-confirm)', () => {
  const current = { notionalRent: 13_000, utilityCosts: 1_200, foodCosts: 5_000 }
  const newDefaults = {
    notionalRent: 18_000,
    utilityCosts: 2_000,
    foodCosts: 8_500,
  }

  it('fills ALL fields when nothing is overridden (untouched assessment)', () => {
    const result = applyFamilyTypeDefaults(
      current,
      newDefaults,
      new Set<OverridableField>(),
    )
    expect(result).toEqual(newDefaults)
  })

  it('PRESERVES an overridden field and updates the rest (fix for the :415 regression)', () => {
    // Assessor hand-set notionalRent; a family-type change must NOT clobber it.
    const result = applyFamilyTypeDefaults(
      current,
      newDefaults,
      new Set<OverridableField>(['notionalRent']),
    )
    expect(result.notionalRent).toBe(13_000) // preserved
    expect(result.utilityCosts).toBe(2_000) // refreshed
    expect(result.foodCosts).toBe(8_500) // refreshed
  })

  it('preserves every field when all are overridden (nothing silently reverts)', () => {
    const result = applyFamilyTypeDefaults(
      current,
      newDefaults,
      new Set<OverridableField>(['notionalRent', 'utilityCosts', 'foodCosts']),
    )
    expect(result).toEqual(current)
  })

  it('documents the OLD destructive behaviour it replaces', () => {
    // The old handler unconditionally wrote all three defaults regardless of
    // edits. With an empty override set the new helper matches that (correct for
    // an untouched form) — but with an override it diverges, which is the fix.
    const oldBehaviour = { ...newDefaults }
    const withOverride = applyFamilyTypeDefaults(
      current,
      newDefaults,
      new Set<OverridableField>(['foodCosts']),
    )
    expect(withOverride).not.toEqual(oldBehaviour)
    expect(withOverride.foodCosts).toBe(5_000)
  })
})

describe('deriveOverriddenFields', () => {
  const defaults = {
    notionalRent: 18_000,
    utilityCosts: 2_000,
    foodCosts: 8_500,
    councilTax: 2_480,
  }

  it('treats a stored value differing from the default as overridden', () => {
    const set = deriveOverriddenFields(
      { notionalRent: 15_000, utilityCosts: 2_000, foodCosts: 8_500, councilTax: 2_480 },
      defaults,
    )
    expect(set.has('notionalRent')).toBe(true)
    expect(set.has('utilityCosts')).toBe(false)
    expect(set.has('foodCosts')).toBe(false)
    expect(set.has('councilTax')).toBe(false)
  })

  it('treats null / equal-to-default stored values as untouched', () => {
    const set = deriveOverriddenFields(
      { notionalRent: null, utilityCosts: 2_000, foodCosts: undefined, councilTax: 2_480 },
      defaults,
    )
    expect(set.size).toBe(0)
  })

  it('flags council tax when it differs from the default', () => {
    const set = deriveOverriddenFields({ councilTax: 3_000 }, defaults)
    expect(set.has('councilTax')).toBe(true)
  })
})
