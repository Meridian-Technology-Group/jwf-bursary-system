import { describe, it, expect } from "vitest";
import { dependentElderlySchema } from "@/lib/schemas/dependent-elderly";

const elder = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  firstName: "Elder",
  surname: "Person",
  careHomeName: "Sunnyvale",
  careHomeFees: 12000,
  ...over,
});

const base = {
  hasElderlyAtHome: false,
  elderlyAtHome: [],
  hasElderlyInCare: true,
};

describe("dependentElderlySchema — in-care count matches entries", () => {
  const ok = (blob: unknown) => dependentElderlySchema.safeParse(blob).success;

  it("blocks when fewer in-care entries are added than declared", () => {
    expect(
      ok({ ...base, elderlyInCareCount: 2, elderlyInCare: [elder()] })
    ).toBe(false);
  });

  it("blocks when the count is declared but no entries are added", () => {
    expect(
      ok({ ...base, elderlyInCareCount: 1, elderlyInCare: [] })
    ).toBe(false);
  });

  it("accepts when the number of entries matches the declared count", () => {
    expect(
      ok({ ...base, elderlyInCareCount: 2, elderlyInCare: [elder(), elder()] })
    ).toBe(true);
  });

  it("does not gate when there are no elderly dependants in care", () => {
    expect(
      ok({
        hasElderlyAtHome: false,
        elderlyAtHome: [],
        hasElderlyInCare: false,
        elderlyInCare: [],
      })
    ).toBe(true);
  });
});
