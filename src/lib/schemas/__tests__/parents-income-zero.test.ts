import { describe, it, expect } from "vitest";
import { parentsIncomeSchema } from "@/lib/schemas/parents-income";

/**
 * The £0 prompter: when a parent's total income is £0, the applicant must
 * explicitly tick `noIncomeConfirmed` — a £0 return has to be a deliberate
 * declaration, not an accidental empty submission. A non-zero total needs no
 * such acknowledgment.
 */
describe("parentsIncomeSchema — £0 income confirmation", () => {
  const base = { documentsConfirmed: true };

  const issuePaths = (blob: unknown) => {
    const r = parentsIncomeSchema.safeParse(blob);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("blocks a £0 total that is not explicitly confirmed", () => {
    expect(issuePaths({ parent1Income: { ...base } })).toContain(
      "parent1Income.noIncomeConfirmed"
    );
  });

  it("accepts a £0 total once explicitly confirmed", () => {
    expect(
      issuePaths({ parent1Income: { ...base, noIncomeConfirmed: true } })
    ).toEqual([]);
  });

  it("does not require the confirmation when income is declared", () => {
    expect(
      issuePaths({
        parent1Income: { ...base, employed: { annualSalaryPaye: 30000 } },
      })
    ).toEqual([]);
  });

  it("requires the confirmation independently for parent 2", () => {
    expect(
      issuePaths({
        parent1Income: { ...base, employed: { annualSalaryPaye: 30000 } },
        parent2Income: { ...base },
      })
    ).toContain("parent2Income.noIncomeConfirmed");
  });
});
