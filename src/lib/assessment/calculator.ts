/**
 * WP-08: Assessment Engine — Main Orchestrator
 *
 * Composes all assessment stages into a single calculation pipeline.
 * Pure function — no side effects, no DB or UI dependencies.
 * Safe to import on both client and server.
 */

import { calculateHouseholdIncome } from './stage1-income'
import { calculateNetAssets, calculateDerivedSavings } from './stage2-assets'
import { calculateLivingCosts } from './stage3-living'
import { calculateBursaryImpact } from './stage4-bursary'
import { calculatePayableFees } from './payable-fees'
import { applySiblingDeductions } from './sibling'
import type { AssessmentInput, AssessmentOutput } from './types'

export { calculateDerivedSavings }

/**
 * Runs the full JWF bursary assessment calculation pipeline.
 *
 * Pipeline:
 *  Stage 1 → Household income across all earners
 *  Stage 2 → Net assets after housing, council tax, savings
 *  Stage 3 → HNDI after necessary living spend
 *  Sibling → Deduct older siblings' fees from HNDI (if applicable)
 *  Stage 4 → Required bursary (clamped to [0, annualFees])
 *  Fees    → Payable fees after scholarship, VAT, manual adjustment
 *
 * @param input Full assessment input — all values must be provided
 * @returns Complete assessment output with stage results and payable fee breakdown
 */
export function calculateAssessment(input: AssessmentInput): AssessmentOutput {
  // Stage 1: Total household net income
  const stage1_totalHouseholdNetIncome = calculateHouseholdIncome(input.earners)

  // Stage 2: Net assets yearly valuation
  const stage2_netAssetsYearlyValuation = calculateNetAssets(
    stage1_totalHouseholdNetIncome,
    input.notionalRent,
    input.isMortgageFree,
    input.additionalPropertyIncome,
    input.councilTax,
    {
      cashSavings: input.cashSavings,
      isasPepsShares: input.isasPepsShares,
      schoolAgeChildrenCount: input.schoolAgeChildrenCount,
      schoolingYearsRemaining: input.schoolingYearsRemaining,
    },
  )

  // Stage 3: HNDI after necessary spend
  const stage3_hndiAfterNS = calculateLivingCosts(
    stage2_netAssetsYearlyValuation,
    input.utilityCosts,
    input.foodCosts,
  )

  // Sibling deductions (if any)
  const adjustedHndi = applySiblingDeductions(stage3_hndiAfterNS, input.siblingPayableFees)

  // Stage 4: Required bursary
  const stage4_requiredBursary = calculateBursaryImpact(adjustedHndi, input.annualFees)

  // Payable fees breakdown
  const payableFees = calculatePayableFees(
    input.annualFees,
    input.scholarshipPct,
    stage4_requiredBursary,
    input.vatRate,
    input.manualAdjustment,
  )

  return {
    stages: {
      stage1_totalHouseholdNetIncome,
      stage2_netAssetsYearlyValuation,
      stage3_hndiAfterNS,
      stage4_requiredBursary,
    },
    payableFees,
  }
}
