import { describe, it, expect } from "vitest";
import {
  assessorIncomeRecordSchema,
  propertyAssetsRecordSchema,
  debtsRecordSchema,
} from "@/lib/schemas/assessment-v2";

describe("assessorIncomeRecordSchema (CALC-02)", () => {
  it("accepts an empty record (every field optional)", () => {
    expect(assessorIncomeRecordSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial record with a single sub-block", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      employed: { annualSalaryPaye: 45000 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a negative numeric cell inside a sub-block", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      employed: { annualSalaryPaye: -100 },
    });
    expect(r.success).toBe(false);
  });

  it("accepts the assessor-only newSpouseIncomePortion extra", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      divorcedSeparated: {
        maintenanceReceived: 6000,
        sharedCustodyNote: "50/50",
        newSpouseIncomePortion: 12000,
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a negative newSpouseIncomePortion", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      divorcedSeparated: { newSpouseIncomePortion: -1 },
    });
    expect(r.success).toBe(false);
  });

  it("accepts the assessor-only numberOfKidsDivisor extra", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      thirdParty: { incomeSupportReceived: 3000, numberOfKidsDivisor: 2 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a numberOfKidsDivisor of 0 (must be positive)", () => {
    const r = assessorIncomeRecordSchema.safeParse({
      thirdParty: { numberOfKidsDivisor: 0 },
    });
    expect(r.success).toBe(false);
  });
});

describe("propertyAssetsRecordSchema (CALC-02)", () => {
  it("accepts an empty record", () => {
    expect(propertyAssetsRecordSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial record with just the home property", () => {
    const r = propertyAssetsRecordSchema.safeParse({
      home: { value: 550000, mortgageBalance: 210000 },
    });
    expect(r.success).toBe(true);
  });

  it("accepts second/other independently", () => {
    const r = propertyAssetsRecordSchema.safeParse({
      second: { value: 300000 },
      other: { mortgageBalance: 50000 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a negative property value", () => {
    const r = propertyAssetsRecordSchema.safeParse({ home: { value: -1 } });
    expect(r.success).toBe(false);
  });

  it("rejects a negative mortgage balance", () => {
    const r = propertyAssetsRecordSchema.safeParse({
      home: { mortgageBalance: -1 },
    });
    expect(r.success).toBe(false);
  });
});

describe("debtsRecordSchema (CALC-02)", () => {
  it("accepts an empty record", () => {
    expect(debtsRecordSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial record with one cell", () => {
    expect(debtsRecordSchema.safeParse({ creditCards: 2500 }).success).toBe(true);
  });

  it("accepts all four cells", () => {
    const r = debtsRecordSchema.safeParse({
      creditCards: 1000,
      loans: 5000,
      leaseBalances: 2000,
      schoolFeesOwedOrOther: 3000,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a negative value on any cell", () => {
    expect(debtsRecordSchema.safeParse({ creditCards: -1 }).success).toBe(false);
    expect(debtsRecordSchema.safeParse({ loans: -1 }).success).toBe(false);
    expect(debtsRecordSchema.safeParse({ leaseBalances: -1 }).success).toBe(false);
    expect(
      debtsRecordSchema.safeParse({ schoolFeesOwedOrOther: -1 }).success
    ).toBe(false);
  });
});
