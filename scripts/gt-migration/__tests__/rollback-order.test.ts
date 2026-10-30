/**
 * The rollback deletes in reverse creation order. Epic 21 R1: the account's
 * Main synopsis (a ledgered MAIN entry) goes before its assessment and account,
 * so a reload of the assessments phase can write it afresh without tripping the
 * one-MAIN-per-account index.
 */
import { describe, expect, it } from 'vitest'
import { ORDER } from '../load/rollback'

describe('rollback ORDER', () => {
  it('removes the Main synopsis entry before its assessment and account', () => {
    const at = (t: (typeof ORDER)[number]) => ORDER.indexOf(t)
    expect(at('AccountSynopsisEntry')).toBeGreaterThanOrEqual(0)
    expect(at('AccountSynopsisEntry')).toBeLessThan(at('Assessment'))
    expect(at('AccountSynopsisEntry')).toBeLessThan(at('BursaryAccount'))
  })

  it('lists each entity type once', () => {
    expect(new Set(ORDER).size).toBe(ORDER.length)
  })
})
