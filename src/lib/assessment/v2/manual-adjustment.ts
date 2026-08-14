/**
 * Epic 13 / C2 — the manual income-adjustment line's rules (D13-3).
 *
 * ONE adjustment line, not per-field overrides of calculated cells. It is a
 * SIGNED amount added to the household's aggregated earner income (see
 * `calculateHouseholdNetIncome`, `./income.ts`), and it carries a MANDATORY
 * free-text reason whenever it is non-zero — an unexplained movement in the
 * household income figure is exactly what this must never produce.
 *
 * Pure module — no DB, no React, no Zod. The Zod schema
 * (`src/lib/schemas/assessment-v2.ts`), the assessor form and the server
 * action all funnel through these two functions so the browser, the schema
 * and the server can never disagree about what "valid" means.
 */

/** Amounts within this tolerance of zero count as "no adjustment" (float/pence noise). */
const ZERO_TOLERANCE = 0.005

/** User-facing refusal when a non-zero adjustment carries no reason. */
export const MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE =
  'A manual income adjustment needs a reason — say why the household income figure is being changed (e.g. "second parent\'s income added, divorced/separated household").'

/** User-facing refusal when the amount is not a usable number. */
export const MANUAL_ADJUSTMENT_INVALID_AMOUNT_MESSAGE =
  'The manual income adjustment must be a number (it may be negative to deduct).'

/** Normalises whatever the caller holds into a finite signed number; `null`/`undefined`/NaN → 0. */
export function normaliseManualAdjustment(amount: number | null | undefined): number {
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

/** Is the adjustment materially non-zero (and therefore in need of a reason)? */
export function isManualAdjustmentApplied(amount: number | null | undefined): boolean {
  return Math.abs(normaliseManualAdjustment(amount)) >= ZERO_TOLERANCE
}

export type ManualAdjustmentValidation =
  | { ok: true }
  | { ok: false; error: string }

/**
 * The single rule: a non-zero amount requires a non-blank reason. A zero (or
 * absent) amount never requires one — and a reason left behind on a
 * zeroed-out adjustment is harmless, so it is not an error.
 */
export function validateManualAdjustment(input: {
  amount: number | null | undefined
  reason: string | null | undefined
}): ManualAdjustmentValidation {
  const { amount, reason } = input

  if (amount != null && typeof amount === 'number' && !Number.isFinite(amount)) {
    return { ok: false, error: MANUAL_ADJUSTMENT_INVALID_AMOUNT_MESSAGE }
  }

  if (!isManualAdjustmentApplied(amount)) return { ok: true }

  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return { ok: false, error: MANUAL_ADJUSTMENT_REASON_REQUIRED_MESSAGE }
  }

  return { ok: true }
}
