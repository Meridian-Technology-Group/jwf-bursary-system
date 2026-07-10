/**
 * CALC-07 — parent-submission → assessor-capture pre-fill mappers (pure).
 *
 * These implement the "auto-populate-then-confirm" first-load pre-fill: the
 * assessor's v2 capture records are seeded ONCE from the family's submitted
 * PARENTS_INCOME / ASSETS_LIABILITIES sections; thereafter the assessor's stored
 * record (`assessment_earners.income_detail` etc.) wins. All functions are pure
 * so the mapping decisions are unit-tested without a DB or React.
 *
 * Mapping decisions (documented here so the client answers are greppable):
 *  - INCOME: `AssessorIncomeRecord` is a structural superset of
 *    `ParentIncomeRecord`, so the mapping is a pass-through. Legacy flat drafts
 *    are first normalised via `income-model.ts` so old submissions still map.
 *  - PROPERTY (workbook C101/C102): home ← the family home; second ← the FIRST
 *    additional property; other ← the AGGREGATE of every remaining additional
 *    property (value and mortgage summed). When the family rents, `home` carries
 *    no owned value.
 *  - DEBTS (`DebtsRecord`): creditCards ← credit-card balance + bank overdraft;
 *    loans ← agency loans + friends/family loans; leaseBalances ← 0 (the parent
 *    form captures a car lease as a MONTHLY charge, not an outstanding balance —
 *    there is no lease *balance* field to map, so the assessor enters it);
 *    schoolFeesOwedOrOther ← school fees owed.
 *  - PORTFOLIO TYPE: RENTING when the family rents; else SINGLE (home only),
 *    DOUBLE (home + one other), MULTIPLE (home + two-or-more others).
 *  - TRANSPORT: usesCar ← the family declared a car (own or lease — the parent
 *    form makes car ownership mandatory, so this defaults true and the assessor
 *    can clear it); usesPublicTransport ← the parent's public-transport answer.
 */

import type { AssessorIncomeRecord } from '@/types/assessment-v2'
import type { PropertyAssetsRecord, DebtsRecord } from '@/types/assessment-v2'
import type { AssetsLiabilitiesData, ParentIncomeRecord } from '@/types/application'
import type { PropertyPortfolioType } from './profiling'
import {
  isLegacyIncomeRecord,
  normaliseLegacyIncomeRecord,
  newIncomeTotal,
} from '@/lib/portal/income-model'

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v)
    return Number.isFinite(x) ? x : 0
  }
  return 0
}

/**
 * Maps one parent's submitted income record into an `AssessorIncomeRecord`
 * (first-load pre-fill). Legacy flat drafts are normalised into the new
 * status-driven shape first; new-shape records pass through unchanged. `total`
 * is recomputed so a stale stored total never leaks through. Returns an empty
 * record (`{ total: 0, documentsConfirmed: false }`) for absent/unparseable input.
 */
export function parentIncomeToAssessorRecord(raw: unknown): AssessorIncomeRecord {
  if (!raw || typeof raw !== 'object') {
    return { total: 0, documentsConfirmed: false }
  }

  const record: ParentIncomeRecord = isLegacyIncomeRecord(raw)
    ? normaliseLegacyIncomeRecord(raw)
    : (raw as ParentIncomeRecord)

  // `AssessorIncomeRecord` extends `ParentIncomeRecord` with optional-only
  // assessor extras, so the parent record IS a valid assessor record. Deep-clone
  // so the assessor's edits never mutate the submitted source blob (the sub-blocks
  // are nested), and recompute the total.
  const cloned = structuredClone(record) as AssessorIncomeRecord
  cloned.total = newIncomeTotal(cloned)
  cloned.documentsConfirmed = false
  return cloned
}

/**
 * Maps the submitted assets/liabilities section into the itemised
 * `PropertyAssetsRecord` (home / second / aggregated other). See the module
 * header for the C101/C102 aggregation rule.
 */
export function assetsToPropertyAssets(assets: AssetsLiabilitiesData | null | undefined): PropertyAssetsRecord {
  if (!assets) return {}

  const home =
    assets.propertyOwnership === 'OWN'
      ? { value: num(assets.residenceValue), mortgageBalance: num(assets.mortgageBalance) }
      : undefined

  const others = Array.isArray(assets.otherProperties) ? assets.otherProperties : []
  const second = others[0]
    ? { value: num(others[0].value), mortgageBalance: num(others[0].mortgageBalance) }
    : undefined

  const remaining = others.slice(1)
  const other =
    remaining.length > 0
      ? {
          value: remaining.reduce((sum, p) => sum + num(p.value), 0),
          mortgageBalance: remaining.reduce((sum, p) => sum + num(p.mortgageBalance), 0),
        }
      : undefined

  const record: PropertyAssetsRecord = {}
  if (home) record.home = home
  if (second) record.second = second
  if (other) record.other = other
  return record
}

/** Maps the submitted liabilities into the itemised `DebtsRecord`. See module header. */
export function assetsToDebts(assets: AssetsLiabilitiesData | null | undefined): DebtsRecord {
  if (!assets) return {}
  return {
    creditCards: num(assets.creditCardBalance) + num(assets.bankOverdraft),
    loans: num(assets.loansToAgencies) + num(assets.loansToFriendsFamily),
    // No parent-provided lease *balance* — the car lease is a monthly charge.
    leaseBalances: 0,
    schoolFeesOwedOrOther: num(assets.schoolFeesOwed),
  }
}

/** Derives the property portfolio type from the submitted assets. See module header. */
export function derivePortfolioType(assets: AssetsLiabilitiesData | null | undefined): PropertyPortfolioType {
  if (!assets || assets.propertyOwnership !== 'OWN') return 'RENTING'
  const others = Array.isArray(assets.otherProperties) ? assets.otherProperties.length : 0
  if (others === 0) return 'SINGLE'
  if (others === 1) return 'DOUBLE'
  return 'MULTIPLE'
}

/** Maps the submitted savings figures (cash + investments) for the savings test. */
export function assetsToSavings(assets: AssetsLiabilitiesData | null | undefined): {
  cashSavings: number
  isasPepsShares: number
} {
  if (!assets) return { cashSavings: 0, isasPepsShares: 0 }
  return {
    cashSavings: num(assets.totalCashBalance),
    isasPepsShares: num(assets.investmentsValue),
  }
}

/** Maps the submitted transport answers into the two notional-spend toggles. See module header. */
export function assetsToTransport(assets: AssetsLiabilitiesData | null | undefined): {
  usesCar: boolean
  usesPublicTransport: boolean
} {
  if (!assets) return { usesCar: false, usesPublicTransport: false }
  return {
    usesCar: assets.carOwnership === 'OWN' || assets.carOwnership === 'LEASE',
    usesPublicTransport: assets.usesPublicTransport === true,
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
 * Whether the v2 form should render/sum a second earner. Data-driven, NOT
 * merely contributor-driven: two-parent households applying via a single
 * primary submission put Parent 2's income in the primary's `parent2Income`,
 * so a populated stored/prefilled Parent 2 record enables the second earner
 * even when no secondary contributor exists. The assessor can additionally
 * toggle it manually in the form (mirroring v1's sole-parent-toggle
 * philosophy); this derives only the initial/forced state.
 *
 * @param forceTwoEarner  A SUBMITTED secondary contributor with no override —
 *                        second earner locked ON.
 * @param storedParent2   The persisted PARENT_2 `income_detail`, if any.
 * @param prefillParent2  The Parent 2 record pre-filled from the submission.
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
