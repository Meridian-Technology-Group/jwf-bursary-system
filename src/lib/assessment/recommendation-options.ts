/**
 * Epic 08 — recommendation options comparison (pure, DB-free).
 *
 * The recommendation screen historically surfaced ONE opaque net-payable figure
 * taken straight from the completed assessment. Charlotte flagged the missing
 * "choice between views/options". This helper renders the calculator's scenarios
 * side by side from the SAME pure engine (`calculatePayableFees`) — it is a
 * presentation layer over existing maths, NOT a new calculation. Every scenario
 * is a single computation, so the net-payable can never double-apply a deduction
 * (the scholarship-double-counting risk in plan §8).
 *
 * Scenarios:
 *   - "bursary"            — bursary award only (no scholarship % deduction).
 *   - "bursary_scholarship"— bursary + the scholarship % deduction (the lever
 *                            Epic 07 owns). Only emitted when scholarshipPct > 0.
 *   - "with_siblings"      — the chosen scenario after sequential sibling income
 *                            absorption (the bursary the assessment actually
 *                            computed). Only emitted when siblings exist.
 *   - "without_siblings"   — the same inputs WITHOUT sibling absorption, i.e. the
 *                            bursary that would apply if this child were assessed
 *                            standalone. Only emitted when siblings exist and a
 *                            standalone bursary figure is supplied.
 *
 * The caller passes the figures the assessment already produced; this module
 * only re-projects net-payable for each, so the assessor can see and confirm the
 * chosen scenario rather than inherit it.
 */

import { calculatePayableFees } from "./payable-fees";

export interface OptionScenarioInput {
  /** Annual gross fees (pre-scholarship, pre-bursary). */
  grossFees: number;
  /** Scholarship percentage 0–100 (the fee-calculation lever). */
  scholarshipPct: number;
  /** The bursary award the chosen scenario applies (post sibling absorption). */
  bursaryAward: number;
  /** VAT rate (%). */
  vatRate: number;
  /** Manual fee adjustment (£, can be negative). */
  manualAdjustment: number;
  /** Whether this account has linked siblings (drives the with/without rows). */
  hasSiblings: boolean;
  /**
   * The bursary that would apply WITHOUT sibling income absorption (standalone),
   * when known. When null/undefined the without-siblings row is omitted.
   */
  standaloneBursaryAward?: number | null;
}

export interface OptionScenario {
  key:
    | "bursary"
    | "bursary_scholarship"
    | "with_siblings"
    | "without_siblings";
  label: string;
  bursaryAward: number;
  scholarshipPct: number;
  yearlyPayableFees: number;
  monthlyPayableFees: number;
}

function project(
  grossFees: number,
  scholarshipPct: number,
  bursaryAward: number,
  vatRate: number,
  manualAdjustment: number
): { yearly: number; monthly: number } {
  const r = calculatePayableFees(
    grossFees,
    scholarshipPct,
    bursaryAward,
    vatRate,
    manualAdjustment
  );
  return {
    yearly: r.adjustedYearlyPayableFees,
    monthly: r.adjustedMonthlyPayableFees,
  };
}

/**
 * Builds the side-by-side option scenarios for the recommendation screen. Pure —
 * every figure comes from `calculatePayableFees`. Returns an ordered list; the
 * caller marks one as the chosen/confirmed scenario.
 */
export function buildOptionScenarios(
  input: OptionScenarioInput
): OptionScenario[] {
  const {
    grossFees,
    scholarshipPct,
    bursaryAward,
    vatRate,
    manualAdjustment,
    hasSiblings,
    standaloneBursaryAward,
  } = input;

  const scenarios: OptionScenario[] = [];

  // (i) Bursary only — no scholarship deduction.
  const bursaryOnly = project(grossFees, 0, bursaryAward, vatRate, manualAdjustment);
  scenarios.push({
    key: "bursary",
    label: "Bursary only",
    bursaryAward,
    scholarshipPct: 0,
    yearlyPayableFees: bursaryOnly.yearly,
    monthlyPayableFees: bursaryOnly.monthly,
  });

  // (ii) Bursary + scholarship deduction (only when a scholarship % applies).
  if (scholarshipPct > 0) {
    const withScholarship = project(
      grossFees,
      scholarshipPct,
      bursaryAward,
      vatRate,
      manualAdjustment
    );
    scenarios.push({
      key: "bursary_scholarship",
      label: "Bursary + scholarship",
      bursaryAward,
      scholarshipPct,
      yearlyPayableFees: withScholarship.yearly,
      monthlyPayableFees: withScholarship.monthly,
    });
  }

  // (iii)/(iv) With vs without sibling absorption (only when siblings exist).
  if (hasSiblings) {
    const withSiblings = project(
      grossFees,
      scholarshipPct,
      bursaryAward,
      vatRate,
      manualAdjustment
    );
    scenarios.push({
      key: "with_siblings",
      label: "With sibling income absorption (chosen)",
      bursaryAward,
      scholarshipPct,
      yearlyPayableFees: withSiblings.yearly,
      monthlyPayableFees: withSiblings.monthly,
    });

    if (standaloneBursaryAward != null) {
      const withoutSiblings = project(
        grossFees,
        scholarshipPct,
        standaloneBursaryAward,
        vatRate,
        manualAdjustment
      );
      scenarios.push({
        key: "without_siblings",
        label: "Without sibling absorption (standalone)",
        bursaryAward: standaloneBursaryAward,
        scholarshipPct,
        yearlyPayableFees: withoutSiblings.yearly,
        monthlyPayableFees: withoutSiblings.monthly,
      });
    }
  }

  return scenarios;
}
