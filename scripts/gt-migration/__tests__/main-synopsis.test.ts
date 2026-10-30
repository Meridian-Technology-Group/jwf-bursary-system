/**
 * Epic 21 R1: the toolkit writes ONE Main synopsis (kind MAIN, no assessment,
 * no academic year) per migrated account, and A12 / verify accept exactly that.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { findMainSynopsis, mainSynopsisProblem, writeMainSynopsis, type SynopsisEntryShape } from '../load/main-synopsis'

type Tx = Prisma.TransactionClient

function fakeTx(existing: { id: string } | null) {
  return {
    accountSynopsisEntry: {
      findFirst: vi.fn(async () => existing),
      create: vi.fn(async () => ({ id: 'main-new' })),
    },
  }
}

describe('writeMainSynopsis', () => {
  it('writes a MAIN entry with no assessment or year, trimmed, and returns its id', async () => {
    const tx = fakeTx(null)
    expect(await writeMainSynopsis(tx as unknown as Tx, 'acc-1', '  GT synopsis.  ')).toBe('main-new')
    expect(tx.accountSynopsisEntry.findFirst).toHaveBeenCalledWith({ where: { bursaryAccountId: 'acc-1', kind: 'MAIN' }, select: { id: true } })
    expect(tx.accountSynopsisEntry.create).toHaveBeenCalledWith({
      data: { bursaryAccountId: 'acc-1', kind: 'MAIN', body: 'GT synopsis.', assessmentId: null, academicYear: null, createdById: null },
      select: { id: true },
    })
  })

  it('returns null and writes nothing when the account already has a MAIN', async () => {
    const tx = fakeTx({ id: 'main-old' })
    expect(await writeMainSynopsis(tx as unknown as Tx, 'acc-1', 'GT synopsis.')).toBeNull()
    expect(tx.accountSynopsisEntry.create).not.toHaveBeenCalled()
  })

  it('refuses a blank synopsis before touching the database', async () => {
    const tx = fakeTx(null)
    await expect(writeMainSynopsis(tx as unknown as Tx, 'acc-1', '  ')).rejects.toThrow(/blank synopsis/)
    await expect(writeMainSynopsis(tx as unknown as Tx, 'acc-1', null)).rejects.toThrow(/blank synopsis/)
    expect(tx.accountSynopsisEntry.findFirst).not.toHaveBeenCalled()
    expect(tx.accountSynopsisEntry.create).not.toHaveBeenCalled()
  })

  it('never writes a YEAR entry', async () => {
    const tx = fakeTx(null)
    await writeMainSynopsis(tx as unknown as Tx, 'acc-1', 'x')
    const calls = tx.accountSynopsisEntry.create.mock.calls as unknown as [{ data: { kind: string } }][]
    expect(calls.every(([arg]) => arg.data.kind === 'MAIN')).toBe(true)
  })
})

describe('findMainSynopsis', () => {
  it('looks up the MAIN on the account only', async () => {
    const tx = fakeTx({ id: 'm' })
    expect(await findMainSynopsis(tx as unknown as Tx, 'acc-9')).toEqual({ id: 'm' })
    expect(tx.accountSynopsisEntry.findFirst).toHaveBeenCalledWith({ where: { bursaryAccountId: 'acc-9', kind: 'MAIN' }, select: { id: true } })
  })
})

describe('mainSynopsisProblem (A12)', () => {
  const main = (over: Partial<SynopsisEntryShape> = {}): SynopsisEntryShape => ({
    id: 'm1',
    kind: 'MAIN',
    bursaryAccountId: 'acc-1',
    assessmentId: null,
    academicYear: null,
    body: 'GT synopsis.',
    ...over,
  })

  it('passes exactly one MAIN on the account', () => {
    expect(mainSynopsisProblem([main()], 'acc-1')).toBeNull()
  })

  it('checks the body only when asked (at load), against the trimmed text', () => {
    expect(mainSynopsisProblem([main()], 'acc-1', '  GT synopsis. ')).toBeNull()
    expect(mainSynopsisProblem([main({ body: 'Staff edit.' })], 'acc-1', 'GT synopsis.')).toMatch(/differs/)
    // verify omits it: a staff edit of the Main synopsis is not a fault.
    expect(mainSynopsisProblem([main({ body: 'Staff edit.' })], 'acc-1')).toBeNull()
  })

  it('fails with no MAIN, or two', () => {
    expect(mainSynopsisProblem([], 'acc-1')).toMatch(/0 main synopsis entries/)
    expect(mainSynopsisProblem([main(), main({ id: 'm2' })], 'acc-1')).toMatch(/2 main synopsis entries/)
  })

  it('fails on a retired YEAR or NOTE entry, even beside a good MAIN', () => {
    const year = main({ id: 'y1', kind: 'YEAR', assessmentId: 'as-1', academicYear: '2026/27' })
    expect(mainSynopsisProblem([main(), year], 'acc-1')).toMatch(/retired YEAR/)
    expect(mainSynopsisProblem([year], 'acc-1')).toMatch(/retired YEAR/)
    expect(mainSynopsisProblem([main(), main({ id: 'n1', kind: 'NOTE' })], 'acc-1')).toMatch(/retired NOTE/)
  })

  it('fails a MAIN that carries an assessment or academic year, or sits on another account', () => {
    expect(mainSynopsisProblem([main({ assessmentId: 'as-1' })], 'acc-1')).toMatch(/assessment or academic year/)
    expect(mainSynopsisProblem([main({ academicYear: '2026/27' })], 'acc-1')).toMatch(/assessment or academic year/)
    expect(mainSynopsisProblem([main({ bursaryAccountId: 'acc-2' })], 'acc-1')).toMatch(/another account/)
  })
})
