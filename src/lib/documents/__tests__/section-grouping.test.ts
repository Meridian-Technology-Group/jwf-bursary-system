// Epic 14 C3 — slot → application-form-section grouping.

import { describe, expect, it } from "vitest";

import {
  groupDocumentsBySection,
  sectionForDocumentSlot,
} from "../section-grouping";

describe("sectionForDocumentSlot", () => {
  it.each([
    ["BIRTH_CERTIFICATE", "CHILD_DETAILS"],
    ["FAMILY_ID_PASSPORT_0", "FAMILY_ID"],
    ["UK_PASSPORT_PARENT_1", "FAMILY_ID"],
    ["PASSPORT_PARENT_2", "FAMILY_ID"],
    ["P45_PARENT_1", "PARENT_DETAILS"],
    ["EMPLOYMENT_REDUNDANCY_PARENT_2", "PARENT_DETAILS"],
    ["P60_PARENT_1", "PARENTS_INCOME"],
    ["MARCH_PAYSLIP_PARENT_2", "PARENTS_INCOME"],
    ["SA302_PARENT_1", "PARENTS_INCOME"],
    ["UC_STATEMENT_PARENT_1", "PARENTS_INCOME"],
    ["UC_MONTHLY_2_PARENT_1", "PARENTS_INCOME"],
    ["HOUSING_BENEFIT_PARENT_1", "PARENTS_INCOME"],
    // The assets-side housing-benefit LETTER must not be swallowed by income.
    ["HOUSING_BENEFIT_LETTER", "ASSETS_LIABILITIES"],
    ["COUNCIL_TAX", "ASSETS_LIABILITIES"],
    ["BANK_STATEMENT_CURRENT_PARENT_1", "ASSETS_LIABILITIES"],
    ["LOAN_AGREEMENT", "ASSETS_LIABILITIES"],
    ["CAR_LEASE_AGREEMENT", "ASSETS_LIABILITIES"],
    ["MAINTENANCE_DECREE_ABSOLUTE", "OTHER_INFO"],
    ["COURT_ORDER", "OTHER_INFO"],
    ["INSURANCE_POLICY", "OTHER_INFO"],
    ["ADDITIONAL_DOCUMENT", "ADDITIONAL_INFO"],
  ] as const)("%s → %s", (slot, section) => {
    expect(sectionForDocumentSlot(slot)).toBe(section);
  });

  it("returns null for an unknown slot (renders under Other documents)", () => {
    expect(sectionForDocumentSlot("SOMETHING_NEW")).toBeNull();
  });
});

describe("groupDocumentsBySection", () => {
  it("buckets documents and never drops the unmatched", () => {
    const docs = [
      { id: "1", slot: "P60_PARENT_1", filename: "p60.pdf" },
      { id: "2", slot: "COUNCIL_TAX", filename: "ct.pdf" },
      { id: "3", slot: "MYSTERY_SLOT", filename: "x.pdf" },
    ];
    const { bySection, other } = groupDocumentsBySection(docs);
    expect(bySection.get("PARENTS_INCOME")?.map((d) => d.id)).toEqual(["1"]);
    expect(bySection.get("ASSETS_LIABILITIES")?.map((d) => d.id)).toEqual(["2"]);
    expect(other.map((d) => d.id)).toEqual(["3"]);
  });
});
