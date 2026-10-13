/**
 * The rollback deletes in reverse creation order. Epic 21 #6: a YEAR entry in
 * the standing synopsis must go before its assessment, or the FK's SET NULL
 * leaves an orphan that a reload duplicates.
 */
import { describe, expect, it } from 'vitest'
import { ORDER } from '../load/rollback'

describe('rollback ORDER', () => {
  it('removes the standing-synopsis entry before its assessment and account', () => {
    const at = (t: (typeof ORDER)[number]) => ORDER.indexOf(t)
    expect(at('AccountSynopsisEntry')).toBeGreaterThanOrEqual(0)
    expect(at('AccountSynopsisEntry')).toBeLessThan(at('Assessment'))
    expect(at('AccountSynopsisEntry')).toBeLessThan(at('BursaryAccount'))
  })

  it('lists each entity type once', () => {
    expect(new Set(ORDER).size).toBe(ORDER.length)
  })
})
