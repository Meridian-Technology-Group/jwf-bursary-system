/**
 * Generic XLSX / CSV builders (Epic 23 T4): any column list + plain rows.
 *
 * Generalised from WP-17's recommendations builder (`xlsx.ts`), which is now
 * one caller. Styling is unchanged: navy header row with white bold text and a
 * gold rule, frozen header, auto-filter, explicit widths, a number format per
 * column kind. Money stays numeric in both formats; dates are real dates in
 * the XLSX and dd/mm/yyyy (UK) in the CSV.
 */

import ExcelJS from "exceljs";
import { NUM_FMT, type CellValue, type ColumnDef } from "./columns";

const NAVY_HEX = "0D1B2A";
const WHITE_HEX = "FFFFFF";
const GOLD_HEX = "B8862A";

/** A column as the builders need it: header, key, width, optional numFmt. */
export interface SheetColumn {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
}

/** Registry columns → sheet columns (width from kind when not set). */
export function toSheetColumns(columns: readonly ColumnDef[]): SheetColumn[] {
  return columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? defaultWidth(c),
    numFmt: c.kind ? NUM_FMT[c.kind] : undefined,
  }));
}

function defaultWidth(c: ColumnDef): number {
  if (c.kind === "date") return 14;
  if (c.kind && c.kind !== "text") return 18;
  return Math.min(48, Math.max(14, Math.round(c.header.length * 0.9)));
}

/** Spreadsheet column letter for a 1-based index: 1 → A, 27 → AA. */
export function columnLetter(n: number): string {
  let letters = "";
  let rest = n;
  while (rest > 0) {
    const r = (rest - 1) % 26;
    letters = String.fromCharCode(65 + r) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

export async function buildSheetXlsx(
  columns: readonly SheetColumn[],
  rows: readonly Record<string, CellValue>[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JWF Bursary System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${NAVY_HEX}` } };
    cell.font = { bold: true, color: { argb: `FF${WHITE_HEX}` }, size: 10 };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = { bottom: { style: "thin", color: { argb: `FF${GOLD_HEX}` } } };
  });
  headerRow.height = 20;

  for (const row of rows) {
    const added = sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? null])));
    columns.forEach((c, idx) => {
      if (c.numFmt) added.getCell(idx + 1).numFmt = c.numFmt;
    });
  }

  if (columns.length) sheet.autoFilter = `A1:${columnLetter(columns.length)}1`;
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

const UK_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/London",
});

/** One cell as CSV text: dates dd/mm/yyyy, numbers as JS writes them, null blank. */
export function csvText(value: CellValue | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) return UK_DATE.format(value);
  return String(value);
}

export function buildSheetCsv(
  columns: readonly SheetColumn[],
  rows: readonly Record<string, CellValue>[],
): string {
  const lines = [csvRow(columns.map((c) => c.header))];
  for (const row of rows) lines.push(csvRow(columns.map((c) => csvText(row[c.key]))));
  return lines.join("\r\n");
}

function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

/** Wraps a value in double quotes if it contains a comma, quote or newline. */
export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
