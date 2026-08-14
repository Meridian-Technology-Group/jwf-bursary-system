/**
 * CF-17 — Cohabiting must validate exactly as Married on the Parent/Guardian
 * step. The two statuses share one list (`COUPLED_RELATIONSHIP_STATUSES`), so
 * they cannot drift apart by accident today — this test pins that so a future
 * edit cannot fork the list or add a status-specific branch without failing.
 *
 * The comparison is on the SET OF ISSUE PATHS (the required-field set), not on
 * message text, so wording changes don't make it brittle.
 */

import { describe, expect, it } from "vitest";

import {
  COUPLED_RELATIONSHIP_STATUSES,
  parentDetailsSchema,
  secondaryParentDetailsSchema,
} from "@/lib/schemas/parent-details";

const contact = {
  title: "MR",
  firstName: "Alex",
  lastName: "Doe",
  mobile: "07700900000",
  email: "alex@example.com",
  addressLine1: "1 High Street",
  city: "Croydon",
  postcode: "CR0 1AA",
  country: "United Kingdom",
};

const employment = {
  status: "EMPLOYED",
  profession: "Teacher",
  employerAddress: "2 School Lane, Croydon",
  isDirector: false,
  leftEmployment: false,
};

/** The required-field set the schema produces for a given household shape. */
function requiredFieldSet(
  relationshipStatus: string,
  isSoleParent: boolean,
  withSecondParent: boolean
): string[] {
  const result = parentDetailsSchema.safeParse({
    isSoleParent,
    relationshipStatus,
    parent1Contact: contact,
    parent1Employment: employment,
    ...(withSecondParent
      ? { parent2Contact: contact, parent2Employment: employment }
      : {}),
  });
  if (result.success) return [];
  return Array.from(
    new Set(result.error.issues.map((issue) => issue.path.join(".")))
  ).sort();
}

const SHAPES = [
  { isSoleParent: true, withSecondParent: true },
  { isSoleParent: true, withSecondParent: false },
  { isSoleParent: false, withSecondParent: true },
  { isSoleParent: false, withSecondParent: false },
];

describe("CF-17 — Cohabiting validates as Married", () => {
  it.each(SHAPES)(
    "Cohabiting requires exactly what Married requires (sole=$isSoleParent, parent2=$withSecondParent)",
    ({ isSoleParent, withSecondParent }) => {
      expect(
        requiredFieldSet("COHABITING", isSoleParent, withSecondParent)
      ).toEqual(requiredFieldSet("MARRIED", isSoleParent, withSecondParent));
    }
  );

  it("every coupled status shares Married's required-field set", () => {
    for (const status of COUPLED_RELATIONSHIP_STATUSES) {
      for (const { isSoleParent, withSecondParent } of SHAPES) {
        expect(
          requiredFieldSet(status, isSoleParent, withSecondParent),
          `${status} sole=${isSoleParent} parent2=${withSecondParent}`
        ).toEqual(requiredFieldSet("MARRIED", isSoleParent, withSecondParent));
      }
    }
  });

  it("a completed cohabiting household passes the parent/guardian step", () => {
    expect(requiredFieldSet("COHABITING", false, true)).toEqual([]);
  });
});

/**
 * The contribute (second parent) flow renders the parent form in
 * `secondaryMode`, so the Parent 2 block is never shown. Its save action must
 * therefore validate with the SECONDARY schema — the lead schema would require
 * Parent 2 for any coupled status, rejecting the save for fields the
 * contributor's form does not render.
 */
describe("secondary schema never requires Parent 2", () => {
  it.each([...COUPLED_RELATIONSHIP_STATUSES])(
    "%s is accepted from a second parent with no Parent 2 block",
    (relationshipStatus) => {
      const result = secondaryParentDetailsSchema.safeParse({
        // The contribute flow holds the second parent at sole-parent = true.
        isSoleParent: true,
        relationshipStatus,
        parent1Contact: contact,
        parent1Employment: employment,
      });
      expect(result.success).toBe(true);
    }
  );
});
