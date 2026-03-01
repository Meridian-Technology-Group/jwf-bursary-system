/**
 * XLSX and CSV export builders for WP-17 — Exports.
 *
 * buildXlsxBuffer — produces an ExcelJS workbook as a Node.js Buffer.
 * buildCsvString  — produces a plain CSV string with the same columns.
 */

import ExcelJS from "exceljs";
import type { ExportRow } from "@/lib/db/queries/exports";

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  header: string;
  key: keyof ExportRow;
  width: number;
  numFmt?: string;
}

const COLUMNS: ColumnDef[] = [
  { header: "Reference", key: "reference", width: 18 },
  { header: "First Name", key: "childFirstName", width: 18 },
  { header: "Last Name", key: "childLastName", width: 18 },
  { header: "School", key: "school", width: 12 },
  { header: "Family Synopsis", key: "familySynopsis", width: 40 },
  { header: "Accommodation", key: "accommodationType", width: 22 },
  { header: "Income Category", key: "incomeCategory", width: 22 },
  { header: "Property Category", key: "propertyCategory", width: 20 },
  {
    header: "Bursary Award (%)",
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
];

// Design tokens
const NAVY_HEX = "0D1B2A";
const WHITE_HEX = "FFFFFF";

// ─── XLSX ─────────────────────────────────────────────────────────────────────

/**
 * Builds an ExcelJS workbook from ExportRow[] and returns it as a Buffer.
 * Features:
 *  - Navy (#0D1B2A) header row with white bold text
 *  - £ currency format on financial columns
 *  - Auto-filter on all columns
 *  - Column widths set explicitly
 */
export async function buildXlsxBuffer(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "JWF Bursary System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Recommendations", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Set columns
  sheet.columns = COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${NAVY_HEX}` },
    };
    cell.font = {
      bold: true,
      color: { argb: `FF${WHITE_HEX}` },
      size: 10,
    };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB8862A" } },
    };
  });
  headerRow.height = 20;

  // Add data rows
  rows.forEach((row) => {
    const addedRow = sheet.addRow({
      reference: row.reference,
      childFirstName: row.childFirstName,
      childLastName: row.childLastName,
      school: row.school,
      familySynopsis: row.familySynopsis,
      accommodationType: row.accommodationType,
      incomeCategory: row.incomeCategory,
      propertyCategory: row.propertyCategory,
      bursaryAward: row.bursaryAward,
      yearlyPayableFees: row.yearlyPayableFees,
      monthlyPayableFees: row.monthlyPayableFees,
      reasonCodes: row.reasonCodes,
      flags: row.flags,
      outcome: row.outcome,
    });

    // Apply number formats to financial columns
    COLUMNS.forEach((col, idx) => {
      if (col.numFmt) {
        const cell = addedRow.getCell(idx + 1);
        cell.numFmt = col.numFmt;
      }
    });
  });

  // Auto-filter on header row spanning all columns
  const lastColLetter = String.fromCharCode(64 + COLUMNS.length);
  sheet.autoFilter = `A1:${lastColLetter}1`;

  // Return as Buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Builds a CSV string from ExportRow[].
 * Values containing commas, quotes, or newlines are double-quote-escaped.
 */
export function buildCsvString(rows: ExportRow[]): string {
  const headers = COLUMNS.map((col) => col.header);
  const lines: string[] = [csvRow(headers)];

  for (const row of rows) {
    const values = COLUMNS.map((col) => {
      const val = row[col.key];
      return val != null ? String(val) : "";
    });
    lines.push(csvRow(values));
  }

  return lines.join("\r\n");
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Encodes a single CSV row, escaping values that need quoting. */
function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

/** Wraps a value in double-quotes if it contains commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
