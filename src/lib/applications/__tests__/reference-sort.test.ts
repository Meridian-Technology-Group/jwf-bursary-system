import { describe, it, expect } from "vitest";
import { compareReferences } from "../reference-sort";

describe("compareReferences — Reference column A–Z", () => {
  it("ignores the spacing that hand-edited references arrive with", () => {
    const refs = ["TS-PARA02-X, A", "TS - ALI04 - ALI, B", "TS-ALI04-ALI, C", "OP-ALI04-ALI, D"];
    expect([...refs].sort(compareReferences)).toEqual([
      "OP-ALI04-ALI, D",
      "TS - ALI04 - ALI, B",
      "TS-ALI04-ALI, C",
      "TS-PARA02-X, A",
    ]);
  });

  it("ignores case and orders digit runs as numbers", () => {
    expect(["TS-ADAM10", "ts-adam01", "TS-ADAM2"].sort(compareReferences)).toEqual([
      "ts-adam01",
      "TS-ADAM2",
      "TS-ADAM10",
    ]);
  });

  it("gives a stable order for references that differ only in spacing", () => {
    expect(compareReferences("TS - ALI04", "TS-ALI04")).not.toBe(0);
    expect(compareReferences("TS - ALI04", "TS-ALI04")).toBe(-compareReferences("TS-ALI04", "TS - ALI04"));
    expect(compareReferences("TS-ALI04", "TS-ALI04")).toBe(0);
  });
});
