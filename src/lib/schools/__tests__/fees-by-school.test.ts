import { describe, expect, it } from "vitest";
import { feesBySchool } from "..";

const table = {
  TRINITY: { currentYearAnnualFees: 24000, nextYearAnnualFees: 25000 },
  WHITGIFT: { currentYearAnnualFees: 26000, nextYearAnnualFees: null },
};

describe("feesBySchool (S9)", () => {
  it("reads the Settings fee table for Trinity and Whitgift; OP has none", () => {
    const out = feesBySchool(table, null);
    expect(out.TRINITY).toEqual({ annual: 24000, nextYear: 25000 });
    expect(out.WHITGIFT).toEqual({ annual: 26000, nextYear: null });
    expect(out.OP_PARTNER).toEqual({ annual: null, nextYear: null });
  });

  it("an OP account's own fee fills its school, with no next-year figure", () => {
    const out = feesBySchool(table, { school: "OP_PARTNER", annualFeesOverride: 17350.5 });
    expect(out.OP_PARTNER).toEqual({ annual: 17350.5, nextYear: null });
    expect(out.WHITGIFT.annual).toBe(26000);
  });

  it("no override leaves the table alone", () => {
    const out = feesBySchool(table, { school: "WHITGIFT", annualFeesOverride: null });
    expect(out.WHITGIFT).toEqual({ annual: 26000, nextYear: null });
  });
});
