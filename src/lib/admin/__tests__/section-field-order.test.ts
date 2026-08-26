import { describe, it, expect } from "vitest";
import {
  FIELD_ORDER,
  leafContainerName,
  orderEntries,
  resolveFieldOrderSpec,
} from "@/lib/admin/section-field-order";
import { parentContactSchema } from "@/lib/schemas/parent-details";
import { otherPropertySchema } from "@/lib/schemas/assets-liabilities";

/**
 * CH-61 — Charlotte's Parent 1 Contact block rendered in raw JSONB key order:
 * City, Email, Title, Mobile, Country, Last Name, Postcode, First Name,
 * Address Line1, Address Line2.
 *
 * The failure mode this seam exists to prevent is not "wrong order" — it is
 * **a field disappearing**. An ordering pass that drops what it does not
 * recognise silently hides data from an assessor, so the passthrough cases
 * below matter more than the order case.
 */

/** Her order, verbatim from the 26 Aug email. */
const HER_ORDER = [
  "title",
  "firstName",
  "lastName",
  "mobile",
  "email",
  "addressLine1",
  "addressLine2",
  "city",
  "postcode",
  "country",
];

describe("orderEntries — CH-61", () => {
  it("puts listed keys in spec order", () => {
    const entries: [string, unknown][] = [
      ["city", "Croydon"],
      ["title", "MRS"],
      ["firstName", "A"],
    ];
    expect(
      orderEntries(entries, ["title", "firstName", "city"]).map(([k]) => k)
    ).toEqual(["title", "firstName", "city"]);
  });

  it("keeps an unlisted key — the rule that must not be broken", () => {
    const entries: [string, unknown][] = [
      ["somethingNew", 1],
      ["city", "Croydon"],
      ["title", "MRS"],
    ];
    const out = orderEntries(entries, ["title", "city"]);
    expect(out.map(([k]) => k)).toEqual(["title", "city", "somethingNew"]);
    // And its value is untouched.
    expect(out[2][1]).toBe(1);
  });

  it("preserves the relative order of several unlisted keys", () => {
    const entries: [string, unknown][] = [
      ["zeta", 1],
      ["alpha", 2],
      ["title", 3],
      ["middle", 4],
    ];
    expect(orderEntries(entries, ["title"]).map(([k]) => k)).toEqual([
      "title",
      "zeta",
      "alpha",
      "middle",
    ]);
  });

  it("renders nothing for a spec key that is absent from the data", () => {
    const entries: [string, unknown][] = [["title", "MRS"]];
    // No "Not provided" ghost row appears that was not there before: the
    // output holds exactly the entries it was given.
    expect(orderEntries(entries, HER_ORDER)).toEqual([["title", "MRS"]]);
  });

  it("returns the entries untouched for an empty or absent spec", () => {
    const entries: [string, unknown][] = [
      ["b", 1],
      ["a", 2],
    ];
    expect(orderEntries(entries, [])).toEqual(entries);
    expect(orderEntries(entries, undefined)).toEqual(entries);
  });

  it("handles empty entries", () => {
    expect(orderEntries([], HER_ORDER)).toEqual([]);
    expect(orderEntries([], undefined)).toEqual([]);
  });

  it("never loses or duplicates an entry, whatever the spec", () => {
    const entries: [string, unknown][] = [
      ["city", 1],
      ["email", 2],
      ["title", 3],
      ["mystery", 4],
    ];
    const out = orderEntries(entries, HER_ORDER);
    expect(out).toHaveLength(entries.length);
    expect(out.map(([k]) => k).sort()).toEqual(
      entries.map(([k]) => k).sort()
    );
  });

  it("is not confused by a duplicated key in the spec", () => {
    const entries: [string, unknown][] = [
      ["b", 1],
      ["a", 2],
    ];
    expect(orderEntries(entries, ["a", "b", "a"]).map(([k]) => k)).toEqual([
      "a",
      "b",
    ]);
  });

  it("reproduces her order from the exact key order in her screenshot", () => {
    // The order her screenshot showed, which is the JSONB insertion order.
    const asStored: [string, unknown][] = [
      ["city", "Croydon"],
      ["email", "a@b.test"],
      ["title", "MRS"],
      ["mobile", "07000 000000"],
      ["country", "United Kingdom"],
      ["lastName", "Jayaprakash"],
      ["postcode", "CR0 1AA"],
      ["firstName", "A"],
      ["addressLine1", "1 High St"],
      ["addressLine2", "Flat 2"],
    ];
    expect(
      orderEntries(asStored, FIELD_ORDER.parentContact).map(([k]) => k)
    ).toEqual(HER_ORDER);
  });
});

describe("leafContainerName", () => {
  it("returns the container name for a top-level path", () => {
    expect(leafContainerName("parent1Contact")).toBe("parent1Contact");
  });

  it("skips array indices so every element shares the array's spec", () => {
    expect(leafContainerName("otherProperties.0")).toBe("otherProperties");
    expect(leafContainerName("otherProperties.12")).toBe("otherProperties");
  });

  it("returns the deepest non-index segment", () => {
    expect(leafContainerName("a.b.parent1Contact")).toBe("parent1Contact");
  });

  it("returns empty string for the section root", () => {
    expect(leafContainerName("")).toBe("");
  });
});

describe("resolveFieldOrderSpec", () => {
  it("gives Parent 2 the same spec as Parent 1 — she confirmed this", () => {
    expect(resolveFieldOrderSpec("parent2Contact")).toBe(
      FIELD_ORDER.parentContact
    );
    expect(resolveFieldOrderSpec("parent1Contact")).toBe(
      FIELD_ORDER.parentContact
    );
  });

  it("applies the per-property spec to every element of otherProperties", () => {
    expect(resolveFieldOrderSpec("otherProperties.2")).toBe(
      FIELD_ORDER.otherProperties
    );
  });

  it("has no spec at the section root, so sections stay as they were", () => {
    expect(resolveFieldOrderSpec("")).toBeUndefined();
  });

  it("has no spec for an unknown container", () => {
    expect(resolveFieldOrderSpec("parent1Employment")).toBeUndefined();
  });
});

describe("specs are spelt with real schema keys", () => {
  it("every parentContact spec key exists in parentContactSchema", () => {
    const schemaKeys = Object.keys(parentContactSchema.shape);
    for (const key of FIELD_ORDER.parentContact) {
      expect(schemaKeys, `spec key "${key}"`).toContain(key);
    }
  });

  it("covers every parentContactSchema key, so nothing falls to the bottom", () => {
    for (const key of Object.keys(parentContactSchema.shape)) {
      expect(FIELD_ORDER.parentContact, `schema key "${key}"`).toContain(key);
    }
  });

  it("every otherProperties spec key exists in otherPropertySchema", () => {
    const schemaKeys = Object.keys(otherPropertySchema.shape);
    for (const key of FIELD_ORDER.otherProperties) {
      expect(schemaKeys, `spec key "${key}"`).toContain(key);
    }
  });

  it("leaves only `id` unlisted on a property, which therefore renders last", () => {
    const unlisted = Object.keys(otherPropertySchema.shape).filter(
      (k) => FIELD_ORDER.otherProperties.indexOf(k) === -1
    );
    expect(unlisted).toEqual(["id"]);
  });
});
