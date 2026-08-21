/**
 * F5 — systemic guard against the "raw Zod internals" defect class.
 *
 * Charlotte's screenshot (13 Aug) read, in full:
 *
 *     Please fix the following before continuing:
 *       • Invalid input: expected string, received undefined
 *
 * That is Zod's BASE TYPE error. It fires before `.min(1, "…")` / a `refine` /
 * a `superRefine` can supply human copy, and the section-form error banner
 * prints `.message` only — so it reaches the applicant as a bare sentence that
 * names no field and cannot be acted on.
 *
 * It is reachable whenever a REQUIRED field is absent from a section's
 * `getDefaultValues`: react-hook-form then holds it as `undefined`, and
 * `undefined` fails the type check rather than the human-messaged one.
 *
 * Confirmed instances before this sweep:
 *   - PARENT_DETAILS  — the whole Parent 2 block + `parent1Contact.email` (A3/CF-17)
 *   - PARENTS_INCOME  — `parent2Income.documentsConfirmed` (A4)
 *   - OTHER_INFO      — three unanswered yes/no booleans
 *   - DEPENDENT_ELDERLY — two unanswered yes/no booleans
 *   - contribute flow — `parent1Contact.email` again, on its own defaults path
 *
 * ## How this test is built
 *
 * Sections are enumerated from `sectionSchemaMap`, never from a hand-written
 * list, so **a new section cannot be added without defaults and probes without
 * failing this suite** — `sectionSchemaMap` is typed
 * `Record<ApplicationSectionType, ZodTypeAny>`, so a new enum member forces an
 * entry there, and `SECTION_PROBES` is typed against the same key set.
 *
 * Each probe parses the REAL defaults (optionally overlaid with what an
 * applicant would realistically have typed) using the REAL section schema. It
 * deliberately does NOT build its own fixture: a hand-built fixture supplies
 * exactly the fields the real form leaves `undefined`, which is precisely how
 * this class of bug hides from schema tests.
 */

import type { ApplicationSectionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  CONTRIBUTE_SECTIONS,
  getContributeSectionDefaultValues,
} from "@/lib/portal/contribute-section-defaults";
import {
  getSectionDefaultValues,
  seedsParentTwo,
  type DefaultValuesSeed,
} from "@/lib/portal/section-defaults";
import { sectionSchemaMap } from "@/lib/schemas";
import { makeFamilyIdSchema } from "@/lib/schemas/family-id";
import { secondaryParentDetailsSchema } from "@/lib/schemas/parent-details";

/**
 * Zod's un-messaged base-type failures — the exact error class the applicant
 * must never be shown. Covers `expected string, received undefined`,
 * `expected boolean, received undefined`, `expected object, received undefined`
 * and their null/NaN variants.
 */
const RAW_ZOD_TYPE_ERROR = /expected \w+, received (undefined|null|nan)/i;

type Probe = {
  /** What this probe represents, in the applicant's terms. */
  name: string;
  /** Context the section page passes into `getSectionDefaultValues`. */
  seed?: DefaultValuesSeed;
  /** What the applicant has realistically typed, overlaid on the defaults. */
  typed?: Record<string, unknown>;
};

const ALL_SECTIONS = Object.keys(sectionSchemaMap) as ApplicationSectionType[];

/** Shallow-per-key deep merge — enough for these one- and two-level blobs. */
function overlay(
  base: Record<string, unknown>,
  typed: Record<string, unknown> = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(typed)) {
    const existing = out[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) &&
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? overlay(
            existing as Record<string, unknown>,
            value as Record<string, unknown>
          )
        : value;
  }
  return out;
}

/**
 * FAMILY_ID is the one section whose live schema is built with cross-section
 * context rather than taken from the map (`makeFamilyIdSchema`). Use the same
 * schema the section page uses so the probe reflects the real gate.
 */
function schemaFor(section: ApplicationSectionType, seed?: DefaultValuesSeed) {
  if (section === "FAMILY_ID") {
    return makeFamilyIdSchema({
      requiresPartnerAdult: seed?.isSoleParent === false,
    });
  }
  return sectionSchemaMap[section];
}

function messagesFor(section: ApplicationSectionType, probe: Probe): string[] {
  const defaults = getSectionDefaultValues(section, null, probe.seed ?? {});
  const values = overlay(defaults as Record<string, unknown>, probe.typed);
  const result = schemaFor(section, probe.seed).safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Probes. Every section gets an "untouched" probe (the applicant opens the step
// and presses Continue) — that is where an unseeded required field shows up.
// Sections with conditional blocks get the household / branch variants that
// mount extra required fields.
// ─────────────────────────────────────────────────────────────────────────────

const SOLE: DefaultValuesSeed = { isSoleParent: true, relationshipStatus: "SINGLE" };
const COUPLE: DefaultValuesSeed = { isSoleParent: false, relationshipStatus: "MARRIED" };
/** The CF-17 combination: "sole parent = yes" alongside a coupled status. */
const SOLE_BUT_COUPLED: DefaultValuesSeed = {
  isSoleParent: true,
  relationshipStatus: "COHABITING",
};

const HOUSEHOLDS: { name: string; seed: DefaultValuesSeed }[] = [
  { name: "sole parent", seed: SOLE },
  { name: "two-parent", seed: COUPLE },
  { name: "sole parent + coupled status", seed: SOLE_BUT_COUPLED },
];

const SECTION_PROBES: Record<ApplicationSectionType, Probe[]> = {
  CHILD_DETAILS: [
    { name: "untouched" },
    {
      name: "child lives at a different address",
      typed: { sameAddressAsParent1: false },
    },
  ],
  FAMILY_ID: HOUSEHOLDS.map(({ name, seed }) => ({
    name: `untouched — ${name}`,
    seed: { ...seed, applicationChildName: "Bob Smith", applicationGuardianName: "Ann Smith" },
  })),
  PARENT_DETAILS: HOUSEHOLDS.map(({ name, seed }) => ({
    name: `untouched — ${name}`,
    seed,
  })),
  DEPENDENT_CHILDREN: [{ name: "untouched" }],
  DEPENDENT_ELDERLY: [
    { name: "untouched" },
    {
      name: "declares elderly dependants in care",
      typed: { hasElderlyAtHome: false, hasElderlyInCare: true },
    },
  ],
  OTHER_INFO: [
    { name: "untouched" },
    {
      name: "declares a court order, policy and outstanding fees",
      typed: {
        hasCOurtOrder: true,
        hasInsurancePolicy: true,
        hasOutstandingFees: true,
      },
    },
  ],
  PARENTS_INCOME: HOUSEHOLDS.map(({ name, seed }) => ({
    name: `untouched — ${name}`,
    seed,
  })),
  ASSETS_LIABILITIES: [
    { name: "untouched" },
    { name: "owns the family home", typed: { propertyOwnership: "OWN" } },
    { name: "rents the family home", typed: { propertyOwnership: "RENT" } },
    { name: "declares a charging order", typed: { hasChargingOrder: true } },
  ],
  ADDITIONAL_INFO: [{ name: "untouched" }],
  DECLARATION: HOUSEHOLDS.map(({ name, seed }) => ({
    name: `untouched — ${name}`,
    seed,
  })),
};

describe("F5 — every section's defaults seed every required field", () => {
  it("covers every section in sectionSchemaMap", () => {
    // Guards the enumeration itself: a section added to the schema map without
    // a probe list here fails, rather than silently going untested.
    expect(ALL_SECTIONS.length).toBeGreaterThan(0);
    for (const section of ALL_SECTIONS) {
      expect(SECTION_PROBES[section], `${section} needs probes`).toBeDefined();
      expect(SECTION_PROBES[section].length, `${section} needs probes`).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SECTIONS)("%s returns real defaults, not the empty fallthrough", (section) => {
    // `getSectionDefaultValues` ends in `default: return {}`. A new section that
    // reaches it would register every field as `undefined` — the defect class in
    // its purest form. No existing section may fall through.
    const defaults = getSectionDefaultValues(section, null, SOLE);
    expect(Object.keys(defaults as object).length, `${section} has no defaults case`)
      .toBeGreaterThan(0);
  });

  describe.each(ALL_SECTIONS)("%s", (section) => {
    it.each(SECTION_PROBES[section].map((p) => [p.name, p] as const))(
      "%s shows no raw Zod type errors",
      (_name, probe) => {
        const raw = messagesFor(section, probe).filter((m) =>
          RAW_ZOD_TYPE_ERROR.test(m)
        );
        expect(raw, `${section} / ${probe.name}`).toEqual([]);
      }
    );
  });
});

describe("F5 — the contribute (secondary parent) flow has the same guarantee", () => {
  it.each(CONTRIBUTE_SECTIONS)("%s returns real defaults", (section) => {
    const defaults = getContributeSectionDefaultValues(section, null);
    expect(Object.keys(defaults as object).length).toBeGreaterThan(0);
  });

  it.each(CONTRIBUTE_SECTIONS)("%s shows no raw Zod type errors", (section) => {
    const defaults = getContributeSectionDefaultValues(section, null);
    // The contribute flow swaps in the secondary-parent schema for PARENT_DETAILS
    // and reuses the applicant schemas elsewhere.
    const schema =
      section === "PARENT_DETAILS"
        ? secondaryParentDetailsSchema
        : sectionSchemaMap[section];
    const result = schema.safeParse(defaults);
    const messages = result.success
      ? []
      : result.error.issues.map((i) => i.message);
    expect(messages.filter((m) => RAW_ZOD_TYPE_ERROR.test(m))).toEqual([]);
  });
});

/**
 * Parsing the defaults alone cannot see this one: `parent2Income` and
 * `acceptedParent2` are BOTH optional at the schema level, so simply omitting
 * them parses clean. The damage happens at runtime — once the Parent 2 block is
 * MOUNTED, react-hook-form registers its fields (and `ParentsIncomeForm`'s
 * total-sync effect writes `parent2Income.total`), so the block arrives at the
 * schema as a populated object whose required leaves are `undefined`. That is
 * the A4 report: "expected boolean, received undefined", plus a checkbox mounted
 * uncontrolled with `checked={undefined}`.
 *
 * So the invariant is structural: **if the block is mounted, it must be seeded.**
 */
describe("F5 — a MOUNTED Parent 2 block is always seeded", () => {
  const mounted = HOUSEHOLDS.filter(({ seed }) => seedsParentTwo(seed));
  const absent = HOUSEHOLDS.filter(({ seed }) => !seedsParentTwo(seed));

  it("the two household shapes are both represented", () => {
    expect(mounted.length).toBeGreaterThan(0);
    expect(absent.length).toBeGreaterThan(0);
    // The CF-17 combination must land on the MOUNTED side: a coupled status
    // opens Parent 2 even when the applicant answered "sole parent = yes".
    expect(seedsParentTwo(SOLE_BUT_COUPLED)).toBe(true);
  });

  it.each(mounted)("$name — parent2Income is seeded complete", ({ seed }) => {
    const values = getSectionDefaultValues("PARENTS_INCOME", null, seed) as {
      parent2Income?: { total?: unknown; documentsConfirmed?: unknown };
    };
    expect(values.parent2Income, "parent2Income must be seeded").toBeDefined();
    expect(typeof values.parent2Income?.documentsConfirmed).toBe("boolean");
    expect(typeof values.parent2Income?.total).toBe("number");
  });

  it.each(mounted)("$name — the Parent 2 declaration is seeded", ({ seed }) => {
    const values = getSectionDefaultValues("DECLARATION", null, seed) as Record<
      string,
      unknown
    >;
    expect(typeof values.acceptedParent2).toBe("boolean");
    expect(typeof values.signedOnBehalfOfParent2).toBe("string");
  });

  it.each(absent)("$name — Parent 2 is NOT seeded", ({ seed }) => {
    // The other half of the invariant. Seeding a block the wizard never shows
    // would demand Parent 2 figures from a genuine sole parent.
    const income = getSectionDefaultValues("PARENTS_INCOME", null, seed) as Record<
      string,
      unknown
    >;
    expect(income.parent2Income).toBeUndefined();
    const declaration = getSectionDefaultValues("DECLARATION", null, seed) as Record<
      string,
      unknown
    >;
    expect(declaration.acceptedParent2).toBeUndefined();
  });
});

describe("F5 — seeding defaults did not change what is required", () => {
  it("a sole parent is not asked for Parent 2's income or declaration", () => {
    const income = getSectionDefaultValues("PARENTS_INCOME", null, SOLE) as Record<
      string,
      unknown
    >;
    expect(income.parent2Income).toBeUndefined();
    const declaration = getSectionDefaultValues("DECLARATION", null, SOLE) as Record<
      string,
      unknown
    >;
    expect(declaration.acceptedParent2).toBeUndefined();
  });

  it("a two-parent household IS asked for both, in human copy", () => {
    const messages = messagesFor("DECLARATION", { name: "two-parent", seed: COUPLE });
    expect(messages).toContain("Parent/Guardian 2 must accept the declaration to submit");
    expect(messages).toContain("Please enter the name of Parent/Guardian 2");
  });

  it("an untouched section still fails — the applicant is stopped, just legibly", () => {
    // The point of the sweep is the WORDING, not permissiveness. Every section
    // that gated progression before still gates it.
    for (const section of ["PARENT_DETAILS", "OTHER_INFO", "DEPENDENT_ELDERLY"] as const) {
      expect(messagesFor(section, { name: "untouched", seed: COUPLE }).length)
        .toBeGreaterThan(0);
    }
  });
});
