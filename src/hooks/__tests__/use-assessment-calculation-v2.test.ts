import { describe, it, expect } from 'vitest'
import { runAssessmentV2 } from '@/hooks/use-assessment-calculation-v2'
import { calculateAssessmentV2, type AssessmentV2Input } from '@/lib/assessment/v2/orchestrator'
import type { ReferenceBundle } from '@/lib/assessment/v2/types'
import type { AssessorIncomeRecord } from '@/types/assessment-v2'
import {
  notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
} from '../../../prisma/seed-data/profiling-reference'

const ref: ReferenceBundle = {
  notionalCosts: notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
}

function earner(annualSalaryPaye: number): AssessorIncomeRecord {
  return { employed: { annualSalaryPaye }, total: 0, documentsConfirmed: true }
}

const input: AssessmentV2Input = {
  earners: [earner(45_000)],
  familyTypeCategory: 2,
  rentAddBackType: 'NONE',
  multiPropertyRentAddBack: false,
  councilTaxSupport: false,
  usesCar: true,
  usesPublicTransport: false,
  feeInsuranceAnnual: 0,
  cashSavings: 5_000,
  isasPepsShares: 0,
  schoolingYearsRemaining: 7,
  propertyAssets: { home: { value: 400_000, mortgageBalance: 100_000 } },
  portfolioType: 'SINGLE',
  debts: {},
  siblingPayableFees: [],
  annualFees: 30_000,
  scholarshipPct: 0,
}

describe('runAssessmentV2 (hook wiring)', () => {
  it('delegates to calculateAssessmentV2 and returns the identical result', () => {
    const viaHook = runAssessmentV2(input, ref)
    const direct = calculateAssessmentV2(input, ref)
    expect(viaHook).toEqual(direct)
  })

  it('produces the recommended payable fees leg (actual leg, min-of-three retired 5 Sep 2026)', () => {
    const out = runAssessmentV2(input, ref)
    expect(out).not.toBeNull()
    expect(out!.recommendedPayableFees).toBe(Math.max(0, out!.actualRemainingDi))
  })
})
