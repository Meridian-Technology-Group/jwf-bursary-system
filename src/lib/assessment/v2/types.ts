/**
 * CALC-03 — Engine v2 shared types + `ReferenceBundle`.
 *
 * `src/lib/assessment/v2/` is the full notional model (implementation-plan.md
 * §2 architecture decision #1), dispatched by `Assessment.calculationVersion`.
 * It sits BESIDE the v1 engine (`src/lib/assessment/`) — v1 files are never
 * imported by v2 modules except the handful of version-neutral pure helpers
 * the plan calls out for reuse (`calculateDerivedSavings` from
 * `../stage2-assets`; the band resolvers in `../reference-bands`). No DB, no
 * React — every DB read happens in `src/lib/db/queries/` and is handed to
 * these functions as plain data.
 *
 * `ReferenceBundle` is the single carrier of reference/lookup values the
 * whole v2 engine consumes (CALC-03 income + notional spend, CALC-04 debt,
 * CALC-05 profiling, CALC-06 award). It is deliberately just the CALC-01 row
 * shapes (see `../reference-bands`) bundled together — no new field names,
 * no re-derivation — so later work packages can add methods that read more
 * of the bundle without changing its shape or breaking CALC-03's callers.
 */

import type {
  NotionalCostConfigRow,
  FamilyCategoryMetaRow,
  AffordabilityBandRow,
  IncomeCategoryBandRow,
  PropertyEquityBandRow,
  FinancialEquityBandRow,
  DebtRatioBandRow,
  LifestyleSqueezeBandRow,
} from '../reference-bands'

/**
 * The single reference-data carrier for the v2 engine. Each field is the
 * full versioned-and-already-resolved-to-"latest effective" row set for one
 * CALC-01 reference table (see `src/lib/db/queries/reference-tables.ts` for
 * the resolve-latest-effectiveFrom read); the pure resolvers in
 * `../reference-bands` then pick the row that applies to a given value.
 *
 * Kept complete and generic on purpose (per CALC-03 scope note): CALC-04
 * (debt), CALC-05 (profiling) and CALC-06 (award) consume the SAME bundle
 * with no shape changes.
 */
export interface ReferenceBundle {
  /** Appendix A — per-category notional costs (rent, councilTax, essentials, car, publicTransport, jwfAllowance, notionalSavings, savingsCushion). */
  notionalCosts: readonly NotionalCostConfigRow[]
  /** Appendix A row 1 — family-members / school-age-children per category. */
  familyCategoryMetas: readonly FamilyCategoryMetaRow[]
  /** Appendix B — affordability grid (CALC-06). */
  affordabilityBands: readonly AffordabilityBandRow[]
  /** Appendix C.1 — income category + fees-benchmark % (CALC-05/06). */
  incomeCategoryBands: readonly IncomeCategoryBandRow[]
  /** Appendix C.2 — property-equity category (CALC-05). */
  propertyEquityBands: readonly PropertyEquityBandRow[]
  /** Appendix C.3 — financial-equity label (CALC-05). */
  financialEquityBands: readonly FinancialEquityBandRow[]
  /** Appendix C.4 — debt-over-NDI ratio → status/min-repayment (CALC-04). */
  debtRatioBands: readonly DebtRatioBandRow[]
  /** Appendix C.5 — lifestyle-squeeze ratio → status (CALC-05). */
  lifestyleSqueezeBands: readonly LifestyleSqueezeBandRow[]
}

/**
 * `Assessment.rentAddBackType` (CALC-02) — replaces v1's binary
 * `isMortgageFree` add-back for v2. Defined locally (matching the Prisma
 * enum verbatim) rather than importing `@prisma/client`, per engine-purity
 * (no DB imports in `src/lib/assessment/`), the same pattern v1's
 * `EmploymentStatus` union follows.
 */
export type RentAddBackType =
  | 'NONE'
  | 'FULL_MORTGAGE_FREE'
  | 'FULL_RENT_FREE'
  | 'PARTIAL_LOWER_RENT'

/** Whether an itemised notional-spend line reduces or restores NDI. */
export type NotionalSpendLineDirection = 'DEDUCTION' | 'ADD_BACK'

/**
 * One line of the workbook's notional-spend block (rows C56–C83). `amount`
 * is always a non-negative magnitude — the "auto value" the assessor sees —
 * so the UI can show it plainly; `direction` and `signedAmount` carry the
 * workbook's own "±" column (deductions negative, add-backs positive).
 * `totalNotionalSpend` (C85) is the sum of every line's `signedAmount`.
 */
export interface NotionalSpendLine {
  key:
    | 'rent'
    | 'rentAddBack'
    | 'multiPropertyRentAddBack'
    | 'councilTax'
    | 'councilTaxAddBack'
    | 'essentials'
    | 'car'
    | 'publicTransport'
    | 'jwfAllowance'
    | 'notionalSavingsBenchmark'
    | 'savingsTestAddBack'
    | 'feeInsuranceAddBack'
  label: string
  direction: NotionalSpendLineDirection
  /** Non-negative magnitude. */
  amount: number
  /** `+amount` for ADD_BACK, `-amount` for DEDUCTION. */
  signedAmount: number
}

/** Inputs to `calculateNotionalSpend` (`notional-spend.ts`). */
export interface NotionalSpendInput {
  /** Family type category 1–6 — keys every `ReferenceBundle.notionalCosts` / `familyCategoryMetas` lookup. */
  familyTypeCategory: number
  /** Household net income (C40, from `calculateHouseholdNetIncome`) — used for C87. */
  netIncome: number
  rentAddBackType: RentAddBackType
  /**
   * CH-21 — assessor's manual £ override of the C57 rent add-back. `null` /
   * absent = the dropdown-derived figure (byte-identical pre-CH-21 behaviour).
   * A non-negative finite value replaces the derived amount on the C57 line
   * only — C56 (rent deduct) and C58 (multi-property add-back) stay on the
   * reference notional rent.
   */
  rentAddBackOverride?: number | null
  /** C58 — independent of `rentAddBackType`; assessor-judged (assumption CALC-A7). */
  multiPropertyRentAddBack: boolean
  /** C60 — full council-tax-support add-back. */
  councilTaxSupport: boolean
  /**
   * CH-22 — assessor's manual £ override of the C59 annual council-tax
   * deduction. `null` / absent = the reference-band default (byte-identical
   * pre-CH-22 behaviour). The override is the EFFECTIVE council-tax amount,
   * so the C60 support add-back (which recharges the deduction) adds back
   * the same overridden figure when `councilTaxSupport` is set.
   */
  councilTaxOverride?: number | null
  /** C65/66 — deduct notional car spend only when true. */
  usesCar: boolean
  /** C67/68 — deduct notional public-transport spend only when true. */
  usesPublicTransport: boolean
  /** C83 — yearly insured school-fee total, added back in full. Default 0. */
  feeInsuranceAnnual: number
  /** Total cash on hand (C72). */
  cashSavings: number
  /** ISAs/PEPs/shares (C73). */
  isasPepsShares: number
  /** School-years-left divisor (C76). */
  schoolingYearsRemaining: number
  /**
   * Derived yearly debt repayments (C123) — computed by CALC-04, wired in by
   * the CALC-06 orchestrator. Plain number input here; 0 when there is no
   * debt module output yet (e.g. unit-testing this module in isolation).
   */
  derivedYearlyDebtRepayments: number
}

/** Output of `calculateNotionalSpend`. */
export interface NotionalSpendResult {
  /** Every line of the notional-spend block, in workbook row order. */
  lines: readonly NotionalSpendLine[]
  /** C77 — annualised adjusted savings: total savings / remaining school years (savings-test respec, 5 Sep 2026). */
  adjustedSavings: number
  /** C80 — signed savings-test number (adjustedSavings − derivedYearlyDebtRepayments − savingsCushion); NOT floored. */
  savingsTestNumber: number
  /** C85 — signed sum of every line's `signedAmount`. */
  totalNotionalSpend: number
  /** C87 — `netIncome + totalNotionalSpend`. */
  ndiAfterNotionalSpend: number
}
