import { describe, it, expect } from "vitest";
import {
  evaluateRules,
  resolvePath,
  applicableRuleCount,
  sectionItemTotal,
  type DocumentRule,
} from "@/lib/portal/document-rules";

const empty = new Set<string>();

describe("resolvePath", () => {
  it("resolves nested dot paths", () => {
    const blob = { a: { b: { c: 5 } } };
    expect(resolvePath(blob, "a.b.c")).toBe(5);
  });
  it("returns undefined for missing paths or null blob", () => {
    expect(resolvePath({ a: 1 }, "a.b.c")).toBeUndefined();
    expect(resolvePath(null, "a")).toBeUndefined();
  });
});

describe("evaluateRules — null blob", () => {
  it("returns no gaps when the section is unsaved", () => {
    const rules: DocumentRule[] = [
      { kind: "requiredAlways", id: "X", label: "x", doc: { docIdPath: "d", slot: "S" } },
    ];
    expect(evaluateRules("CHILD_DETAILS", rules, null, empty)).toEqual([]);
  });
});

describe("evaluateRules — requiredAlways", () => {
  const rule: DocumentRule = {
    kind: "requiredAlways",
    id: "DOC",
    label: "Doc required",
    doc: { docIdPath: "docId", slot: "SLOT" },
  };
  it("gaps when neither id nor slot present", () => {
    const gaps = evaluateRules("CHILD_DETAILS", [rule], {}, empty);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].id).toBe("CHILD_DETAILS:DOC");
    expect(gaps[0].severity).toBe("error");
  });
  it("satisfied by a doc id on the blob", () => {
    expect(
      evaluateRules("CHILD_DETAILS", [rule], { docId: "abc" }, empty)
    ).toEqual([]);
  });
  it("satisfied by an uploaded slot", () => {
    expect(
      evaluateRules("CHILD_DETAILS", [rule], {}, new Set(["SLOT"]))
    ).toEqual([]);
  });
});

describe("evaluateRules — requiredIfValueGt0", () => {
  const rule: DocumentRule = {
    kind: "requiredIfValueGt0",
    id: "SA",
    label: "SA302 required",
    valuePaths: ["a", "b"],
    doc: { docIdPath: "saId", slot: "SA_SLOT" },
  };
  it("no gap when all values are 0", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { a: 0, b: 0 }, empty)).toEqual([]);
  });
  it("gaps when any value > 0 and no doc", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { a: 0, b: 5 }, empty)).toHaveLength(1);
  });
  it("coerces string numbers", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { a: "10", b: 0 }, empty)).toHaveLength(1);
  });
  it("no gap when value > 0 but doc present", () => {
    expect(
      evaluateRules("PARENTS_INCOME", [rule], { a: 5, saId: "x" }, empty)
    ).toEqual([]);
  });
});

describe("evaluateRules — requiredIfTrue", () => {
  const rule: DocumentRule = {
    kind: "requiredIfTrue",
    id: "CAP",
    label: "cap required",
    truePath: "flag",
    doc: { docIdPath: "capId", slot: "CAP_SLOT" },
  };
  it("gaps only when flag is strictly true and no doc", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { flag: false }, empty)).toEqual([]);
    expect(evaluateRules("PARENTS_INCOME", [rule], { flag: true }, empty)).toHaveLength(1);
    expect(evaluateRules("PARENTS_INCOME", [rule], { flag: true, capId: "x" }, empty)).toEqual([]);
  });
});

describe("evaluateRules — requiredOneOf (P60 or payslip)", () => {
  const rule: DocumentRule = {
    kind: "requiredOneOf",
    id: "P60_OR_PAYSLIP",
    label: "P60 or March payslip required",
    docs: [
      { docIdPath: "p60Id", slot: "P60" },
      { docIdPath: "payslipId", slot: "PAYSLIP" },
    ],
  };
  it("gaps when neither present", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], {}, empty)).toHaveLength(1);
  });
  it("satisfied by either one", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { p60Id: "x" }, empty)).toEqual([]);
    expect(evaluateRules("PARENTS_INCOME", [rule], {}, new Set(["PAYSLIP"]))).toEqual([]);
  });
  it("respects a value gate — not enforced when gate is 0", () => {
    const gated: DocumentRule = { ...rule, gateValuePaths: ["salary"] };
    expect(evaluateRules("PARENTS_INCOME", [gated], { salary: 0 }, empty)).toEqual([]);
    expect(evaluateRules("PARENTS_INCOME", [gated], { salary: 100 }, empty)).toHaveLength(1);
  });
});

describe("evaluateRules — onlyIfExistsPath gate", () => {
  const rule: DocumentRule = {
    kind: "requiredAlways",
    id: "P60_P2",
    label: "P60 P2 required",
    onlyIfExistsPath: "parent2Income",
    doc: { docIdPath: "parent2Income.p60Id", slot: "P60_P2" },
  };
  it("is skipped entirely when the gated block is absent", () => {
    expect(evaluateRules("PARENTS_INCOME", [rule], { parent1Income: {} }, empty)).toEqual([]);
  });
  it("is enforced when the gated block exists", () => {
    expect(
      evaluateRules("PARENTS_INCOME", [rule], { parent2Income: {} }, empty)
    ).toHaveLength(1);
  });
});

describe("evaluateRules — arrayForEach", () => {
  const rule: DocumentRule = {
    kind: "arrayForEach",
    id: "INVOICE",
    label: "invoices",
    arrayPath: "items",
    elementDoc: { docIdPath: "docId", slotPrefix: "INVOICE_" },
    elementGate: (el) => Number(el.amount ?? 0) > 0,
    elementLabel: (i) => `invoice ${i} required`,
  };
  it("adds one gap per gated element missing its doc", () => {
    const gaps = evaluateRules(
      "DEPENDENT_ELDERLY",
      [rule],
      { items: [{ amount: 100 }, { amount: 0 }, { amount: 50, docId: "x" }] },
      empty
    );
    expect(gaps.map((g) => g.id)).toEqual(["DEPENDENT_ELDERLY:INVOICE_0"]);
  });
  it("satisfied per element via slot index", () => {
    const gaps = evaluateRules(
      "DEPENDENT_ELDERLY",
      [rule],
      { items: [{ amount: 100 }] },
      new Set(["INVOICE_0"])
    );
    expect(gaps).toEqual([]);
  });
  it("no gaps when the array is absent or empty", () => {
    expect(evaluateRules("DEPENDENT_ELDERLY", [rule], {}, empty)).toEqual([]);
    expect(evaluateRules("DEPENDENT_ELDERLY", [rule], { items: [] }, empty)).toEqual([]);
  });
});

describe("evaluateRules — array doc presence", () => {
  const rule: DocumentRule = {
    kind: "requiredAlways",
    id: "BANK",
    label: "bank required",
    doc: { docIdPath: "bankIds", slot: "BANK" },
  };
  it("satisfied by a non-empty string array", () => {
    expect(evaluateRules("ASSETS_LIABILITIES", [rule], { bankIds: ["a"] }, empty)).toEqual([]);
  });
  it("gaps on an empty array", () => {
    expect(evaluateRules("ASSETS_LIABILITIES", [rule], { bankIds: [] }, empty)).toHaveLength(1);
  });
});

describe("structural rules receive uploaded slots", () => {
  const rule: DocumentRule = {
    kind: "structural",
    id: "BANK1",
    label: "bank 1",
    predicate: (blob, slots) =>
      (Array.isArray(blob.ids) && blob.ids.length > 0) || slots.has("BANK_1"),
  };
  it("satisfied via slot", () => {
    expect(evaluateRules("ASSETS_LIABILITIES", [rule], {}, new Set(["BANK_1"]))).toEqual([]);
  });
  it("gaps when neither", () => {
    expect(evaluateRules("ASSETS_LIABILITIES", [rule], {}, empty)).toHaveLength(1);
  });
});

describe("progress denominator helpers", () => {
  const rules: DocumentRule[] = [
    { kind: "requiredAlways", id: "A", label: "a", doc: { docIdPath: "a", slot: "A" } },
    {
      kind: "requiredAlways",
      id: "B",
      label: "b",
      onlyIfExistsPath: "p2",
      doc: { docIdPath: "p2.b", slot: "B" },
    },
  ];
  it("applicableRuleCount drops gated-absent rules", () => {
    expect(applicableRuleCount(rules, { p1: {} })).toBe(1);
    expect(applicableRuleCount(rules, { p2: {} })).toBe(2);
    expect(applicableRuleCount(rules, null)).toBe(2);
  });
  it("sectionItemTotal = 1 + applicable rules", () => {
    expect(sectionItemTotal(rules, { p1: {} })).toBe(2);
    expect(sectionItemTotal(rules, { p2: {} })).toBe(3);
  });
});
