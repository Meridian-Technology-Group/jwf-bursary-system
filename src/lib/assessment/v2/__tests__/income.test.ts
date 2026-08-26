import { describe, it, expect } from 'vitest'
import {
  calculateEarnerAggregateIncome,
  calculateEarnerIncome,
  calculateHouseholdNetIncome,
} from '../income'
import type { AssessorIncomeRecord } from '@/types/assessment-v2'

describe('calculateEarnerIncome', () => {
  it('sums the employed sub-block', () => {
    const rec: AssessorIncomeRecord = {
      employed: { annualSalaryPaye: 42_000 },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(42_000)
  })

  it('sums the self-employed sub-block (director income streams)', () => {
    const rec: AssessorIncomeRecord = {
      selfEmployed: {
        grossSalaried: 20_000,
        propertyIncome: 8_000,
        dividends: 5_000,
        otherInvestmentIncome: 1_500,
      },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(34_500)
  })

  it('sums every itemised line of the benefits sub-block', () => {
    const rec: AssessorIncomeRecord = {
      benefits: {
        universalCredit: 1_000,
        housingBenefit: 2_000,
        childBenefit: 500,
        childWorkingTaxCredit: 750,
        esa: 300,
        pipOrDla: 400,
        carersAllowance: 200,
        childcareSupport: 600,
        other: 100,
      },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(1_000 + 2_000 + 500 + 750 + 300 + 400 + 200 + 600 + 100)
  })

  it('sums the unemployed / in-between-roles sub-block', () => {
    const rec: AssessorIncomeRecord = {
      unemployed: {
        finalGrossPay: 5_000,
        redundancy: 3_000,
        jsa: 800,
        grantSupport: 400,
        leavePay: 1_200,
      },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(5_000 + 3_000 + 800 + 400 + 1_200)
  })

  it('sums the retired sub-block', () => {
    const rec: AssessorIncomeRecord = {
      retired: { statePension: 9_000, privatePension: 6_000 },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(15_000)
  })

  it('sums maintenance plus the assessor-only new-spouse income portion', () => {
    const rec: AssessorIncomeRecord = {
      divorcedSeparated: {
        maintenanceReceived: 6_000,
        sharedCustodyNote: '',
        newSpouseIncomePortion: 10_000,
      },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(16_000)
  })

  it('omits the new-spouse portion when not present (maintenance only)', () => {
    const rec: AssessorIncomeRecord = {
      divorcedSeparated: { maintenanceReceived: 6_000, sharedCustodyNote: '' },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(6_000)
  })

  it('divides third-party support by the assessor-entered number-of-kids divisor', () => {
    const rec: AssessorIncomeRecord = {
      thirdParty: {
        incomeSupportReceived: 12_000,
        supportNote: '',
        numberOfKidsDivisor: 3,
      },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(4_000)
  })

  it('defaults the third-party divisor to 1 when not supplied', () => {
    const rec: AssessorIncomeRecord = {
      thirdParty: { incomeSupportReceived: 12_000, supportNote: '' },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(12_000)
  })

  it('never divides by zero or a negative divisor (floors to 1)', () => {
    const zero: AssessorIncomeRecord = {
      thirdParty: { incomeSupportReceived: 9_000, supportNote: '', numberOfKidsDivisor: 0 },
      total: 0,
      documentsConfirmed: true,
    }
    const negative: AssessorIncomeRecord = {
      thirdParty: { incomeSupportReceived: 9_000, supportNote: '', numberOfKidsDivisor: -2 },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(zero)).toBe(9_000)
    expect(calculateEarnerIncome(negative)).toBe(9_000)
  })

  it('sums across multiple sub-blocks present at once', () => {
    const rec: AssessorIncomeRecord = {
      employed: { annualSalaryPaye: 30_000 },
      retired: { statePension: 5_000, privatePension: 0 },
      total: 0,
      documentsConfirmed: true,
    }
    expect(calculateEarnerIncome(rec)).toBe(35_000)
  })

  it('returns 0 for an empty record', () => {
    const rec: AssessorIncomeRecord = { total: 0, documentsConfirmed: false }
    expect(calculateEarnerIncome(rec)).toBe(0)
  })
})

describe('calculateHouseholdNetIncome', () => {
  it('sums both earners', () => {
    const earners: AssessorIncomeRecord[] = [
      { employed: { annualSalaryPaye: 40_000 }, total: 0, documentsConfirmed: true },
      { employed: { annualSalaryPaye: 25_000 }, total: 0, documentsConfirmed: true },
    ]
    expect(calculateHouseholdNetIncome(earners)).toBe(65_000)
  })

  it('floors the household total at 0 (workbook C40)', () => {
    // Household income can never itself be negative under the current sub-block
    // shapes, but the floor is asserted per the CALC-03 spec (mirrors v1's
    // calculateHouseholdIncome floor).
    expect(calculateHouseholdNetIncome([])).toBe(0)
  })

  it('handles a single earner', () => {
    const earners: AssessorIncomeRecord[] = [
      { retired: { statePension: 9_500, privatePension: 2_500 }, total: 0, documentsConfirmed: true },
    ]
    expect(calculateHouseholdNetIncome(earners)).toBe(12_000)
  })
})

// ─── Epic 13 / C2 — manual income adjustment (D13-3) ─────────────────────────

describe('calculateHouseholdNetIncome — manual income adjustment', () => {
  const earners: AssessorIncomeRecord[] = [
    { employed: { annualSalaryPaye: 40_000 }, total: 0, documentsConfirmed: true },
    { employed: { annualSalaryPaye: 25_000 }, total: 0, documentsConfirmed: true },
  ]

  it('defaults to no adjustment when the argument is omitted', () => {
    expect(calculateHouseholdNetIncome(earners)).toBe(65_000)
  })

  it('adds a POSITIVE adjustment on top of the earner aggregate (the parent-2 add-on case)', () => {
    expect(calculateHouseholdNetIncome(earners, 12_500)).toBe(77_500)
  })

  it('DEDUCTS a negative adjustment', () => {
    expect(calculateHouseholdNetIncome(earners, -7_250)).toBe(57_750)
  })

  it('is applied AFTER earner aggregation, not per-earner', () => {
    // Same adjustment, different earner split — the result depends only on
    // the aggregate, proving the adjustment is a single household-level line.
    const split: AssessorIncomeRecord[] = [
      { employed: { annualSalaryPaye: 65_000 }, total: 0, documentsConfirmed: true },
    ]
    expect(calculateHouseholdNetIncome(split, 5_000)).toBe(
      calculateHouseholdNetIncome(earners, 5_000),
    )
  })

  it('still floors the ADJUSTED total at 0 (workbook C40)', () => {
    expect(calculateHouseholdNetIncome(earners, -100_000)).toBe(0)
  })

  it('treats a non-finite / missing adjustment as 0', () => {
    expect(calculateHouseholdNetIncome(earners, Number.NaN)).toBe(65_000)
    expect(calculateHouseholdNetIncome(earners, undefined)).toBe(65_000)
  })

  it('calculateEarnerAggregateIncome reports the pre-adjustment subtotal', () => {
    expect(calculateEarnerAggregateIncome(earners)).toBe(65_000)
    // …and is unaffected by whatever the adjustment turns out to be.
    expect(calculateHouseholdNetIncome(earners, 12_500) - calculateEarnerAggregateIncome(earners)).toBe(
      12_500,
    )
  })
})

// ─── CH-58 — PIP counts as its own benefit ─────────────────────────────────

describe('CH-58 — DLA and PIP are summed separately', () => {
  const withBenefits = (pipOrDla: number, pip?: number): AssessorIncomeRecord => ({
    total: 0,
    documentsConfirmed: false,
    benefits: {
      universalCredit: 0,
      housingBenefit: 0,
      childBenefit: 0,
      childWorkingTaxCredit: 0,
      esa: 0,
      pipOrDla,
      ...(pip === undefined ? {} : { pip }),
      carersAllowance: 0,
      childcareSupport: 0,
      other: 0,
    },
  })

  it('counts PIP on top of DLA rather than ignoring it', () => {
    // Charlotte's figures for WS-202627-0010: DLA 7,259 and PIP 2,412.
    const both = calculateEarnerIncome(withBenefits(7_259, 2_412))
    const dlaOnly = calculateEarnerIncome(withBenefits(7_259))
    expect(both - dlaOnly).toBe(2_412)
    expect(both).toBe(9_671)
  })

  it('treats a missing pip key as 0, so older applications are unchanged', () => {
    // Every application submitted before CH-58 has no `pip` key at all.
    expect(calculateEarnerIncome(withBenefits(7_259))).toBe(
      calculateEarnerIncome(withBenefits(7_259, 0))
    )
  })

  it('counts PIP alone when there is no DLA', () => {
    expect(calculateEarnerIncome(withBenefits(0, 2_412))).toBe(2_412)
  })
})
