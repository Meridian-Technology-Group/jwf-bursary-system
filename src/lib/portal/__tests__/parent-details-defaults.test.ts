/**
 * CF-17 — the Parent/Guardian step's default values must seed every required
 * string, or the applicant is shown raw Zod internals with no field name.
 *
 * Charlotte's screenshot (13 Aug) read, in full:
 *
 *     Please fix the following before continuing:
 *       • Invalid input: expected string, received undefined
 *
 * That is Zod's BASE TYPE error. It fires before `.min(1, "…")` / `.email(…)`
 * can supply human copy, and the section-form error banner prints `.message`
 * only — so it reaches the applicant as a bare sentence naming no field.
 *
 * It was reachable because `getDefaultValues` seeded Parent 1's strings to `""`
 * but seeded nothing at all for Parent 2 (and omitted `parent1Contact.email`).
 * Selecting a coupled relationship status — married / civil partnership /
 * cohabiting — is what makes Parent 2 required, so picking "Cohabiting" is what
 * surfaced it.
 */

import { describe, expect, it } from "vitest";

import { parentDetailsDefaultValues } from "@/lib/portal/parent-details-defaults";
import {
  COUPLED_RELATIONSHIP_STATUSES,
  parentDetailsSchema,
} from "@/lib/schemas/parent-details";

/** The exact error class from the screenshot. */
const RAW_ZOD_TYPE_ERROR = /expected \w+, received undefined/;

/** Defaults + a completed Parent 1, i.e. what the form emits before Parent 2 is filled. */
function formValues(relationshipStatus: string, isSoleParent: boolean) {
  const defaults = parentDetailsDefaultValues();
  return {
    ...defaults,
    isSoleParent,
    relationshipStatus,
    parent1Contact: {
      ...defaults.parent1Contact,
      title: "MRS",
      firstName: "Charlotte",
      lastName: "Tester",
      mobile: "07700900000",
      email: "charlotte@example.com",
      addressLine1: "1 High Street",
      city: "Croydon",
      postcode: "CR0 1AA",
      country: "United Kingdom",
    },
    parent1Employment: {
      status: "EMPLOYED",
      profession: "Teacher",
      employerAddress: "2 School Lane, Croydon",
      isDirector: false,
      leftEmployment: false,
    },
  };
}

function messagesFor(relationshipStatus: string, isSoleParent: boolean) {
  const result = parentDetailsSchema.safeParse(
    formValues(relationshipStatus, isSoleParent)
  );
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

/** Every non-optional string on `parentContactSchema`. */
const REQUIRED_CONTACT_STRINGS = [
  "firstName",
  "lastName",
  "email",
  "addressLine1",
  "city",
  "postcode",
  "country",
] as const;

describe("CF-17 — parent/guardian defaults seed every required string", () => {
  // The root-cause guard. `undefined` here is what produced the screenshot's
  // "Invalid input: expected string, received undefined"; `""` cannot.
  it.each(["parent1Contact", "parent2Contact"] as const)(
    "%s seeds every required string as a string, never undefined",
    (block) => {
      const contact = parentDetailsDefaultValues()[block];
      expect(contact, `${block} must be seeded`).toBeDefined();
      for (const field of REQUIRED_CONTACT_STRINGS) {
        expect(typeof contact[field], `${block}.${field}`).toBe("string");
      }
    }
  );

  it.each([...COUPLED_RELATIONSHIP_STATUSES])(
    "%s with an unfilled Parent 2 shows no raw Zod type errors",
    (relationshipStatus) => {
      for (const isSoleParent of [true, false]) {
        const messages = messagesFor(relationshipStatus, isSoleParent);
        // Parent 2 IS still required — that is the intended rule. What must
        // never happen is the requirement surfacing as Zod internals.
        expect(messages.length).toBeGreaterThan(0);
        expect(
          messages.filter((m) => RAW_ZOD_TYPE_ERROR.test(m)),
          `${relationshipStatus} sole=${isSoleParent}`
        ).toEqual([]);
      }
    }
  );

  it("a cohabiting household is told exactly which Parent 2 fields to fill", () => {
    const messages = messagesFor("COHABITING", false);
    expect(messages).toContain("First name is required");
    expect(messages).toContain("Email address is required");
    expect(messages).toContain("Postcode is required");
    expect(messages).toContain("Country is required");
  });

  it("Cohabiting and Married produce the same messages from the same defaults", () => {
    for (const isSoleParent of [true, false]) {
      expect(messagesFor("COHABITING", isSoleParent).sort()).toEqual(
        messagesFor("MARRIED", isSoleParent).sort()
      );
    }
  });

  it("an untouched Parent 1 email is human copy, not Zod internals", () => {
    const values = formValues("SINGLE", true);
    const result = parentDetailsSchema.safeParse({
      ...values,
      parent1Contact: {
        ...values.parent1Contact,
        email: parentDetailsDefaultValues().parent1Contact.email,
      },
    });
    const messages = result.success
      ? []
      : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Email address is required");
    expect(messages.filter((m) => RAW_ZOD_TYPE_ERROR.test(m))).toEqual([]);
  });

  it("a sole parent with no partner still completes the step", () => {
    expect(messagesFor("SINGLE", true)).toEqual([]);
  });
});
