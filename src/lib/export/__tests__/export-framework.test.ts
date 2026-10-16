/**
 * Epic 23 T4 — the export framework: column registries + `fields=`, the
 * generic XLSX/CSV builders, the shared value rules and the field picker.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { columnGroups, selectColumns, type ColumnDef } from "../columns";
import { buildSheetCsv, buildSheetXlsx, csvEscape, csvText, toSheetColumns } from "../build";
import {
  accountStateLabel,
  codeLabels,
  flattenSiblings,
  inSystemOnly,
  num,
  parentCount,
  postcodeOutward,
  submissionStatus,
  v2Only,
} from "../fields";
import { buildExportHref, groupState, initialSelection, toggleField, toggleGroup } from "../picker";

const REG: ColumnDef[] = [
  { key: "a", header: "Alpha", group: "G1" },
  { key: "b", header: "Beta, with comma", group: "G1", kind: "money" },
  { key: "c", header: "Gamma", group: "G2", kind: "date" },
];

describe("selectColumns (fields=)", () => {
  it("absent = every column", () => {
    expect(selectColumns(REG, null)).toEqual({ ok: true, columns: REG });
  });
  it("keeps the registry order, whatever order the request names them in", () => {
    const r = selectColumns(REG, "c,a");
    expect(r.ok && r.columns.map((c) => c.key)).toEqual(["a", "c"]);
  });
  it("empty or unknown keys are errors", () => {
    expect(selectColumns(REG, "").ok).toBe(false);
    expect(selectColumns(REG, " , ").ok).toBe(false);
    const r = selectColumns(REG, "a,zzz");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("zzz");
  });
  it("groups in first-appearance order", () => {
    expect(columnGroups(REG).map((g) => [g.group, g.columns.length])).toEqual([
      ["G1", 2],
      ["G2", 1],
    ]);
  });
});

describe("generic builders", () => {
  const rows = [
    { a: 'x "q"', b: 1234.5, c: new Date("2026-05-24T23:30:00Z") },
    { a: null, b: null, c: null },
  ];
  it("CSV: header quoting, numbers as numbers, UK dates in London time, blanks", () => {
    const csv = buildSheetCsv(toSheetColumns(REG), rows).split("\r\n");
    expect(csv[0]).toBe('Alpha,"Beta, with comma",Gamma');
    expect(csv[1]).toBe('"x ""q""",1234.5,25/05/2026');
    expect(csv[2]).toBe(",,");
  });
  it("CSV: a column subset writes only those columns, in order", () => {
    const sel = selectColumns(REG, "c,a");
    const csv = buildSheetCsv(toSheetColumns(sel.ok ? sel.columns : []), rows).split("\r\n");
    expect(csv[0]).toBe("Alpha,Gamma");
  });
  it("csvText / csvEscape", () => {
    expect(csvText(undefined)).toBe("");
    expect(csvText(0)).toBe("0");
    expect(csvEscape("a\nb")).toBe('"a\nb"');
  });
  it("XLSX: headers, numeric money with a £ format, real dates", async () => {
    const buf = await buildSheetXlsx(toSheetColumns(REG), rows, "Test");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Test")!;
    expect(ws.getRow(1).values).toEqual([undefined, "Alpha", "Beta, with comma", "Gamma"]);
    expect(ws.getCell("B2").value).toBe(1234.5);
    expect(ws.getCell("B2").numFmt).toContain("£");
    expect(ws.getCell("C2").value).toBeInstanceOf(Date);
    expect(ws.rowCount).toBe(3);
  });
});

describe("shared value rules", () => {
  it("num: decimals to numbers, blanks to null", () => {
    expect(num("12.50")).toBe(12.5);
    expect(num(null)).toBe(null);
    expect(num("")).toBe(null);
    expect(num("abc")).toBe(null);
  });
  it("D-10: v2-only values blank on v1", () => {
    expect(v2Only(1, 3)).toBe(null);
    expect(v2Only(2, 3)).toBe(3);
  });
  it("D-9: household counts blank on migrated applications", () => {
    expect(inSystemOnly("GRANT_TRACKER", 2)).toBe(null);
    expect(inSystemOnly(null, 2)).toBe(2);
  });
  it("D-9: parents counted from earner rows", () => {
    expect(parentCount([{ earnerLabel: "PARENT_1" }, { earnerLabel: "PARENT_2" }])).toBe(2);
    expect(parentCount([{ earnerLabel: "PARENT_1" }])).toBe(1);
    expect(parentCount([])).toBe(0);
  });
  it("D-15: siblings flatten to three slots, tolerating bad JSON", () => {
    const s = flattenSiblings([{ name: " Sam ", school: "TRINITY", netPayableFees: "9000" }, "junk"]);
    expect(s[0]).toEqual({ name: "Sam", school: "Trinity", payableFees: 9000 });
    expect(s[1]).toEqual({ name: "", school: "", payableFees: null });
    expect(s[2]).toEqual({ name: "", school: "", payableFees: null });
    expect(flattenSiblings({ not: "an array" })[0].name).toBe("");
  });
  it("postcode first part", () => {
    expect(postcodeOutward("sm4 5ab")).toBe("SM4");
    expect(postcodeOutward(" cr0 ")).toBe("CR0");
    expect(postcodeOutward(null)).toBe("");
  });
  it("D-8 account labels; D-13 submission states", () => {
    expect(accountStateLabel(null)).toBe("No account yet");
    expect(accountStateLabel("CLOSED")).toBe("Closed");
    expect(submissionStatus("CREATED")).toBe("Not yet started");
    expect(submissionStatus("NOT_STARTED")).toBe("Not yet started");
    expect(submissionStatus(null)).toBe("Not yet started");
    expect(submissionStatus("IN_PROGRESS")).toBe("Started");
    expect(submissionStatus("FILLED_IN")).toBe("Started");
    expect(submissionStatus("SUBMITTED")).toBe("Submitted");
  });
  it("code – label lists", () => {
    expect(codeLabels([{ code: 3, label: "Three" }, { code: 10, label: "Ten" }])).toBe("3 – Three, 10 – Ten");
  });
});

describe("field picker", () => {
  it("everything ticked by default", () => {
    expect(Array.from(initialSelection(REG, null))).toEqual(["a", "b", "c"]);
  });
  it("a remembered selection drops removed keys and ticks columns added since", () => {
    // Saved when the registry was a, b, x; the viewer had unticked b.
    const s = initialSelection(REG, ["a", "x"], ["a", "b", "x"]);
    expect(Array.from(s)).toEqual(["a", "c"]);
  });
  it("group toggle: some → all, all → none", () => {
    expect(groupState(["a", "b"], new Set(["a"]))).toBe("some");
    expect(Array.from(toggleGroup(["a", "b"], new Set(["a"])))).toEqual(["a", "b"]);
    expect(Array.from(toggleGroup(["a", "b"], new Set(["a", "b", "c"])))).toEqual(["c"]);
    expect(Array.from(toggleField("a", new Set(["a", "b"])))).toEqual(["b"]);
  });
  it("download link: fields only when not all, in registry order; blank filters dropped", () => {
    expect(buildExportHref("statistical", REG, new Set(["a", "b", "c"]), { school: "TRINITY", roundId: "__all__" }, "xlsx")).toBe(
      "/api/exports/statistical?school=TRINITY&format=xlsx",
    );
    expect(buildExportHref("statistical", REG, new Set(["c", "a"]), { completedFrom: "" }, "csv")).toBe(
      "/api/exports/statistical?fields=a%2Cc&format=csv",
    );
  });
});
