import { describe, it, expect } from "vitest";
import {
  ALL_FIELDS_KEY,
  SECTION_FIELD_GROUPS,
  UNGROUPED_GROUP_KEY,
  groupForDocumentSlot,
  groupSectionFields,
  sectionGroupKeys,
  suppressedFields,
} from "@/lib/admin/section-field-groups";
import { assetsLiabilitiesSchema } from "@/lib/schemas/assets-liabilities";
import { ALL_DOCUMENT_SLOTS } from "@/lib/documents/slots";
import { sectionForDocumentSlot } from "@/lib/documents/section-grouping";

/**
 * CH-62 — *"Right now the data is thrown out in an arbitrary way."*
 *
 * Two failure modes are worse than the disorder they replace, and both are
 * pinned here:
 *
 *  1. **A key silently missing from every group.** The cross-check below
 *     enumerates `assetsLiabilitiesSchema` and asserts the group specs plus the
 *     trailing bucket cover all 46 keys. Add a field to the schema without
 *     grouping it and this test says so.
 *  2. **A field hidden by a wrong branch guard** — data the assessor never
 *     sees. Suppression fires only on the two explicit `propertyOwnership`
 *     values; `undefined` suppresses nothing.
 */

const SCHEMA_KEYS = Object.keys(assetsLiabilitiesSchema.shape);

/** Her group order, from the 26 Aug email. */
const HER_GROUP_ORDER = [
  "property",
  "car",
  "councilTax",
  "financial",
  "debt",
];

/** An owning household with three properties, one of each debt kind. */
function owningHousehold(): Record<string, unknown> {
  return {
    propertyOwnership: "OWN",
    residenceValue: 450_000,
    hasMortgage: true,
    mortgageBalance: 210_000,
    monthlyMortgageRepayment: 1_150,
    hasOtherProperties: true,
    otherProperties: [
      { id: "p1", address: "1 A St", postcode: "CR0 1AA", value: 200_000 },
      { id: "p2", address: "2 B St", postcode: "CR0 2BB", value: 300_000 },
      { id: "p3", address: "3 C St", postcode: "CR0 3CC", value: 150_000 },
    ],
    hasChargingOrder: false,
    councilTaxDocumentId: "doc-ct",
    carOwnership: "OWN",
    carValue: 8_000,
    usesPublicTransport: true,
    publicTransportMonthly: 120,
    otherPossessionsValue: 5_000,
    totalCashBalance: 3_000,
    investmentsValue: 0,
    hasPersonalDebt: true,
    creditCardBalance: 1_200,
    bankOverdraft: 0,
    schoolFeesOwed: 0,
    documentsConfirmed: true,
  };
}

describe("groupSectionFields — grouped section (ASSETS_LIABILITIES)", () => {
  it("renders her five groups in her order", () => {
    const groups = groupSectionFields("ASSETS_LIABILITIES", owningHousehold());
    expect(groups.map((g) => g.key)).toEqual([
      ...HER_GROUP_ORDER,
      UNGROUPED_GROUP_KEY,
    ]);
  });

  it("puts each group's fields in portal-form order", () => {
    const groups = groupSectionFields("ASSETS_LIABILITIES", owningHousehold());
    const property = groups.find((g) => g.key === "property");
    expect(property?.entries.map(([k]) => k)).toEqual([
      "propertyOwnership",
      "residenceValue",
      "hasMortgage",
      "mortgageBalance",
      "monthlyMortgageRepayment",
      "hasOtherProperties",
      "otherProperties",
      "hasChargingOrder",
    ]);
  });

  it("carries all three properties through as one entry for the repeater", () => {
    const groups = groupSectionFields("ASSETS_LIABILITIES", owningHousehold());
    const property = groups.find((g) => g.key === "property");
    const otherProperties = property?.entries.find(
      ([k]) => k === "otherProperties"
    )?.[1];
    expect(Array.isArray(otherProperties)).toBe(true);
    expect(otherProperties as unknown[]).toHaveLength(3);
  });

  it("drops nothing — every input entry appears in exactly one group", () => {
    const data = owningHousehold();
    const groups = groupSectionFields("ASSETS_LIABILITIES", data);
    const emitted = groups.flatMap((g) => g.entries.map(([k]) => k));
    expect(emitted.slice().sort()).toEqual(Object.keys(data).sort());
    expect(new Set(emitted).size).toBe(emitted.length);
  });

  it("sends an unrecognised key to the trailing bucket rather than nowhere", () => {
    const data = { ...owningHousehold(), someFutureField: "keep me" };
    const groups = groupSectionFields("ASSETS_LIABILITIES", data);
    const other = groups.find((g) => g.key === UNGROUPED_GROUP_KEY);
    expect(other?.entries.map(([k]) => k)).toContain("someFutureField");
    expect(other?.entries).toContainEqual(["someFutureField", "keep me"]);
  });

  it("omits a group with no data of its own", () => {
    const groups = groupSectionFields("ASSETS_LIABILITIES", {
      propertyOwnership: "OWN",
    });
    expect(groups.map((g) => g.key)).toEqual(["property"]);
  });

  it("survives a null blob rather than throwing (CH-57's class)", () => {
    expect(() =>
      groupSectionFields(
        "ASSETS_LIABILITIES",
        null as unknown as Record<string, unknown>
      )
    ).not.toThrow();
    expect(
      groupSectionFields(
        "ASSETS_LIABILITIES",
        null as unknown as Record<string, unknown>
      )
    ).toEqual([]);
  });
});

describe("groupSectionFields — the branch guard", () => {
  const mortgageFields = [
    "hasMortgage",
    "mortgageBalance",
    "monthlyMortgageRepayment",
  ];
  const rentFields = ["rentAgreementType", "monthlyRent"];

  /** A blob carrying BOTH branches' values — the stale-branch case. */
  function bothBranches(
    ownership: string | undefined
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      residenceValue: 400_000,
      hasMortgage: true,
      mortgageBalance: 100_000,
      monthlyMortgageRepayment: 900,
      rentAgreementType: "PRIVATE",
      monthlyRent: 1_400,
    };
    if (ownership !== undefined) data.propertyOwnership = ownership;
    return data;
  }

  function renderedKeys(data: Record<string, unknown>): string[] {
    return groupSectionFields("ASSETS_LIABILITIES", data).flatMap((g) =>
      g.entries.map(([k]) => k)
    );
  }

  it("a renting household shows rent fields and no mortgage fields", () => {
    const keys = renderedKeys(bothBranches("RENT"));
    for (const f of rentFields) expect(keys).toContain(f);
    for (const f of mortgageFields) expect(keys).not.toContain(f);
  });

  it("an owning household shows mortgage fields and no rent fields", () => {
    const keys = renderedKeys(bothBranches("OWN"));
    for (const f of mortgageFields) expect(keys).toContain(f);
    for (const f of rentFields) expect(keys).not.toContain(f);
  });

  it("an UNANSWERED ownership question suppresses nothing", () => {
    // The dangerous direction: a hidden field is data the assessor never sees.
    const keys = renderedKeys(bothBranches(undefined));
    for (const f of [...mortgageFields, ...rentFields]) {
      expect(keys, `field "${f}"`).toContain(f);
    }
  });

  it("an unrecognised ownership value suppresses nothing either", () => {
    const keys = renderedKeys(bothBranches("SOMETHING_ELSE"));
    for (const f of [...mortgageFields, ...rentFields]) {
      expect(keys, `field "${f}"`).toContain(f);
    }
  });

  it("never suppresses on a section that has no branch", () => {
    expect(suppressedFields("PARENT_DETAILS", { propertyOwnership: "RENT" }))
      .toEqual([]);
  });

  it("leaves a nested property's own mortgageBalance alone", () => {
    // Suppression is top-level only — `otherProperties[].mortgageBalance` is a
    // different field that happens to share a name.
    const groups = groupSectionFields("ASSETS_LIABILITIES", {
      propertyOwnership: "RENT",
      monthlyRent: 1_400,
      hasOtherProperties: true,
      otherProperties: [{ id: "p1", mortgageBalance: 50_000 }],
    });
    const property = groups.find((g) => g.key === "property");
    const props = property?.entries.find(([k]) => k === "otherProperties")?.[1];
    expect((props as Record<string, unknown>[])[0].mortgageBalance).toBe(50_000);
  });
});

describe("groupSectionFields — sections with no grouping", () => {
  it("returns one headingless result holding every entry", () => {
    const data = { title: "MRS", city: "Croydon" };
    const groups = groupSectionFields("PARENT_DETAILS", data);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe(ALL_FIELDS_KEY);
    expect(groups[0].label).toBeNull();
    expect(groups[0].entries).toEqual(Object.entries(data));
  });

  it("does not reorder an ungrouped section", () => {
    const data = { z: 1, a: 2, m: 3 };
    expect(
      groupSectionFields("CHILD_DETAILS", data)[0].entries.map(([k]) => k)
    ).toEqual(["z", "a", "m"]);
  });
});

describe("the cross-check — no schema key may be missing from every group", () => {
  it("the schema has the 46 keys these specs were written against", () => {
    expect(SCHEMA_KEYS).toHaveLength(46);
  });

  it("every schema key lands in exactly one group or the trailing bucket", () => {
    const groups = SECTION_FIELD_GROUPS.ASSETS_LIABILITIES ?? [];
    for (const key of SCHEMA_KEYS) {
      const owners = groups.filter((g) => g.fields.indexOf(key) !== -1);
      expect(owners.length, `key "${key}" is in ${owners.length} groups`)
        .toBeLessThanOrEqual(1);
    }
  });

  it("only `documentsConfirmed` is ungrouped, and it still renders", () => {
    const groups = SECTION_FIELD_GROUPS.ASSETS_LIABILITIES ?? [];
    const ungrouped = SCHEMA_KEYS.filter(
      (key) => !groups.some((g) => g.fields.indexOf(key) !== -1)
    );
    expect(ungrouped).toEqual(["documentsConfirmed"]);

    // …and it reaches the page, in the trailing bucket.
    const rendered = groupSectionFields("ASSETS_LIABILITIES", {
      documentsConfirmed: true,
    });
    expect(rendered).toHaveLength(1);
    expect(rendered[0].key).toBe(UNGROUPED_GROUP_KEY);
  });

  it("no group spec names a field the schema does not have", () => {
    const groups = SECTION_FIELD_GROUPS.ASSETS_LIABILITIES ?? [];
    for (const group of groups) {
      for (const field of group.fields) {
        expect(SCHEMA_KEYS, `${group.key} → "${field}"`).toContain(field);
      }
    }
  });
});

describe("groupForDocumentSlot — the slot→group map cannot drift", () => {
  it("returns null for a section with no grouping", () => {
    expect(groupForDocumentSlot("PARENT_DETAILS", "P45_PARENT_1")).toBeNull();
  });

  it("routes each Assets & Liabilities slot to its subject", () => {
    const cases: [string, string][] = [
      ["MAIN_MORTGAGE_STATEMENT", "property"],
      ["TENANCY_AGREEMENT", "property"],
      ["HOUSING_BENEFIT_LETTER", "property"],
      ["RELATIVE_LETTER", "property"],
      ["OTHER_PROPERTY_MORTGAGE_0", "property"],
      ["OTHER_PROPERTY_MORTGAGE_2", "property"],
      ["CAR_LEASE_AGREEMENT", "car"],
      ["COUNCIL_TAX", "councilTax"],
      ["BANK_STATEMENT_CURRENT_PARENT_1", "financial"],
      ["BANK_STATEMENT_SAVINGS_PARENT_2", "financial"],
      ["INVESTMENT_PARENT_1", "financial"],
      ["INVESTMENT_PARENT_2", "financial"],
      ["CREDIT_CARD_STATEMENT", "debt"],
      ["LOAN_STATEMENT", "debt"],
      ["LOAN_AGREEMENT", "debt"],
      ["OTHER_DEBT_DOCUMENT", "debt"],
    ];
    for (const [slot, group] of cases) {
      expect(groupForDocumentSlot("ASSETS_LIABILITIES", slot), slot).toBe(
        group
      );
    }
  });

  it("covers every registry slot that section-grouping calls Assets & Liabilities", () => {
    // This is the drift guard: `slots.ts` grouped these by comment, and a new
    // A&L slot added there without a group here would otherwise silently land
    // in "Other details".
    const assetSlots = ALL_DOCUMENT_SLOTS.filter(
      (slot) => sectionForDocumentSlot(slot) === "ASSETS_LIABILITIES"
    );
    expect(assetSlots.length).toBeGreaterThan(0);
    for (const slot of assetSlots) {
      expect(
        groupForDocumentSlot("ASSETS_LIABILITIES", slot),
        `slot "${slot}"`
      ).not.toBe(UNGROUPED_GROUP_KEY);
    }
  });

  it("sends an unrecognised slot to the trailing bucket, not to nowhere", () => {
    expect(groupForDocumentSlot("ASSETS_LIABILITIES", "MYSTERY_SLOT")).toBe(
      UNGROUPED_GROUP_KEY
    );
  });
});

describe("sectionGroupKeys", () => {
  it("lists a grouped section's keys plus the trailing bucket", () => {
    expect(sectionGroupKeys("ASSETS_LIABILITIES")).toEqual([
      ...HER_GROUP_ORDER,
      UNGROUPED_GROUP_KEY,
    ]);
  });

  it("is empty for an ungrouped section", () => {
    expect(sectionGroupKeys("CHILD_DETAILS")).toEqual([]);
  });
});
