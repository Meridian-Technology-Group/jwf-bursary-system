/**
 * WP-08: Assessment Engine — Pure Business Logic
 * Type definitions for the JWF bursary assessment calculation engine.
 * No DB dependencies, no UI dependencies — pure TypeScript types.
 */

export type EmploymentStatus =
  | 'PAYE'
  | 'BENEFITS'
  | 'SELF_EMPLOYED_DIRECTOR'
  | 'SELF_EMPLOYED_SOLE'
  | 'OLD_AGE_PENSION'
  | 'PAST_PENSION'
  | 'UNEMPLOYED'

export interface EarnerInput {
  earnerLabel: 'PARENT_1' | 'PARENT_2'
  employmentStatus: EmploymentStatus
  /** PAYE net salary */
  netPay: number
  /** Self-employed director dividends */
  netDividends: number
  /** Sole trader / partner net profit */
  netSelfEmployedProfit: number
  /** Old age or past employment pension */
  pensionAmount: number
  /** DLA, ESA, PIP, Carer's (parent) — INCLUDED in calculation */
  benefitsIncluded: number
  /** Child disability benefits — NOT included in income, recorded only */
  benefitsExcluded: number
}

export interface PropertyInput {
  isMortgageFree: boolean
  additionalPropertyIncome: number
}

export interface SavingsInput {
  cashSavings: number
  isasPepsShares: number
  /** Number of school-age children — used as divisor */
  schoolAgeChildrenCount: number
  /** Years of schooling remaining — used as divisor */
  schoolingYearsRemaining: number
}

export interface AssessmentInput {
  earners: EarnerInput[]
  /** Family type category 1–6 (used for reference; actual cost values passed separately) */
  familyTypeCategory: number
  notionalRent: number
  utilityCosts: number
  foodCosts: number
  annualFees: number
  /** Default: Band D Croydon = 2480 */
  councilTax: number
  schoolingYearsRemaining: number
  isMortgageFree: boolean
  additionalPropertyIncome: number
  cashSavings: number
  isasPepsShares: number
  schoolAgeChildrenCount: number
  /** Scholarship percentage 0–100 */
  scholarshipPct: number
  /** Default: 20 */
  vatRate: number
  /** Default: 0 */
  manualAdjustment: number
  /** Payable fees of older siblings, for sequential income absorption */
  siblingPayableFees: number[]
}

export interface StageResults {
  stage1_totalHouseholdNetIncome: number
  stage2_netAssetsYearlyValuation: number
  stage3_hndiAfterNS: number
  stage4_requiredBursary: number
}

export interface PayableFeesResult {
  grossFees: number
  scholarshipDeduction: number
  bursaryAward: number
  netYearlyFees: number
  vatAmount: number
  yearlyPayableFees: number
  monthlyPayableFees: number
  /** After manual adjustment */
  adjustedYearlyPayableFees: number
  adjustedMonthlyPayableFees: number
}

export interface AssessmentOutput {
  stages: StageResults
  payableFees: PayableFeesResult
}
