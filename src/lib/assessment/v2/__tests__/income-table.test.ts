// Epic 14 C5 (CG-20) — the Part 2 income-table row model + record helpers.
//
// Two things are pinned: (1) every bound row maps onto a real
// AssessorIncomeRecord path and entering figures row-wise produces exactly the
// household total the engine computed before (parity — presentation change
// only, D14-4); (2) the block-presence semantics survive the table (writes
// materialise a sub-block; zeroing the last value removes it).

import { describe, expect, it } from 'vitest'

import {
  INCOME_TABLE_ROWS,
  getEarnerField,
  setEarnerField,
} from '../income-table'
import {
  calculateEarnerIncome,
  calculateHouseholdNetIncome,
} from '../income'
import { isIncomeRecordEmpty } from '../prefill'
import type { AssessorIncomeRecord } from '@/types/assessment-v2'

const empty = (): AssessorIncomeRecord => ({ total: 0, documentsConfirmed: false })

describe('INCOME_TABLE_ROWS', () => {
  it('carries the workbook rows verbatim, EESA and NBER included', () => {
    const labels = INCOME_TABLE_ROWS.map((r) => r.label)
    expect(labels).toContain('ADD YEARLY INCOME SUPPORT OR EESA')
    expect(labels).toContain(
      "ADD ADJUSTED LAST 12 MONTHS' RECEIVED CASH SUPPORT/NBER OF KIDS"
    )
    expect(labels[0]).toBe('NO CHANGE (0)')
  })

  it('every bound row writes a real engine field', () => {
    for (const row of INCOME_TABLE_ROWS) {
      if (row.kind !== 'input' && row.kind !== 'inputWithDivisor') continue
      const rec = setEarnerField(empty(), row.blockKey!, row.fieldKey!, 1_000)
      // The engine must SEE the write: third-party divides by kids (default 1),
      // everything else adds directly — either way the total moves.
      expect(calculateEarnerIncome(rec)).toBeGreaterThan(0)
      expect(getEarnerField(rec, row.blockKey!, row.fieldKey!)).toBe(1_000)
    }
  })

  // CH-58 — PIP is no longer inert. It had no engine field, so anything the
  // assessor typed was discarded and the income went uncounted. Sole-trader
  // profits remain the only LA-8 row.
  it('exactly one row is LA-8 inert (sole-trader profits)', () => {
    const la8 = INCOME_TABLE_ROWS.filter((r) => r.kind === 'la8')
    expect(la8.map((r) => r.label)).toEqual([
      'ADD YEARLY COMPANY NET PROFITS AFTER TAX',
    ])
  })

  it('CH-58 — DLA and PIP are both real inputs, on their own fields', () => {
    const dla = INCOME_TABLE_ROWS.find((r) => r.label === 'ADD YEARLY DLA')
    const pip = INCOME_TABLE_ROWS.find((r) => r.label === 'ADD YEARLY PIP')
    expect(dla).toMatchObject({ kind: 'input', blockKey: 'benefits', fieldKey: 'pipOrDla' })
    expect(pip).toMatchObject({ kind: 'input', blockKey: 'benefits', fieldKey: 'pip' })
    // Distinct fields, so one cannot silently overwrite the other.
    expect(dla?.fieldKey).not.toBe(pip?.fieldKey)
  })

  it('CH-58 — neither row still tells the assessor to combine the two', () => {
    for (const label of ['ADD YEARLY DLA', 'ADD YEARLY PIP']) {
      const row = INCOME_TABLE_ROWS.find((r) => r.label === label)
      expect(row?.note ?? '').not.toMatch(/combined|combination|row above/i)
    }
  })
})

describe('setEarnerField — block presence semantics', () => {
  it('materialises the sub-block on first write and drops it when zeroed', () => {
    let rec = setEarnerField(empty(), 'employed', 'annualSalaryPaye', 42_000)
    expect(rec.employed).toBeDefined()
    expect(isIncomeRecordEmpty(rec)).toBe(false)

    rec = setEarnerField(rec, 'employed', 'annualSalaryPaye', 0)
    expect(rec.employed).toBeUndefined()
    expect(isIncomeRecordEmpty(rec)).toBe(true)
  })

  it('keeps a block alive while ANY of its fields is non-zero', () => {
    let rec = setEarnerField(empty(), 'selfEmployed', 'grossSalaried', 10_000)
    rec = setEarnerField(rec, 'selfEmployed', 'dividends', 5_000)
    rec = setEarnerField(rec, 'selfEmployed', 'grossSalaried', 0)
    expect(rec.selfEmployed).toBeDefined()
    expect(calculateEarnerIncome(rec)).toBe(5_000)
  })

  it('never mutates the input record', () => {
    const before = empty()
    setEarnerField(before, 'benefits', 'universalCredit', 6_000)
    expect(before.benefits).toBeUndefined()
    expect(before.total).toBe(0)
  })
})

describe('parity — the table produces the same totals the engine always computed', () => {
  it('a filled two-earner household sums identically to the engine', () => {
    // Parent 1: PAYE 30k + UC 6k; Parent 2: state pension 9k + maintenance 2.4k
    // + third-party 6k across 2 kids (= +3k).
    let p1 = empty()
    p1 = setEarnerField(p1, 'employed', 'annualSalaryPaye', 30_000)
    p1 = setEarnerField(p1, 'benefits', 'universalCredit', 6_000)

    let p2 = empty()
    p2 = setEarnerField(p2, 'retired', 'statePension', 9_000)
    p2 = setEarnerField(p2, 'divorcedSeparated', 'maintenanceReceived', 2_400)
    p2 = setEarnerField(p2, 'thirdParty', 'incomeSupportReceived', 6_000)
    p2 = setEarnerField(p2, 'thirdParty', 'numberOfKidsDivisor', 2)

    expect(calculateEarnerIncome(p1)).toBe(36_000)
    expect(calculateEarnerIncome(p2)).toBe(9_000 + 2_400 + 3_000)
    expect(calculateHouseholdNetIncome([p1, p2])).toBe(36_000 + 14_400)
    // With the Epic 13 C2 manual adjustment on top — unchanged semantics.
    expect(calculateHouseholdNetIncome([p1, p2], -400)).toBe(50_000)
  })
})
