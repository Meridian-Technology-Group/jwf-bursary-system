import { describe, it, expect } from 'vitest'
import {
  parentIncomeToAssessorRecord,
  assetsToPropertyAssets,
  assetsToDebts,
  derivePortfolioType,
  assetsToSavings,
  assetsToTransport,
} from '../prefill'
import type { AssetsLiabilitiesData, ParentIncomeRecord } from '@/types/application'

// ─── parentIncomeToAssessorRecord ──────────────────────────────────────────

describe('parentIncomeToAssessorRecord', () => {
  it('passes a new-shape record through and recomputes the total', () => {
    const rec: ParentIncomeRecord = {
      employed: { annualSalaryPaye: 42_000 },
      selfEmployed: { grossSalaried: 0, propertyIncome: 3_000, dividends: 1_000, otherInvestmentIncome: 0 },
      total: 999, // stale — must be recomputed
      documentsConfirmed: true,
    }
    const out = parentIncomeToAssessorRecord(rec)
    expect(out.employed?.annualSalaryPaye).toBe(42_000)
    expect(out.selfEmployed?.propertyIncome).toBe(3_000)
    expect(out.total).toBe(46_000)
    // documentsConfirmed resets — the assessor re-confirms their own record.
    expect(out.documentsConfirmed).toBe(false)
  })

  it('does not mutate the source record', () => {
    const rec: ParentIncomeRecord = {
      employed: { annualSalaryPaye: 10_000 },
      total: 0,
      documentsConfirmed: true,
    }
    const out = parentIncomeToAssessorRecord(rec)
    out.employed!.annualSalaryPaye = 99_999
    expect(rec.employed!.annualSalaryPaye).toBe(10_000)
  })

  it('normalises a legacy flat record into the new shape', () => {
    const legacy = { salaryWagesPension: 30_000, allDividendIncome: 2_000 }
    const out = parentIncomeToAssessorRecord(legacy)
    // salary maps to employed; dividends map to self-employed (income-model rule)
    expect(out.employed?.annualSalaryPaye).toBe(30_000)
    expect(out.selfEmployed?.dividends).toBe(2_000)
    expect(out.total).toBe(32_000)
  })

  it('returns an empty record for null / non-object input', () => {
    expect(parentIncomeToAssessorRecord(null)).toEqual({ total: 0, documentsConfirmed: false })
    expect(parentIncomeToAssessorRecord(undefined)).toEqual({ total: 0, documentsConfirmed: false })
  })
})

// ─── assets fixtures ────────────────────────────────────────────────────────

function assets(partial: Partial<AssetsLiabilitiesData>): AssetsLiabilitiesData {
  return {
    propertyOwnership: 'OWN',
    residenceValue: 0,
    hasOtherProperties: false,
    otherProperties: [],
    hasChargingOrder: false,
    carOwnership: 'OWN',
    usesPublicTransport: false,
    otherPossessionsValue: 0,
    totalCashBalance: 0,
    investmentsValue: 0,
    parent1CurrentAccountDocumentIds: [],
    parent1SavingsAccountDocumentIds: [],
    parent1InvestmentDocumentIds: [],
    hasPersonalDebt: false,
    creditCardStatementDocumentIds: [],
    loanStatementDocumentIds: [],
    otherDebtDocumentIds: [],
    documentsConfirmed: true,
    ...partial,
  }
}

// ─── assetsToPropertyAssets ─────────────────────────────────────────────────

describe('assetsToPropertyAssets', () => {
  it('maps the family home from the OWN branch', () => {
    const out = assetsToPropertyAssets(assets({ residenceValue: 500_000, mortgageBalance: 120_000 }))
    expect(out.home).toEqual({ value: 500_000, mortgageBalance: 120_000 })
    expect(out.second).toBeUndefined()
    expect(out.other).toBeUndefined()
  })

  it('omits the home when the family rents', () => {
    const out = assetsToPropertyAssets(assets({ propertyOwnership: 'RENT', residenceValue: 0 }))
    expect(out.home).toBeUndefined()
  })

  it('maps the first other property to `second` and aggregates the rest into `other` (C101/C102)', () => {
    const out = assetsToPropertyAssets(
      assets({
        residenceValue: 400_000,
        hasOtherProperties: true,
        otherProperties: [
          { id: '1', address: 'a', postcode: 'p', value: 200_000, mortgageBalance: 50_000 },
          { id: '2', address: 'b', postcode: 'q', value: 150_000, mortgageBalance: 30_000 },
          { id: '3', address: 'c', postcode: 'r', value: 100_000, mortgageBalance: 0 },
        ],
      })
    )
    expect(out.second).toEqual({ value: 200_000, mortgageBalance: 50_000 })
    // aggregate of properties 2 + 3
    expect(out.other).toEqual({ value: 250_000, mortgageBalance: 30_000 })
  })

  it('returns an empty record for null assets', () => {
    expect(assetsToPropertyAssets(null)).toEqual({})
  })
})

// ─── assetsToDebts ──────────────────────────────────────────────────────────

describe('assetsToDebts', () => {
  it('maps credit cards + overdraft, loans, school fees; leaseBalances is 0', () => {
    const out = assetsToDebts(
      assets({
        creditCardBalance: 4_000,
        bankOverdraft: 1_000,
        loansToAgencies: 6_000,
        loansToFriendsFamily: 2_000,
        schoolFeesOwed: 3_000,
      })
    )
    expect(out.creditCards).toBe(5_000)
    expect(out.loans).toBe(8_000)
    expect(out.leaseBalances).toBe(0)
    expect(out.schoolFeesOwedOrOther).toBe(3_000)
  })
})

// ─── derivePortfolioType ────────────────────────────────────────────────────

describe('derivePortfolioType', () => {
  it('RENTING when the family rents', () => {
    expect(derivePortfolioType(assets({ propertyOwnership: 'RENT' }))).toBe('RENTING')
  })
  it('SINGLE for home only', () => {
    expect(derivePortfolioType(assets({ otherProperties: [] }))).toBe('SINGLE')
  })
  it('DOUBLE for home + one other', () => {
    expect(
      derivePortfolioType(
        assets({ otherProperties: [{ id: '1', address: 'a', postcode: 'p', value: 1 }] })
      )
    ).toBe('DOUBLE')
  })
  it('MULTIPLE for home + two or more others', () => {
    expect(
      derivePortfolioType(
        assets({
          otherProperties: [
            { id: '1', address: 'a', postcode: 'p', value: 1 },
            { id: '2', address: 'b', postcode: 'q', value: 1 },
          ],
        })
      )
    ).toBe('MULTIPLE')
  })
  it('RENTING for null assets', () => {
    expect(derivePortfolioType(null)).toBe('RENTING')
  })
})

// ─── savings + transport ────────────────────────────────────────────────────

describe('assetsToSavings', () => {
  it('maps cash + investments', () => {
    expect(assetsToSavings(assets({ totalCashBalance: 20_000, investmentsValue: 8_000 }))).toEqual({
      cashSavings: 20_000,
      isasPepsShares: 8_000,
    })
  })
})

describe('assetsToTransport', () => {
  it('usesCar true for OWN/LEASE; usesPublicTransport from the answer', () => {
    expect(assetsToTransport(assets({ carOwnership: 'OWN', usesPublicTransport: true }))).toEqual({
      usesCar: true,
      usesPublicTransport: true,
    })
    expect(assetsToTransport(assets({ carOwnership: 'LEASE', usesPublicTransport: false }))).toEqual({
      usesCar: true,
      usesPublicTransport: false,
    })
  })
  it('both false for null assets', () => {
    expect(assetsToTransport(null)).toEqual({ usesCar: false, usesPublicTransport: false })
  })
})
