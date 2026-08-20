/**
 * income-table.ts — Epic 14 C5 (CG-20, US-C6): the workbook Part 2 row model
 * for the assessor's income table.
 *
 * ONE Excel-style table, workbook rows verbatim (column D status blocks +
 * column E row labels, including "EESA" and "NBER OF KIDS" as written), with
 * Parent 1 · Parent 2 as two value columns. This module is the row → engine
 * binding (per the C0 field-map) plus the record-mutation helpers; rendering
 * lives in `income-table-v2.tsx`.
 *
 * PRESENTATION ONLY (D14-4): storage stays the per-earner
 * `AssessorIncomeRecord` and the maths stays `calculateEarnerIncome`. The
 * sub-block PRESENCE semantics the engine and the second-earner derivation
 * rely on are preserved: writing a non-zero value materialises the row's
 * sub-block; zeroing the last meaningful value in a block removes it again.
 *
 * LA-8 rows (no engine input — rendered inert, flagged for sign-off):
 *  - "ADD YEARLY COMPANY NET PROFITS AFTER TAX" (sole trader): the engine's
 *    four selfEmployed fields are the whole block; sole-trader profits have
 *    historically been entered under gross earned income.
 *  - "ADD YEARLY PIP": the engine holds ONE combined `pipOrDla` figure, bound
 *    to the DLA row; the PIP row displays the combination note.
 */

import type { AssessorIncomeRecord } from '@/types/assessment-v2'
import { calculateEarnerIncome } from './income'

export type IncomeBlockKey =
  | 'employed'
  | 'selfEmployed'
  | 'benefits'
  | 'unemployed'
  | 'retired'
  | 'divorcedSeparated'
  | 'thirdParty'

export interface IncomeTableRow {
  /** Workbook column D — shown on the group's first row only. Verbatim. */
  statusBlock: string | null
  /** Workbook column E — verbatim, misspellings included. */
  label: string
  kind:
    | 'input' // a bound currency cell per parent
    | 'inputWithDivisor' // currency cell + the /number-of-kids divisor cell
    | 'zero' // "NO CHANGE (0)" — informational, no cell
    | 'la8' // no engine input — inert, flagged
  blockKey?: IncomeBlockKey
  fieldKey?: string
  /** For `inputWithDivisor` — the divisor field within the same block. */
  divisorFieldKey?: string
  /** Inline note rendered under the label (LA-8 combination notes etc.). */
  note?: string
}

export const INCOME_TABLE_ROWS: readonly IncomeTableRow[] = [
  {
    statusBlock: 'IF UNEMPLOYED & NOT ON BENEFITS',
    label: 'NO CHANGE (0)',
    kind: 'zero',
  },
  {
    statusBlock: 'IF PAYE STATUS',
    label: 'ADD YEARLY NET PAY',
    kind: 'input',
    blockKey: 'employed',
    fieldKey: 'annualSalaryPaye',
  },
  {
    statusBlock: 'IF SELF-EMPLOYED & A DIRECTOR',
    label: 'ADD NET SALARY',
    kind: 'input',
    blockKey: 'selfEmployed',
    fieldKey: 'grossSalaried',
  },
  {
    statusBlock: null,
    label: 'ADD NET DIVIDENDS AFTER TAX',
    kind: 'input',
    blockKey: 'selfEmployed',
    fieldKey: 'dividends',
  },
  {
    statusBlock: null,
    label: 'ADD PROPERTY INCOME AFTER TAX',
    kind: 'input',
    blockKey: 'selfEmployed',
    fieldKey: 'propertyIncome',
  },
  {
    statusBlock: null,
    label: 'ADD INVESTMENT / OTHER INCOME AFTER TAX',
    kind: 'input',
    blockKey: 'selfEmployed',
    fieldKey: 'otherInvestmentIncome',
  },
  {
    statusBlock: 'IF SELF-EMPLOYED & A PARTNER OR SOLE TRADER',
    label: 'ADD YEARLY COMPANY NET PROFITS AFTER TAX',
    kind: 'la8',
    note:
      'Enter sole-trader profits under ADD NET SALARY above.',
  },
  {
    statusBlock: 'IF ON BENEFITS',
    label: 'ADD YEARLY UNIVERSAL CREDIT',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'universalCredit',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY HOUSING BENEFITS',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'housingBenefit',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY CHILD BENEFITS',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'childBenefit',
  },
  {
    statusBlock: null,
    label: 'ADD TAX CREDITS (WORKING & CHILD)',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'childWorkingTaxCredit',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY INCOME SUPPORT OR EESA',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'esa',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY DLA',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'pipOrDla',
    note: 'Enter the combined DLA and PIP total here.',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY PIP',
    kind: 'la8',
    note: 'Included in the DLA row above — enter the combined total there.',
  },
  {
    statusBlock: null,
    label: "ADD YEARLY CARER'S ALLOWANCE",
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'carersAllowance',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY CHILDCARE SUPPORT',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'childcareSupport',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY OTHER BENEFITS',
    kind: 'input',
    blockKey: 'benefits',
    fieldKey: 'other',
  },
  {
    statusBlock: 'IF UNEMPLOYED/ IN BETWEEN ROLES',
    label: 'ADD NET FINAL SALARY STATED ON P45',
    kind: 'input',
    blockKey: 'unemployed',
    fieldKey: 'finalGrossPay',
  },
  {
    statusBlock: null,
    label: 'ADD REDUNDANCY/ SEVERANCE PAY',
    kind: 'input',
    blockKey: 'unemployed',
    fieldKey: 'redundancy',
  },
  {
    statusBlock: null,
    label: 'ADD JSA SUPPORT',
    kind: 'input',
    blockKey: 'unemployed',
    fieldKey: 'jsa',
  },
  {
    statusBlock: null,
    label: 'ADD STUDENT SUPPORT',
    kind: 'input',
    blockKey: 'unemployed',
    fieldKey: 'grantSupport',
  },
  {
    statusBlock: null,
    label: 'ADD PARENTAL/ADOPTION/SICKNESS NET PAY',
    kind: 'input',
    blockKey: 'unemployed',
    fieldKey: 'leavePay',
  },
  {
    statusBlock: 'IF RETIRED',
    label: 'ADD YEARLY STATE PENSION',
    kind: 'input',
    blockKey: 'retired',
    fieldKey: 'statePension',
  },
  {
    statusBlock: null,
    label: 'ADD YEARLY PRIVATE PENSION/ OTHER PLAN',
    kind: 'input',
    blockKey: 'retired',
    fieldKey: 'privatePension',
  },
  {
    statusBlock: 'IF SEPARATED/DIVORCED',
    label: 'ADD YEARLY CHILD MAINTENANCE',
    kind: 'input',
    blockKey: 'divorcedSeparated',
    fieldKey: 'maintenanceReceived',
  },
  {
    statusBlock: null,
    label: 'ADD EARNED INCOME PORTION FROM NEW SPOUSE IF REMARRIED',
    kind: 'input',
    blockKey: 'divorcedSeparated',
    fieldKey: 'newSpouseIncomePortion',
  },
  {
    statusBlock: 'IF RECEIVING SUPPORT FROM FRIENDS/FAMILY/OTHER 3RD PARTY',
    label: "ADD ADJUSTED LAST 12 MONTHS' RECEIVED CASH SUPPORT/NBER OF KIDS",
    kind: 'inputWithDivisor',
    blockKey: 'thirdParty',
    fieldKey: 'incomeSupportReceived',
    divisorFieldKey: 'numberOfKidsDivisor',
  },
]

// ─── Record helpers ──────────────────────────────────────────────────────────

/** Empty sub-block factory — supplies required non-numeric fields. */
function emptyBlock(key: IncomeBlockKey): Record<string, unknown> {
  switch (key) {
    case 'divorcedSeparated':
      return { maintenanceReceived: 0, sharedCustodyNote: '' }
    case 'thirdParty':
      return { incomeSupportReceived: 0, supportNote: '' }
    default:
      return {}
  }
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Read a cell's current value (0 when the block is absent). */
export function getEarnerField(
  record: AssessorIncomeRecord,
  blockKey: IncomeBlockKey,
  fieldKey: string,
): number {
  const block = (record as unknown as Record<string, unknown>)[blockKey] as
    | Record<string, unknown>
    | undefined
  return n(block?.[fieldKey])
}

/** True when a sub-block carries no meaningful data (all numerics 0, notes blank). */
function isBlockEmpty(block: Record<string, unknown>): boolean {
  return Object.values(block).every((v) => {
    if (typeof v === 'number') return !Number.isFinite(v) || v === 0
    if (typeof v === 'string') return v.trim() === ''
    return v == null || v === false
  })
}

/**
 * Write one cell, preserving the engine's block-presence semantics: a write
 * materialises the sub-block; zeroing the last meaningful value removes it
 * again (so `isIncomeRecordEmpty` and the status-driven presence checks keep
 * meaning what they always meant). `total` is recomputed via the engine.
 */
export function setEarnerField(
  record: AssessorIncomeRecord,
  blockKey: IncomeBlockKey,
  fieldKey: string,
  value: number,
): AssessorIncomeRecord {
  const rec = record as unknown as Record<string, unknown>
  const existing = (rec[blockKey] as Record<string, unknown> | undefined) ?? emptyBlock(blockKey)
  const block: Record<string, unknown> = { ...existing, [fieldKey]: value }

  const next: AssessorIncomeRecord = { ...record } as AssessorIncomeRecord
  const nextRec = next as unknown as Record<string, unknown>
  if (isBlockEmpty(block)) {
    delete nextRec[blockKey]
  } else {
    nextRec[blockKey] = block
  }
  next.total = calculateEarnerIncome(next)
  return next
}
