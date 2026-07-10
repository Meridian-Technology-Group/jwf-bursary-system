/**
 * CALC-02 — TypeScript shapes for the v2 assessor-capture JSONB columns
 * (`AssessmentEarner.incomeDetail`, `AssessmentProperty.propertyAssets`,
 * `AssessmentProperty.debts`). Pure types — no DB, no React.
 *
 * `AssessorIncomeRecord` structurally reuses `ParentIncomeRecord` (the
 * parent-portal shape) rather than duplicating it, per architecture decision
 * #2 in implementation-plan.md: the assessor reviews/adjusts the same
 * status-driven sub-tables the parent submitted, plus two assessor-only
 * extras (`divorcedSeparated.newSpouseIncomePortion`,
 * `thirdParty.numberOfKidsDivisor`).
 */

import type {
  ParentIncomeRecord,
  DivorcedSeparatedIncome,
  ThirdPartyIncome,
} from "@/types/application";

/** Divorced/separated income, plus the assessor-judged new-spouse income portion. */
export interface AssessorDivorcedSeparatedIncome extends DivorcedSeparatedIncome {
  /**
   * Portion of a new spouse/partner's income the assessor counts toward
   * household income (CALC-03 `income.ts`). Assessor-only — not on the
   * parent-facing form.
   */
  newSpouseIncomePortion?: number;
}

/** Third-party support, plus the assessor's divisor for the per-kid split. */
export interface AssessorThirdPartyIncome extends ThirdPartyIncome {
  /**
   * Divisor applied to last-12-months third-party support (CALC-03
   * `income.ts`: support ÷ number of kids). Assessor-only.
   */
  numberOfKidsDivisor?: number;
}

/**
 * Status-driven income record captured/reviewed by the assessor
 * (`assessment_earners.income_detail`). Structurally identical to
 * `ParentIncomeRecord` except the two sub-blocks above carry assessor-only
 * extras. Auto-populated from the application's submitted `ParentIncomeRecord`
 * (CALC-07 `auto-populate.ts`), then confirmed/adjusted by the assessor.
 */
export interface AssessorIncomeRecord
  extends Omit<ParentIncomeRecord, "divorcedSeparated" | "thirdParty"> {
  divorcedSeparated?: AssessorDivorcedSeparatedIncome;
  thirdParty?: AssessorThirdPartyIncome;
}

/** One property's value + outstanding mortgage balance. */
export interface PropertyAssetItem {
  value?: number;
  mortgageBalance?: number;
}

/**
 * Itemised property assets (`assessment_properties.property_assets`). `other`
 * is an aggregate across every additional property beyond `home`/`second`
 * (workbook C101/C102) — the assessor does not itemise a third-and-beyond
 * property individually.
 */
export interface PropertyAssetsRecord {
  home?: PropertyAssetItem;
  second?: PropertyAssetItem;
  other?: PropertyAssetItem;
}

/**
 * Itemised personal debts (`assessment_properties.debts`), feeding the debt
 * module (CALC-04).
 */
export interface DebtsRecord {
  creditCards?: number;
  loans?: number;
  leaseBalances?: number;
  schoolFeesOwedOrOther?: number;
}
