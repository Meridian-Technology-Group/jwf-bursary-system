/**
 * CALC-10 — year-on-year financials history table (workbook §3.16 /
 * gap-analysis.md §2.2 rows 195–203, "Assessment admin, history & statuses").
 *
 * The workbook keeps a table on the account page, one row per assessment
 * year, of: household net income, total cash + savings, total property
 * equity, yearly debt exposure, and the lifestyle-squeeze label, plus a
 * year-on-year delta for each numeric column. This is a READ-ONLY projection
 * over the account's COMPLETED assessments' already-persisted snapshot
 * columns — there is no new write path (implementation-plan.md §CALC-10).
 *
 * Pure — no DB, no React, so it is unit-testable against plain row objects.
 * The DB query (`getYoyFinancialsRows`, `src/lib/db/queries/assessments.ts`)
 * loads the raw rows; the server component renders the table this builds.
 *
 * Null-safety: `yearlyDebtExposure`, `lifestyleSqueezeLabel` and
 * `propertyAssets` are v2-only snapshot columns (CALC-02..06) — a v1
 * assessment row has none of them, so those cells render "n/a" rather than a
 * misleading 0. `totalHouseholdNetIncome` and the cash/savings columns are
 * shared by both engine versions and populate normally for v1 rows.
 */

import { propertyEquityTotals } from "@/lib/assessment/v2/profiling";
import type { PropertyAssetsRecord } from "@/types/assessment-v2";

// ─── Input row (one per COMPLETED assessment) ─────────────────────────────────

export interface YoyFinancialsInputRow {
  applicationId: string;
  applicationReference: string;
  /** Round academic year label, e.g. "2025/26" — display only, not used for ordering. */
  academicYear: string;
  /** Used to order rows chronologically (oldest first). */
  completedAt: Date | string | null;
  /** `Assessment.totalHouseholdNetIncome` — shared by v1 and v2. */
  totalHouseholdNetIncome: number | null;
  /**
   * Epic 13 / C2 — `Assessment.manualAdjustment`, the signed manual income
   * adjustment folded into `totalHouseholdNetIncome` for v2 rows. Surfaced
   * here so a year whose income jumps because of an assessor adjustment is
   * never an unexplained jump. Null/0 when none was applied.
   */
  manualAdjustment: number | null;
  /** `AssessmentProperty.cashSavings` — shared by v1 and v2; null when no property row exists. */
  cashSavings: number | null;
  /** `AssessmentProperty.isasPepsShares` — shared by v1 and v2; null when no property row exists. */
  isasPepsShares: number | null;
  /** `AssessmentProperty.propertyAssets` JSONB (CALC-02) — v2 only, null for v1 rows. */
  propertyAssets: PropertyAssetsRecord | null;
  /** `Assessment.yearlyDebtExposure` (CALC-04) — v2 only, null for v1 rows. */
  yearlyDebtExposure: number | null;
  /** `Assessment.lifestyleSqueezeLabel` (CALC-05) — v2 only, null for v1 rows. */
  lifestyleSqueezeLabel: string | null;
}

// ─── Output table row (with YoY deltas) ───────────────────────────────────────

export interface YoyFinancialsTableRow {
  applicationId: string;
  applicationReference: string;
  academicYear: string;
  totalHouseholdNetIncome: number | null;
  /** Epic 13 / C2 — the signed manual income adjustment inside `totalHouseholdNetIncome` (null/0 when none). */
  manualAdjustment: number | null;
  /** `cashSavings + isasPepsShares`; `null` only when BOTH source values are null (no property row). */
  totalCashSavings: number | null;
  /** Sum of per-property equity (value − mortgageBalance) from `propertyAssets`; `null` when no JSONB is stored (v1, or not yet itemised). */
  totalPropertyEquity: number | null;
  yearlyDebtExposure: number | null;
  lifestyleSqueezeLabel: string | null;
  /** YoY deltas — `current − previous`; `null` for the first row or whenever either side is `null`. */
  deltaTotalHouseholdNetIncome: number | null;
  deltaTotalCashSavings: number | null;
  deltaTotalPropertyEquity: number | null;
  deltaYearlyDebtExposure: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completedAtMillis(value: Date | string | null): number {
  if (!value) return Number.POSITIVE_INFINITY; // undated rows sort LAST (newest end)
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** `a + b` treating `null`/`undefined` as 0, EXCEPT when both are nullish (→ `null`, not 0). */
function sumNullSafe(a: number | null | undefined, b: number | null | undefined): number | null {
  const aVal = a ?? null;
  const bVal = b ?? null;
  if (aVal === null && bVal === null) return null;
  return (aVal ?? 0) + (bVal ?? 0);
}

function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

function totalPropertyEquity(propertyAssets: PropertyAssetsRecord | null): number | null {
  if (!propertyAssets) return null;
  return propertyEquityTotals(propertyAssets).totalEquity;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds the YoY financials table from the account's COMPLETED-assessment
 * rows. Input order is irrelevant — rows are sorted chronologically ascending
 * (oldest first, matching the workbook's top-to-bottom year progression) by
 * `completedAt` before deltas are computed. The first row's deltas are all
 * `null` (nothing to compare against).
 */
export function buildYoyFinancialsTable(
  rows: readonly YoyFinancialsInputRow[]
): YoyFinancialsTableRow[] {
  const sorted = [...rows].sort(
    (a, b) => completedAtMillis(a.completedAt) - completedAtMillis(b.completedAt)
  );

  let prevIncome: number | null = null;
  let prevCashSavings: number | null = null;
  let prevEquity: number | null = null;
  let prevDebtExposure: number | null = null;

  return sorted.map((row) => {
    const totalCashSavings = sumNullSafe(row.cashSavings, row.isasPepsShares);
    const propertyEquity = totalPropertyEquity(row.propertyAssets);

    const tableRow: YoyFinancialsTableRow = {
      applicationId: row.applicationId,
      applicationReference: row.applicationReference,
      academicYear: row.academicYear,
      totalHouseholdNetIncome: row.totalHouseholdNetIncome,
      manualAdjustment: row.manualAdjustment,
      totalCashSavings,
      totalPropertyEquity: propertyEquity,
      yearlyDebtExposure: row.yearlyDebtExposure,
      lifestyleSqueezeLabel: row.lifestyleSqueezeLabel,
      deltaTotalHouseholdNetIncome: delta(row.totalHouseholdNetIncome, prevIncome),
      deltaTotalCashSavings: delta(totalCashSavings, prevCashSavings),
      deltaTotalPropertyEquity: delta(propertyEquity, prevEquity),
      deltaYearlyDebtExposure: delta(row.yearlyDebtExposure, prevDebtExposure),
    };

    prevIncome = row.totalHouseholdNetIncome;
    prevCashSavings = totalCashSavings;
    prevEquity = propertyEquity;
    prevDebtExposure = row.yearlyDebtExposure;

    return tableRow;
  });
}
