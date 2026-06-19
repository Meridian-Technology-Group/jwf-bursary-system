/**
 * WP-08: Assessment Engine — Payable Fees Calculation
 *
 * Calculates the final payable fees after applying scholarship, bursary award,
 * VAT, and manual adjustments.
 * Pure function — no side effects, no DB or UI dependencies.
 */

import type { PayableFeesResult } from './types'

/**
 * Rounds a monetary value to 2 decimal places.
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Calculates the full payable fees breakdown.
 *
 * Steps:
 *  1. scholarshipDeduction = grossFees * (scholarshipPct / 100)
 *  2. netYearlyFees = grossFees - scholarshipDeduction - bursaryAward  (min 0)
 *  3. vatAmount = netYearlyFees * (vatRate / 100)
 *  4. yearlyPayableFees = netYearlyFees + vatAmount
 *  5. monthlyPayableFees = yearlyPayableFees / 12
 *  6. adjustedYearlyPayableFees = yearlyPayableFees + manualAdjustment  (min 0)
 *  7. adjustedMonthlyPayableFees = adjustedYearlyPayableFees / 12
 *
 * All monetary values are rounded to 2 decimal places.
 *
 * Epic 07 — when `nextYearGrossFees` is supplied, a parallel next-year payable
 * breakdown is computed and returned in the `nextYear*` fields. Per D14 (default
 * rule, until Charlotte confirms the fee-uplift boundary), the scholarship % and
 * bursary award are held FLAT at the current-year figures; only the gross fee
 * changes. This surfaces the payment implication of the uplift without altering
 * the bursary maths. When `nextYearGrossFees` is omitted the next-year fields are
 * `null` and the current-year result is byte-for-byte unchanged.
 *
 * @param grossFees         Annual gross school fees (pre-scholarship, pre-bursary)
 * @param scholarshipPct    Scholarship percentage 0–100
 * @param bursaryAward      Bursary award amount
 * @param vatRate           VAT rate (default 20)
 * @param manualAdjustment  Manual fee adjustment (can be negative for discount)
 * @param nextYearGrossFees Optional next-year annual gross fees (for the uplift view)
 */
export function calculatePayableFees(
  grossFees: number,
  scholarshipPct: number,
  bursaryAward: number,
  vatRate: number,
  manualAdjustment: number,
  nextYearGrossFees?: number,
): PayableFeesResult {
  const scholarshipDeduction = roundMoney(grossFees * (scholarshipPct / 100))

  const netYearlyFeesRaw = grossFees - scholarshipDeduction - bursaryAward
  const netYearlyFees = roundMoney(Math.max(0, netYearlyFeesRaw))

  const vatAmount = roundMoney(netYearlyFees * (vatRate / 100))

  const yearlyPayableFees = roundMoney(netYearlyFees + vatAmount)
  const monthlyPayableFees = roundMoney(yearlyPayableFees / 12)

  const adjustedYearlyPayableFees = roundMoney(Math.max(0, yearlyPayableFees + manualAdjustment))
  const adjustedMonthlyPayableFees = roundMoney(adjustedYearlyPayableFees / 12)

  // ── Next-year view (D14 default: scholarship % + bursary held flat) ─────────
  let nextYearGross: number | null = null
  let nextYearNet: number | null = null
  let nextYearVat: number | null = null
  let nextYearYearly: number | null = null
  let nextYearMonthly: number | null = null

  if (nextYearGrossFees !== undefined && nextYearGrossFees !== null) {
    const nyScholarshipDeduction = nextYearGrossFees * (scholarshipPct / 100)
    const nyNetRaw = nextYearGrossFees - nyScholarshipDeduction - bursaryAward
    nextYearGross = roundMoney(nextYearGrossFees)
    nextYearNet = roundMoney(Math.max(0, nyNetRaw))
    nextYearVat = roundMoney(nextYearNet * (vatRate / 100))
    // Manual adjustment also applies to the next-year payable (same £ delta).
    const nyYearlyBeforeAdj = nextYearNet + nextYearVat
    nextYearYearly = roundMoney(Math.max(0, nyYearlyBeforeAdj + manualAdjustment))
    nextYearMonthly = roundMoney(nextYearYearly / 12)
  }

  return {
    grossFees: roundMoney(grossFees),
    scholarshipDeduction,
    bursaryAward: roundMoney(bursaryAward),
    netYearlyFees,
    vatAmount,
    yearlyPayableFees,
    monthlyPayableFees,
    adjustedYearlyPayableFees,
    adjustedMonthlyPayableFees,
    nextYearGrossFees: nextYearGross,
    nextYearNetYearlyFees: nextYearNet,
    nextYearVatAmount: nextYearVat,
    nextYearYearlyPayableFees: nextYearYearly,
    nextYearMonthlyPayableFees: nextYearMonthly,
  }
}
