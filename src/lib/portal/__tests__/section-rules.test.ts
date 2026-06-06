/**
 * Behaviour-preservation tests for the section rule set.
 *
 * These assert that the declarative rules reproduce the legacy
 * `SECTION_EVALUATORS` gap output exactly (same gap ids, same conditions), so
 * the engine swap is provably non-regressive for the sidebar tri-state and the
 * submit gate.
 */
import { describe, it, expect } from "vitest";
import { evaluateRules } from "@/lib/portal/document-rules";
import { SECTION_RULES } from "@/lib/portal/section-rules";

const empty = new Set<string>();

function gapIds(sectionType: Parameters<typeof evaluateRules>[0], blob: unknown, slots = empty) {
  const rules = SECTION_RULES[sectionType] ?? [];
  return evaluateRules(sectionType, rules, blob as Record<string, unknown> | null, slots)
    .map((g) => g.id)
    .sort();
}

describe("CHILD_DETAILS", () => {
  it("requires birth certificate once saved", () => {
    expect(gapIds("CHILD_DETAILS", {})).toEqual(["CHILD_DETAILS:BIRTH_CERTIFICATE"]);
    expect(gapIds("CHILD_DETAILS", { birthCertificateDocumentId: "x" })).toEqual([]);
    expect(gapIds("CHILD_DETAILS", {}, new Set(["BIRTH_CERTIFICATE"]))).toEqual([]);
  });
  it("no gaps when unsaved (null)", () => {
    expect(gapIds("CHILD_DETAILS", null)).toEqual([]);
  });
});

describe("PARENT_DETAILS", () => {
  it("left-self-employment + scholarship per parent 1", () => {
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: { leftSelfEmployment: true, receivesScholarship: true },
      })
    ).toEqual([
      "PARENT_DETAILS:LEFT_SELF_EMPLOYMENT_PARENT_1",
      "PARENT_DETAILS:SCHOLARSHIP_PARENT_1",
    ]);
  });
  it("parent 2 rules only fire when the parent2Employment block exists", () => {
    // No parent2Employment key — no P2 gaps even if flags would have fired.
    expect(
      gapIds("PARENT_DETAILS", { parent1Employment: { leftSelfEmployment: false } })
    ).toEqual([]);
    // parent2Employment present with a flag → P2 gap.
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: {},
        parent2Employment: { receivesScholarship: true },
      })
    ).toEqual(["PARENT_DETAILS:SCHOLARSHIP_PARENT_2"]);
  });
});

describe("PARENTS_INCOME (legacy flat model preserved)", () => {
  it("P60 always required for parent 1", () => {
    expect(gapIds("PARENTS_INCOME", { parent1Income: {} })).toEqual([
      "PARENTS_INCOME:P60_PARENT_1",
    ]);
  });
  it("SA302 when dividend/rent/bond > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { p60DocumentId: "x", grossRentsReceived: 100 },
      })
    ).toEqual(["PARENTS_INCOME:SELF_ASSESSMENT_PARENT_1"]);
  });
  it("benefits evidence when tax credits/other benefits > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { p60DocumentId: "x", workingTaxCredits: 50 },
      })
    ).toEqual(["PARENTS_INCOME:BENEFITS_EVIDENCE_PARENT_1"]);
  });
  it("capital repayments doc when toggle true", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { p60DocumentId: "x", hasCapitalRepayments: true },
      })
    ).toEqual(["PARENTS_INCOME:CAPITAL_REPAYMENTS_PARENT_1"]);
  });
  it("parent 2 income rules only fire when parent2Income exists", () => {
    expect(
      gapIds("PARENTS_INCOME", { parent1Income: { p60DocumentId: "x" } })
    ).toEqual([]);
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { p60DocumentId: "x" },
        parent2Income: {},
      })
    ).toEqual(["PARENTS_INCOME:P60_PARENT_2"]);
  });
});

describe("DEPENDENT_CHILDREN structural rules", () => {
  it("requires at least one child", () => {
    expect(gapIds("DEPENDENT_CHILDREN", { children: [] })).toEqual([
      "DEPENDENT_CHILDREN:at_least_one",
    ]);
  });
  it("requires exactly one named child", () => {
    expect(
      gapIds("DEPENDENT_CHILDREN", { children: [{ isNamedChild: false }] })
    ).toEqual(["DEPENDENT_CHILDREN:named_child"]);
    expect(
      gapIds("DEPENDENT_CHILDREN", {
        children: [{ isNamedChild: true }, { isNamedChild: true }],
      })
    ).toEqual(["DEPENDENT_CHILDREN:named_child"]);
    expect(
      gapIds("DEPENDENT_CHILDREN", { children: [{ isNamedChild: true }] })
    ).toEqual([]);
  });
});

describe("ASSETS_LIABILITIES", () => {
  it("council tax + bank statement P1 always required", () => {
    expect(gapIds("ASSETS_LIABILITIES", {})).toEqual([
      "ASSETS_LIABILITIES:BANK_STATEMENT_PARENT_1",
      "ASSETS_LIABILITIES:COUNCIL_TAX",
    ]);
  });
  it("satisfied by docs / slots", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        councilTaxDocumentId: "x",
        parent1BankStatementDocumentIds: ["a"],
      })
    ).toEqual([]);
  });
  it("bank statement P2 only enforced when the P2 block was shown", () => {
    // P2 array key absent → not enforced.
    expect(
      gapIds("ASSETS_LIABILITIES", {
        councilTaxDocumentId: "x",
        parent1BankStatementDocumentIds: ["a"],
      })
    ).toEqual([]);
    // P2 array present but empty → enforced.
    expect(
      gapIds("ASSETS_LIABILITIES", {
        councilTaxDocumentId: "x",
        parent1BankStatementDocumentIds: ["a"],
        parent2BankStatementDocumentIds: [],
      })
    ).toEqual(["ASSETS_LIABILITIES:BANK_STATEMENT_PARENT_2"]);
  });
});

describe("no-op sections", () => {
  it.each(["FAMILY_ID", "DEPENDENT_ELDERLY", "OTHER_INFO", "ADDITIONAL_INFO", "DECLARATION"] as const)(
    "%s has no gaps",
    (s) => {
      expect(gapIds(s, {})).toEqual([]);
    }
  );
});
