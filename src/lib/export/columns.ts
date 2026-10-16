/**
 * Export column registries (Epic 23 T4, D-12).
 *
 * Each export section declares its columns once, in her order (EXPORTS.xlsx,
 * 15 Oct 2026), with her header wording. The same list drives the XLSX, the
 * CSV and the field picker; the picker sends back column keys (`fields=`),
 * which the route validates here before any query runs.
 *
 * Pure: no DB, no React — client components import it for the picker.
 */

/** How a value is written: drives the XLSX number format and the CSV text. */
export type ColumnKind = "text" | "money" | "number" | "percent" | "ratio" | "date";

export interface ColumnDef {
  /** Stable key: the `fields=` token and the row property. */
  key: string;
  /** Her header text. */
  header: string;
  /** Picker group (a part of the assessment, or "Identity"). */
  group: string;
  kind?: ColumnKind;
  width?: number;
}

/** A row value: money and counts stay numbers, dates stay dates. */
export type CellValue = string | number | Date | null;
export type ExportRecord = Record<string, CellValue>;

export const NUM_FMT: Record<ColumnKind, string | undefined> = {
  text: undefined,
  money: "£#,##0.00;[Red]-£#,##0.00",
  number: "0",
  percent: '0.00"%"',
  ratio: "0.00",
  date: "dd/mm/yyyy",
};

export type FieldSelection =
  | { ok: true; columns: ColumnDef[] }
  | { ok: false; error: string };

/**
 * `fields=` → the selected columns, in the registry's order (never the
 * request's). Absent = every column. Present but empty, or naming a key the
 * section doesn't have, is an error (the route answers 400).
 */
export function selectColumns(
  registry: readonly ColumnDef[],
  fields: string | null | undefined,
): FieldSelection {
  if (fields == null) return { ok: true, columns: [...registry] };
  const wanted = fields
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (wanted.length === 0) return { ok: false, error: "Choose at least one field." };
  const known = new Set(registry.map((c) => c.key));
  const unknown = wanted.filter((k) => !known.has(k));
  if (unknown.length) return { ok: false, error: `Unknown field(s): ${unknown.join(", ")}` };
  const set = new Set(wanted);
  return { ok: true, columns: registry.filter((c) => set.has(c.key)) };
}

/** The picker groups, in first-appearance order. */
export function columnGroups(registry: readonly ColumnDef[]): { group: string; columns: ColumnDef[] }[] {
  const out: { group: string; columns: ColumnDef[] }[] = [];
  for (const c of registry) {
    const g = out.find((x) => x.group === c.group);
    if (g) g.columns.push(c);
    else out.push({ group: c.group, columns: [c] });
  }
  return out;
}
