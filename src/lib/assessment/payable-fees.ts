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
 * @param grossFees         Annual gross school fees (pre-scholarship, pre-bursary)
 * @param scholarshipPct    Scholarship percentage 0–100
 * @param bursaryAward      Bursary award amount
 * @param vatRate           VAT rate (default 20)
 * @param manualAdjustment  Manual fee adjustment (can be negative for discount)
 */
export function calculatePayableFees(
  grossFees: number,
  scholarshipPct: number,
  bursaryAward: number,
  vatRate: number,
  manualAdjustment: number,
): PayableFeesResult {
  const scholarshipDeduction = roundMoney(grossFees * (scholarshipPct / 100))

  const netYearlyFeesRaw = grossFees - scholarshipDeduction - bursaryAward
  const netYearlyFees = roundMoney(Math.max(0, netYearlyFeesRaw))

  const vatAmount = roundMoney(netYearlyFees * (vatRate / 100))

  const yearlyPayableFees = roundMoney(netYearlyFees + vatAmount)
  const monthlyPayableFees = roundMoney(yearlyPayableFees / 12)

  const adjustedYearlyPayableFees = roundMoney(Math.max(0, yearlyPayableFees + manualAdjustment))
  const adjustedMonthlyPayableFees = roundMoney(adjustedYearlyPayableFees / 12)

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
  }
}
