/**
 * WP-08: Assessment Engine — Pure Business Logic
 * Type definitions for the JWF bursary assessment calculation engine.
 * No DB dependencies, no UI dependencies — pure TypeScript types.
 */

/**
 * D8 — VAT applicability on bursary fees.
 *
 * The engine currently APPLIES VAT to the post-bursary net fee at this default
 * rate; the schema mirrors it (`prisma/schema.prisma` `Assessment.vatRate`
 * `@default(20.00)`). Whether VAT genuinely applies to bursary fees is an open
 * client/finance question (D8) — until Charlotte/finance confirm, current
 * behaviour is preserved (20%). This constant is the SINGLE source of the
 * default so the answer can be changed in one place (set to `0` if D8 lands as
 * "legacy / not applied"). Per-assessment overrides still flow through the
 * `vatRate` input.
 */
export const DEFAULT_VAT_RATE = 20

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
  /**
   * Epic 07 — annual fee for the FOLLOWING academic year (the fee-uplift the
   * family will pay across the school year that spans the boundary). Optional
   * and additive: when omitted the engine emits no next-year payable figures and
   * every existing call site is unaffected. The current-year payable monthly is
   * unchanged. See D14 (which fee year drives the payable monthly) — the default
   * keeps current-year ÷ 12 and surfaces the next-year figures alongside, for
   * the assessor and for Epic 08, without altering the bursary maths.
   */
  nextYearAnnualFees?: number
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
  /**
   * Epic 07 — next-year payable figures. Present only when `nextYearAnnualFees`
   * was supplied; `null` otherwise. The bursary award and scholarship £ are held
   * flat at the current-year figures (D14 default: no re-derivation against the
   * next-year fee until Charlotte confirms the boundary rule); only the gross
   * fee changes, so these show the family's payment implication of the uplift.
   */
  nextYearGrossFees: number | null
  nextYearNetYearlyFees: number | null
  nextYearVatAmount: number | null
  nextYearYearlyPayableFees: number | null
  nextYearMonthlyPayableFees: number | null
}

export interface AssessmentOutput {
  stages: StageResults
  payableFees: PayableFeesResult
}
