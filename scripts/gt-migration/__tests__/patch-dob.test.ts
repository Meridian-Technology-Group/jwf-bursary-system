/**
 * Epic 23 T2: `mig patch-dob` pure seams (D-3, D-4).
 */
import { describe, expect, it } from 'vitest'
import { blankReason, familyCodeOf, liveSets, parseDobFile, referenceKey, type PatchLine } from '../load/patch-dob'

describe('familyCodeOf', () => {
  it('reads the code however the reference is spaced', () => {
    expect(familyCodeOf('TS-NOWS01-SURNAME, First')).toBe('TS-NOWS01')
    expect(familyCodeOf('WS - ABCD02 - SURNAME, First')).toBe('WS-ABCD02')
    expect(familyCodeOf('OP- ABC04 -SURNAME')).toBe('OP-ABC04')
    expect(familyCodeOf('XX-AB01-YY')).toBe('XX-AB01')
  })
  it('is null when there is no code', () => {
    expect(familyCodeOf('24/25_Trinity School_Someone_098')).toBe(null)
    expect(familyCodeOf(null)).toBe(null)
  })
})

describe('blankReason', () => {
  it('names why a DOB was left blank, or null when it was set', () => {
    expect(blankReason(undefined, false)).toBe('new award, no GT annual form')
    expect(blankReason({ status: 'NONE', forms: 0 }, false)).toBe('new award, no GT annual form')
    expect(blankReason({ status: 'CONFLICT', dates: ['2015-01-01', '2015-01-02'], forms: 2 }, false)).toBe('dates differ across years')
    expect(blankReason({ status: 'CONSISTENT', dob: '2015-01-01', forms: 3 }, true)).toBe('same name and date as a sibling')
    expect(blankReason({ status: 'CONSISTENT', dob: '2015-01-01', forms: 3 }, false)).toBe(null)
  })
})

describe('liveSets', () => {
  const line = (op: 'set' | 'undo', table: PatchLine['table'], id: string): PatchLine => ({
    op,
    runId: 'r',
    accountKey: 'k',
    table,
    id,
    value: '2015-01-01',
    at: 'now',
  })
  it('a set is live until an undo for the same cell follows it', () => {
    const lines = [line('set', 'contacts', 'c1'), line('set', 'applications', 'a1'), line('undo', 'contacts', 'c1')]
    expect(liveSets(lines).map((l) => `${l.table}:${l.id}`)).toEqual(['applications:a1'])
  })
  it('a re-set after an undo is live again', () => {
    const lines = [line('set', 'contacts', 'c1'), line('undo', 'contacts', 'c1'), line('set', 'contacts', 'c1')]
    expect(liveSets(lines)).toHaveLength(1)
  })
  it('the same id in another table is a different cell', () => {
    const lines = [line('set', 'contacts', 'x'), line('undo', 'applications', 'x')]
    expect(liveSets(lines)).toHaveLength(1)
  })
})

describe('--dob-file (her dates for the blanks, 17 Oct 2026)', () => {
  it('matches references however they are spaced or cased', () => {
    expect(referenceKey('TS - NOWS01 - SURNAME, First')).toBe(referenceKey('ts-nows01-surname,first'))
    expect(referenceKey(null)).toBe('')
  })
  it('reads reference,dob rows, quoted references included', () => {
    const m = parseDobFile('reference,dob\n"TS - AB01 - SURNAME, First",2014-09-02\r\n24/25_Trinity School_Someone_098,2010-01-31\n')
    expect(m.get(referenceKey('TS-AB01-SURNAME, First'))).toBe('2014-09-02')
    expect(m.get(referenceKey('24/25_Trinity School_Someone_098'))).toBe('2010-01-31')
    expect(m.size).toBe(2)
  })
  it('refuses a bad header, a bad date or a repeated reference', () => {
    expect(() => parseDobFile('ref,date\nX,2014-01-01')).toThrow(/header/)
    expect(() => parseDobFile('reference,dob\nX,02/09/2014')).toThrow(/bad row/)
    expect(() => parseDobFile('reference,dob\nX,2014-01-01\n x ,2014-01-02')).toThrow(/twice/)
  })
})

