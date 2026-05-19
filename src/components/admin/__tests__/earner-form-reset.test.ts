import { describe, expect, it } from "vitest";

import { resetEarnerFieldsForStatus, type EarnerFormValues } from "../earner-form";

const POPULATED: EarnerFormValues = {
  employmentStatus: "PAYE",
  netPay: 30000,
  netDividends: 5000,
  netSelfEmployedProfit: 12000,
  pensionAmount: 8000,
  benefitsIncluded: 4000,
  benefitsIncludedDetail: "DLA £4,000",
  benefitsExcluded: 1500,
  benefitsExcludedDetail: "Child DLA £1,500",
};

describe("resetEarnerFieldsForStatus", () => {
  it("zeroes every income-bearing field when switching PAYE → UNEMPLOYED", () => {
    const result = resetEarnerFieldsForStatus(POPULATED, "UNEMPLOYED");
    expect(result).toEqual({
      employmentStatus: "UNEMPLOYED",
      netPay: 0,
      netDividends: 0,
      netSelfEmployedProfit: 0,
      pensionAmount: 0,
      benefitsIncluded: 0,
      benefitsIncludedDetail: "",
      benefitsExcluded: 0,
      benefitsExcludedDetail: "",
    });
  });

  it("keeps netPay when staying on PAYE", () => {
    const result = resetEarnerFieldsForStatus(POPULATED, "PAYE");
    expect(result.netPay).toBe(30000);
    expect(result.netDividends).toBe(0);
    expect(result.netSelfEmployedProfit).toBe(0);
    expect(result.pensionAmount).toBe(0);
  });

  it("keeps both netDividends and netSelfEmployedProfit on SELF_EMPLOYED_DIRECTOR", () => {
    const result = resetEarnerFieldsForStatus(POPULATED, "SELF_EMPLOYED_DIRECTOR");
    expect(result.netPay).toBe(0);
    expect(result.netDividends).toBe(5000);
    expect(result.netSelfEmployedProfit).toBe(12000);
    expect(result.pensionAmount).toBe(0);
  });

  it("keeps only netSelfEmployedProfit on SELF_EMPLOYED_SOLE", () => {
    const result = resetEarnerFieldsForStatus(POPULATED, "SELF_EMPLOYED_SOLE");
    expect(result.netPay).toBe(0);
    expect(result.netDividends).toBe(0);
    expect(result.netSelfEmployedProfit).toBe(12000);
    expect(result.pensionAmount).toBe(0);
  });

  it("keeps pensionAmount on OLD_AGE_PENSION and PAST_PENSION", () => {
    const oap = resetEarnerFieldsForStatus(POPULATED, "OLD_AGE_PENSION");
    expect(oap.pensionAmount).toBe(8000);
    expect(oap.netPay).toBe(0);
    expect(oap.netSelfEmployedProfit).toBe(0);

    const past = resetEarnerFieldsForStatus(POPULATED, "PAST_PENSION");
    expect(past.pensionAmount).toBe(8000);
  });

  it("preserves benefits except on UNEMPLOYED", () => {
    const paye = resetEarnerFieldsForStatus(POPULATED, "PAYE");
    expect(paye.benefitsIncluded).toBe(4000);
    expect(paye.benefitsIncludedDetail).toBe("DLA £4,000");
    expect(paye.benefitsExcluded).toBe(1500);
    expect(paye.benefitsExcludedDetail).toBe("Child DLA £1,500");

    const unemp = resetEarnerFieldsForStatus(POPULATED, "UNEMPLOYED");
    expect(unemp.benefitsIncluded).toBe(0);
    expect(unemp.benefitsIncludedDetail).toBe("");
    expect(unemp.benefitsExcluded).toBe(0);
    expect(unemp.benefitsExcludedDetail).toBe("");
  });

  it("BENEFITS status keeps benefits but clears every other income field", () => {
    const result = resetEarnerFieldsForStatus(POPULATED, "BENEFITS");
    expect(result.netPay).toBe(0);
    expect(result.netDividends).toBe(0);
    expect(result.netSelfEmployedProfit).toBe(0);
    expect(result.pensionAmount).toBe(0);
    expect(result.benefitsIncluded).toBe(4000);
    expect(result.benefitsExcluded).toBe(1500);
  });
});
