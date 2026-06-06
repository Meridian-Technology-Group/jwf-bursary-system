import { describe, it, expect } from "vitest";
import { buildOptionScenarios } from "../recommendation-options";
import { calculatePayableFees } from "../payable-fees";

const base = {
  grossFees: 30000,
  scholarshipPct: 0,
  bursaryAward: 10000,
  vatRate: 20,
  manualAdjustment: 0,
  hasSiblings: false,
};

describe("buildOptionScenarios (Epic 08)", () => {
  it("always emits a bursary-only scenario", () => {
    const s = buildOptionScenarios(base);
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe("bursary");
  });

  it("emits the bursary+scholarship scenario only when scholarshipPct > 0", () => {
    expect(buildOptionScenarios({ ...base, scholarshipPct: 0 })).toHaveLength(1);
    const withPct = buildOptionScenarios({ ...base, scholarshipPct: 25 });
    expect(withPct.map((x) => x.key)).toContain("bursary_scholarship");
  });

  it("emits with/without sibling rows when siblings exist and a standalone is known", () => {
    const s = buildOptionScenarios({
      ...base,
      hasSiblings: true,
      standaloneBursaryAward: 4000,
    });
    const keys = s.map((x) => x.key);
    expect(keys).toContain("with_siblings");
    expect(keys).toContain("without_siblings");
  });

  it("omits the without-siblings row when no standalone bursary is supplied", () => {
    const s = buildOptionScenarios({
      ...base,
      hasSiblings: true,
      standaloneBursaryAward: null,
    });
    expect(s.map((x) => x.key)).not.toContain("without_siblings");
    expect(s.map((x) => x.key)).toContain("with_siblings");
  });

  it("never double-applies a deduction: each scenario equals a single engine call", () => {
    const s = buildOptionScenarios({ ...base, scholarshipPct: 30 });
    const scholarshipScenario = s.find((x) => x.key === "bursary_scholarship")!;
    const single = calculatePayableFees(30000, 30, 10000, 20, 0);
    expect(scholarshipScenario.yearlyPayableFees).toBe(
      single.adjustedYearlyPayableFees
    );
    expect(scholarshipScenario.monthlyPayableFees).toBe(
      single.adjustedMonthlyPayableFees
    );
  });
});
