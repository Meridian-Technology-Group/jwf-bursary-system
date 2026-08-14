import { describe, it, expect } from "vitest";
import { buildCsvString } from "../xlsx";
import { mapExportRow, type ExportRowSource } from "@/lib/db/queries/exports";

/**
 * C4a / D13-1a — the export must stay usable now that `Application.reference`
 * is a free-text, non-unique label.
 *
 * Two things are pinned here: the child's name travels beside the reference
 * (the reference alone no longer identifies the row once it has been re-edited
 * to the fees-system code), and duplicate references are exported as distinct
 * rows rather than being collapsed or dropped.
 *
 * `buildCsvString` and `buildXlsxBuffer` share one `COLUMNS` definition, so
 * asserting on the CSV covers the XLSX header/ordering too — without pulling
 * ExcelJS into the test.
 */

function source(overrides: Partial<ExportRowSource> = {}): ExportRowSource {
  return {
    reference: "Bob Smith – Trinity School – Year 6 – 2027-28",
    childName: "Bob Smith",
    school: "TRINITY",
    assessment: {
      outcome: "AWARDED",
      synopsis: "A synopsis.",
      debtStatusLabel: null,
      lifestyleSqueezeLabel: null,
      recommendation: {
        familySynopsis: "A family synopsis.",
        accommodationStatus: "Renting",
        incomeCategory: "3",
        propertyCategory: 1,
        bursaryAward: 12000,
        yearlyPayableFees: 8000,
        monthlyPayableFees: 666.67,
        dishonestyFlag: false,
        creditRiskFlag: false,
        recommendedPayableFees: null,
        confirmedPayableFees: null,
        gapAmount: null,
        reasonCodes: [],
        gapReasons: [],
      },
    },
    ...overrides,
  };
}

describe("export columns (D13-1a)", () => {
  it("puts the child's name immediately after the reference", () => {
    const [header] = buildCsvString([mapExportRow(source())]).split("\r\n");
    expect(header.startsWith("Reference,Child First Name,Child Last Name,School")).toBe(
      true
    );
  });

  it("carries the child's split name in the data row", () => {
    const [, row] = buildCsvString([mapExportRow(source())]).split("\r\n");
    expect(row).toContain("Bob,Smith,TRINITY");
  });

  it("quotes a fees-system reference containing a comma, keeping columns aligned", () => {
    const csv = buildCsvString([
      mapExportRow(source({ reference: "TS-SMITH05-Smith, Bob" })),
    ]);
    const [, row] = csv.split("\r\n");
    expect(row.startsWith('"TS-SMITH05-Smith, Bob",Bob,Smith,TRINITY')).toBe(true);
  });

  it("exports two applications sharing one reference as two distinct rows", () => {
    const shared = "TS-SMITH05-Smith, Bob";
    const csv = buildCsvString([
      mapExportRow(source({ reference: shared, childName: "Bob Smith" })),
      mapExportRow(source({ reference: shared, childName: "Beth Smith" })),
    ]);
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain("Bob,Smith");
    expect(lines[2]).toContain("Beth,Smith");
  });
});
