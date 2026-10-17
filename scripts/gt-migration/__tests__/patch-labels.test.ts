/**
 * `mig patch-labels` pure seams (Charlotte, 17 Oct 2026).
 */
import { describe, expect, it } from 'vitest'
import { figureMismatches, labelChanges, liveLabelSets, type CalcOut, type LabelLine, type StoredRow } from '../load/patch-labels'

const stored: StoredRow = {
  accountKey: 'k', assessmentId: 'a', debtStatusLabel: 'IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY', lifestyleSqueezeLabel: 'n/a',
  ndi: -12000, netIncome: 30000.004, repayments: 0, ratio: 0,
}
const calc: CalcOut = {
  debtStatusLabel: 'DEBT POSITION TO BE SCRUTINISED OR MATERIAL EXTERNAL INCOME SOURCE SUSPECTED',
  lifestyleSqueezeLabel: 'LIFESTYLE ONLY MAINTAINED BY STARTING TO BORROW OR FREE EXTERNAL FINANCIAL SUPPORT',
  ndiAfterNotionalSpend: -12000, householdNetIncome: 30000, derivedYearlyDebtRepayments: 0, debtOverNdiRatio: 0,
}

describe('patch-labels', () => {
  it('both labels change when only the reference tables changed', () => {
    expect(figureMismatches(stored, calc)).toEqual([])
    expect(labelChanges(stored, calc).map((c) => c.key)).toEqual(['debtStatusLabel', 'lifestyleSqueezeLabel'])
  })
  it('refuses (reports) a figure that moved — that is not a label-only change', () => {
    expect(figureMismatches({ ...stored, ndi: -11000 }, calc)).toEqual(['ndiAfterNotionalSpend'])
  })
  it('an unchanged row plans nothing', () => {
    expect(labelChanges({ ...stored, debtStatusLabel: calc.debtStatusLabel, lifestyleSqueezeLabel: calc.lifestyleSqueezeLabel }, calc)).toEqual([])
  })
  it('undo replays only the sets no later undo reversed', () => {
    const l = (op: 'set' | 'undo', id: string): LabelLine => ({ op, runId: 'r', accountKey: 'k', assessmentId: id, column: 'debt_status_label', from: 'a', to: 'b', at: '' })
    expect(liveLabelSets([l('set', '1'), l('set', '2'), l('undo', '1')]).map((x) => x.assessmentId)).toEqual(['2'])
  })
})
