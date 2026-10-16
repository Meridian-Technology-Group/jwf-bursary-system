/**
 * XLSX and CSV export builders for WP-17 — Export Recommendations.
 *
 * buildXlsxBuffer — produces an ExcelJS workbook as a Node.js Buffer.
 * buildCsvString  — produces a plain CSV string with the same columns.
 *
 * Epic 23 T4: both now delegate to the generic builders in `./build`, which
 * the three new export sections share. Output is unchanged.
 */

import type { ExportRow } from "@/lib/db/queries/exports";
import type { CellValue } from "./columns";
import { buildSheetCsv, buildSheetXlsx, columnLetter } from "./build";

export { columnLetter };

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  header: string;
  key: keyof ExportRow;
  width: number;
  numFmt?: string;
}

const COLUMNS: ColumnDef[] = [
  // D13-1a: the reference is a free-text label (default
  // `{Child} – {School} – {Year group} – {Academic year}`, routinely re-edited
  // to the fees-system code), so it is wide and the child's name follows it as
  // its own sortable columns. `childFirstName`/`childLastName` were already on
  // `ExportRow` — they simply had no column.
  { header: "Reference", key: "reference", width: 44 },
  { header: "Child First Name", key: "childFirstName", width: 18 },
  { header: "Child Last Name", key: "childLastName", width: 20 },
  { header: "School", key: "school", width: 12 },
  { header: "Family Synopsis", key: "familySynopsis", width: 40 },
  { header: "Accommodation", key: "accommodationType", width: 22 },
  { header: "Income Category", key: "incomeCategory", width: 22 },
  { header: "Property Category", key: "propertyCategory", width: 20 },
  // Epic 23 T4: on v2 this holds £ before VAT, not a percentage.
  {
    header: "Bursary Award (£, before VAT)",
    key: "bursaryAward",
    width: 18,
    numFmt: "0.00",
  },
  {
    header: "Yearly Payable Fees",
    key: "yearlyPayableFees",
    width: 22,
    numFmt: '£#,##0.00',
  },
  {
    header: "Monthly Payable Fees",
    key: "monthlyPayableFees",
    width: 22,
    numFmt: '£#,##0.00',
  },
  { header: "Reason Codes", key: "reasonCodes", width: 50 },
  { header: "Flags", key: "flags", width: 24 },
  { header: "Outcome", key: "outcome", width: 20 },
  // CALC-12: v2-only columns (full notional model). Blank for v1 rows.
  {
    header: "Recommended Payable Fees",
    key: "recommendedPayableFees",
    width: 24,
    numFmt: '£#,##0.00',
  },
  {
    header: "Confirmed Payable Fees",
    key: "confirmedPayableFees",
    width: 24,
    numFmt: '£#,##0.00',
  },
  {
    header: "Gap Amount",
    key: "gapAmount",
    width: 18,
    numFmt: '£#,##0.00',
  },
  { header: "Gap Reasons", key: "gapReasons", width: 50 },
  // Epic 21 #1 + #2: the gap code that takes the full justification, and the
  // gap with the scholarship added back (funding view; display only).
  { header: "Main Gap Reason", key: "mainGapReason", width: 50 },
  {
    header: "Scholarship-adjusted Gap",
    key: "scholarshipAdjustedGap",
    width: 24,
    numFmt: '£#,##0.00',
  },
  { header: "Debt Status", key: "debtStatus", width: 22 },
  { header: "Lifestyle Squeeze", key: "lifestyleSqueezeLabel", width: 22 },
  // Epic 13 / C2: the household income figure the award rests on, immediately
  // followed by the manual adjustment folded into it and its reason — so the
  // number is never unexplained in the spreadsheet either.
  {
    header: "Household Net Income",
    key: "totalHouseholdNetIncome",
    width: 24,
    numFmt: '£#,##0.00',
  },
  {
    header: "Manual Income Adjustment",
    key: "manualAdjustment",
    width: 24,
    numFmt: '£#,##0.00;[Red]-£#,##0.00',
  },
  {
    header: "Manual Adjustment Reason",
    key: "manualAdjustmentReason",
    width: 50,
  },
];

const rows_ = (rows: ExportRow[]) => rows as unknown as Record<string, CellValue>[];

/**
 * Builds the Recommendations workbook (navy header, £ formats, auto-filter,
 * explicit widths) and returns it as a Buffer.
 */
export async function buildXlsxBuffer(rows: ExportRow[]): Promise<Buffer> {
  return buildSheetXlsx(COLUMNS, rows_(rows), "Recommendations");
}

/**
 * Builds a CSV string with the same columns. Values containing commas,
 * quotes, or newlines are double-quote-escaped.
 */
export function buildCsvString(rows: ExportRow[]): string {
  return buildSheetCsv(COLUMNS, rows_(rows));
}
