/**
 * CALC-07 → Epic 14 C4 (CG-15, D14-3): assessor-capture pre-fill.
 *
 * The original CALC-07 "auto-populate-then-confirm" mappers seeded the
 * assessor's records from the family's SUBMITTED income/assets sections.
 * Charlotte rejected that in UAT round 2 ("misleading" — CG-15): the
 * assessment must open EMPTY except the sanctioned autofill, and the
 * assessor enters every figure themselves, cross-referencing the declared
 * values on the APPLICATION FORM tab (PRD AE-01's original two-layer
 * intent, D14-3).
 *
 * What still autofills (the sanctioned set):
 *   - recipient first name / surname, year of entry (LA-5, editable),
 *     remaining-years derivation, annual fees — all handled by the form/page
 *     from `Application` + reference data, not from applicant sections;
 *   - reference-bundle notionals, which fill on family-category selection
 *     (AE-09 — reference autofill, not applicant data).
 *
 * The applicant-section mappers (parentIncomeToAssessorRecord,
 * assetsToPropertyAssets, assetsToDebts, derivePortfolioType, assetsToSavings,
 * assetsToTransport) were removed with the behaviour — git history (CALC-07)
 * has them if Charlotte ever reverses D14-3.
 *
 * Pure module — no DB, no React.
 */

import type { AssessorIncomeRecord } from '@/types/assessment-v2'
import type { PropertyAssetsRecord, DebtsRecord } from '@/types/assessment-v2'
import type { PropertyPortfolioType } from './profiling'

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v)
    return Number.isFinite(x) ? x : 0
  }
  return 0
}

/** The shape the v2 form's `prefill` prop carries (see assessment-form-v2). */
export interface EmptyAssessmentPrefill {
  parent1Income: AssessorIncomeRecord
  parent2Income: AssessorIncomeRecord
  propertyAssets: PropertyAssetsRecord
  debts: DebtsRecord
  portfolioType: PropertyPortfolioType
  cashSavings: number
  isasPepsShares: number
  usesCar: boolean
  usesPublicTransport: boolean
}

/** An income record carrying no figures at all. */
export function emptyIncomeRecord(): AssessorIncomeRecord {
  return { total: 0, documentsConfirmed: false }
}

/**
 * The D14-3 first-load state: no applicant-declared figure anywhere. The
 * portfolio type defaults to RENTING (the least-assuming option and the
 * existing null-assets fallback); the assessor sets the real structure in
 * Part 4. Applies only where no stored assessor record exists — saved
 * assessments always win, so in-flight work is untouched.
 */
export function emptyAssessmentPrefill(): EmptyAssessmentPrefill {
  return {
    parent1Income: emptyIncomeRecord(),
    parent2Income: emptyIncomeRecord(),
    propertyAssets: {},
    debts: {},
    portfolioType: 'RENTING',
    cashSavings: 0,
    isasPepsShares: 0,
    usesCar: false,
    usesPublicTransport: false,
  }
}

// ─── Second-earner derivation (CALC-07 review fix #1) ───────────────────────

const INCOME_SUB_BLOCKS = [
  'employed',
  'selfEmployed',
  'benefits',
  'unemployed',
  'retired',
  'divorcedSeparated',
  'thirdParty',
] as const

/**
 * True when an assessor income record carries NO income data — no sub-block
 * present and a zero total. Used to decide whether a Parent 2 record is real
 * (must never be silently discarded) or just an empty placeholder.
 */
export function isIncomeRecordEmpty(rec: AssessorIncomeRecord | null | undefined): boolean {
  if (!rec) return true
  const hasBlock = INCOME_SUB_BLOCKS.some(
    (key) => (rec as unknown as Record<string, unknown>)[key] != null,
  )
  return !hasBlock && num(rec.total) === 0
}

/**
 * Whether the v2 form should render/sum a second earner. With the D14-3
 * prefill removal the `prefillParent2` input is always empty on new
 * assessments, so this reduces to: a SUBMITTED secondary contributor with no
 * override locks it ON; a populated STORED Parent 2 record keeps it on; the
 * assessor can additionally toggle it manually in the form.
 */
export function shouldEnableSecondEarner(
  forceTwoEarner: boolean,
  storedParent2: AssessorIncomeRecord | null | undefined,
  prefillParent2: AssessorIncomeRecord | null | undefined,
): boolean {
  if (forceTwoEarner) return true
  if (!isIncomeRecordEmpty(storedParent2)) return true
  return !isIncomeRecordEmpty(prefillParent2)
}
