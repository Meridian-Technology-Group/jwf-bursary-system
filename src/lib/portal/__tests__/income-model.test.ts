import { describe, it, expect } from "vitest";
import {
  isLegacyIncomeRecord,
  parentIncomeTotal,
  newIncomeTotal,
  readIncomeItems,
  normaliseLegacyIncomeRecord,
} from "@/lib/portal/income-model";

describe("isLegacyIncomeRecord", () => {
  it("detects the legacy flat shape", () => {
    expect(isLegacyIncomeRecord({ salaryWagesPension: 100 })).toBe(true);
    expect(isLegacyIncomeRecord({ workingTaxCredits: 0 })).toBe(true);
  });
  it("rejects the new status-driven shape", () => {
    expect(isLegacyIncomeRecord({ employed: { annualSalaryPaye: 1 } })).toBe(false);
    expect(isLegacyIncomeRecord({ total: 0, documentsConfirmed: false })).toBe(false);
  });
  it("rejects non-objects", () => {
    expect(isLegacyIncomeRecord(null)).toBe(false);
    expect(isLegacyIncomeRecord("x")).toBe(false);
  });
});

describe("newIncomeTotal", () => {
  it("sums across present sub-blocks", () => {
    expect(
      newIncomeTotal({
        employed: { annualSalaryPaye: 30000 },
        benefits: {
          universalCredit: 1200, housingBenefit: 0, childBenefit: 1000,
          childWorkingTaxCredit: 0, esa: 0, pipOrDla: 0, carersAllowance: 0,
          childcareSupport: 0, other: 0,
        },
        total: 0,
        documentsConfirmed: false,
      })
    ).toBe(32200);
  });
  it("is 0 for an empty record", () => {
    expect(newIncomeTotal({ total: 0, documentsConfirmed: false })).toBe(0);
  });
});

describe("parentIncomeTotal — back-compat (both shapes)", () => {
  it("totals a legacy flat record", () => {
    expect(
      parentIncomeTotal({
        salaryWagesPension: 20000,
        allDividendIncome: 500,
        otherIncome: 100,
      })
    ).toBe(20600);
  });
  it("totals a new record", () => {
    expect(
      parentIncomeTotal({
        selfEmployed: {
          grossSalaried: 10000, propertyIncome: 2000, dividends: 0, otherInvestmentIncome: 0,
        },
        total: 0,
        documentsConfirmed: false,
      })
    ).toBe(12000);
  });
  it("coerces string numbers in legacy drafts", () => {
    expect(parentIncomeTotal({ salaryWagesPension: "15000" })).toBe(15000);
  });
});

describe("readIncomeItems — both shapes", () => {
  it("itemises a legacy record", () => {
    const items = readIncomeItems({ salaryWagesPension: 100 });
    expect(items.find((i) => i.label.includes("Salary"))?.value).toBe(100);
  });
  it("itemises a new record only for present blocks", () => {
    const items = readIncomeItems({
      retired: { statePension: 9000, privatePension: 1000 },
      total: 0,
      documentsConfirmed: false,
    });
    const labels = items.map((i) => i.label);
    expect(labels).toContain("State Pension");
    expect(labels).not.toContain("Employed — annual salary (PAYE)");
  });
  it("uses the H1 review labels for employed and self-employed income", () => {
    const items = readIncomeItems({
      employed: { annualSalaryPaye: 30000 },
      selfEmployed: {
        grossSalaried: 12000, propertyIncome: 0, dividends: 0, otherInvestmentIncome: 0,
      },
      total: 0,
      documentsConfirmed: false,
    });
    expect(items.find((i) => i.label === "Employed — annual salary (PAYE)")?.value).toBe(30000);
    expect(items.find((i) => i.label === "Self-employed — gross earned income")?.value).toBe(12000);
  });
});

describe("normaliseLegacyIncomeRecord", () => {
  it("maps salary into employed, carrying the P60 id", () => {
    const out = normaliseLegacyIncomeRecord({
      salaryWagesPension: 25000,
      p60DocumentId: "p60-1",
    });
    expect(out.employed?.annualSalaryPaye).toBe(25000);
    expect(out.employed?.p60DocumentId).toBe("p60-1");
    expect(out.documentsConfirmed).toBe(false);
  });
  it("maps dividends/rents into self-employed with the SA302 id", () => {
    const out = normaliseLegacyIncomeRecord({
      allDividendIncome: 500,
      grossRentsReceived: 1200,
      selfAssessmentDocumentId: "sa-1",
    });
    expect(out.selfEmployed?.dividends).toBe(500);
    expect(out.selfEmployed?.propertyIncome).toBe(1200);
    expect(out.selfEmployed?.sa302DocumentId).toBe("sa-1");
  });
  it("maps tax credits into benefits and maintenance into divorced/separated", () => {
    const out = normaliseLegacyIncomeRecord({
      workingTaxCredits: 800,
      maintenanceOrEquivalents: 3000,
    });
    expect(out.benefits?.childWorkingTaxCredit).toBe(800);
    expect(out.divorcedSeparated?.maintenanceReceived).toBe(3000);
  });
  it("recomputes total over the mapped blocks", () => {
    const out = normaliseLegacyIncomeRecord({
      salaryWagesPension: 20000,
      allDividendIncome: 500,
    });
    expect(out.total).toBe(20500);
  });
});
