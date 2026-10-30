/**
 * Epic 23 T2: the recipient's DOB from GT's Recurring Annual forms (D-2).
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dobAsDate, dobCollisions, dobVerdict, isRecipientDobRow, parseGtDob, readGtDobs } from '../build/gt-dob'

describe('parseGtDob', () => {
  it('reads SQL Server text dates, padded or not', () => {
    expect(parseGtDob('May 12 2015 12:00AM')).toBe('2015-05-12')
    expect(parseGtDob('May  2 2015 12:00AM')).toBe('2015-05-02')
    expect(parseGtDob('Sep 30 2010 12:00:00:000AM')).toBe(null) // not a shape GT writes; never guessed
    expect(parseGtDob('Sep 30 2010')).toBe('2010-09-30')
  })
  it('reads ISO, UK day-first and long forms', () => {
    expect(parseGtDob('2015-05-12')).toBe('2015-05-12')
    expect(parseGtDob('2015-05-12T00:00:00.000Z')).toBe('2015-05-12')
    expect(parseGtDob('12/05/2015')).toBe('2015-05-12')
    expect(parseGtDob('12 May 2015')).toBe('2015-05-12')
    expect(parseGtDob('2 September 2014')).toBe('2014-09-02')
  })
  it('returns null for blanks, placeholders and impossible dates', () => {
    expect(parseGtDob('')).toBe(null)
    expect(parseGtDob(null)).toBe(null)
    expect(parseGtDob('{Value:null}')).toBe(null)
    expect(parseGtDob('Feb 30 2015 12:00AM')).toBe(null)
    expect(parseGtDob('31/02/2015')).toBe(null)
    expect(parseGtDob('soon')).toBe(null)
  })
})

describe('dobVerdict', () => {
  it('the same date written two ways is consistent', () => {
    expect(dobVerdict(['May 12 2015 12:00AM', '12/05/2015', '{Value:null}'])).toEqual({ status: 'CONSISTENT', dob: '2015-05-12', forms: 3 })
  })
  it('two different dates conflict', () => {
    expect(dobVerdict(['May 12 2015 12:00AM', 'May 21 2015 12:00AM'])).toEqual({
      status: 'CONFLICT',
      dates: ['2015-05-12', '2015-05-21'],
      forms: 2,
    })
  })
  it('no usable date is NONE', () => {
    expect(dobVerdict([])).toEqual({ status: 'NONE', forms: 0 })
    expect(dobVerdict(['{Value:null}'])).toEqual({ status: 'NONE', forms: 1 })
  })
})

describe('isRecipientDobRow', () => {
  const row = (ftype: string, grid: string, control: string) => [ftype, 'eid', grid, '', control, 'rid', 'May 12 2015 12:00AM']
  it('keeps only the top-level control on the Recurring Annual form', () => {
    expect(isRecipientDobRow(row('Recurring Annual Bursary Assessment - V1', '', 'Date of birth'))).toBe(true)
    expect(isRecipientDobRow(row('Recurring Annual Bursary Assessment - V1', 'Dependent children information', 'Date of birth'))).toBe(false)
    expect(isRecipientDobRow(row('Recurring Annual Bursary Assessment - V1', 'Dependent elderly information', 'Date of birth'))).toBe(false)
    expect(isRecipientDobRow(row('Fees Assessment - V1', '', 'Date of birth'))).toBe(false)
    expect(isRecipientDobRow(['too', 'short'])).toBe(false)
  })
})

describe('dobCollisions', () => {
  it('flags same lead + same child name + same DOB only', () => {
    expect(
      dobCollisions([
        { key: 'a', leadEmail: 'P@x.com', childName: 'Sam X', dob: '2015-05-12' },
        { key: 'b', leadEmail: 'p@x.com ', childName: 'sam x', dob: '2015-05-12' },
        { key: 'c', leadEmail: 'p@x.com', childName: 'Sam X', dob: '2016-01-01' },
        { key: 'd', leadEmail: 'p@x.com', childName: 'Sam X', dob: null },
      ]),
    ).toEqual([['a', 'b']])
  })
})

describe('dobAsDate', () => {
  it('is UTC midnight, as Prisma writes a @db.Date', () => {
    expect(dobAsDate('2015-05-12').toISOString()).toBe('2015-05-12T00:00:00.000Z')
  })
})

describe('readGtDobs', () => {
  it('links forms to grants through gt_progress and ignores grid rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gt-dob-'))
    const progress = join(dir, 'gt_progress.tsv')
    const forms = join(dir, 'gt_forms.tsv')
    writeFileSync(progress, ['f1\tG1\tAnnualType', 'f2\tG1\tAnnualType', 'f3\tG2\tAnnualType', 'f4\tG3\tAnnualType'].join('\n'))
    const R = 'Recurring Annual Bursary Assessment - V1'
    writeFileSync(
      forms,
      [
        `${R}\tf1\t\t\tDate of birth\tr\tMay 12 2015 12:00AM`,
        `${R}\tf2\t\t\tDate of birth\tr\tMay 12 2015 12:00AM`,
        `${R}\tf2\tDependent children information\t1\tDate of birth\tr\tJan  1 2019 12:00AM`,
        `${R}\tf3\t\t\tDate of birth\tr\tMay 12 2015 12:00AM`,
        `${R}\tf3\t\t\tDate of birth\tr\tJun 12 2015 12:00AM`,
        `${R}\tf4\t\t\tDate of birth\tr\tMay 12 2015 12:00AM`,
      ].join('\n'),
    )
    const out = await readGtDobs(progress, forms, new Set(['G1', 'G2', 'G9']))
    expect(out.get('G1')).toEqual({ status: 'CONSISTENT', dob: '2015-05-12', forms: 2 })
    expect(out.get('G2')?.status).toBe('CONFLICT')
    expect(out.get('G9')).toEqual({ status: 'NONE', forms: 0 })
    expect(out.has('G3')).toBe(false)
  })
})
