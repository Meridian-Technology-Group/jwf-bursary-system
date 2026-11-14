// Prod, 13 Nov 2026: Family Identification completed with 1 child, then
// Dependent Children raised to 2. Family Identification kept its green tick and
// the Review page was clean; only Submit (with a masked error) caught it. The
// cross-section rules now feed the same gap statuses the sidebar and Review use.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { familyIdCrossSectionGaps } from "../family-id-cross-check";
import { getSectionGapStatuses } from "../section-gaps";
import type { Tx } from "@/lib/db/prisma";

const NAMED_CHILD = { role: "CHILD" };
const GUARDIAN = { role: "GUARDIAN" };
const SOLE_PARENT = { isSoleParent: true };

function data(sections: Record<string, unknown>) {
  return (s: string) => sections[s] ?? null;
}

describe("familyIdCrossSectionGaps", () => {
  it("flags the prod case: 2 dependent children, 1 child in Family Identification", () => {
    const gaps = familyIdCrossSectionGaps(
      data({
        FAMILY_ID: { familyMembers: [NAMED_CHILD, GUARDIAN] },
        DEPENDENT_CHILDREN: { numberOfDependentChildren: 2, children: [{}, {}] },
        PARENT_DETAILS: SOLE_PARENT,
      })
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      id: "FAMILY_ID_CHILD_COUNT",
      sectionType: "FAMILY_ID",
      severity: "error",
      fieldRef: "familyMembers",
    });
    expect(gaps[0].label).toContain("You told us you have 2 dependent children, but 1 child has been added here.");
  });

  it("is clean when the counts agree", () => {
    expect(
      familyIdCrossSectionGaps(
        data({
          FAMILY_ID: { familyMembers: [NAMED_CHILD, GUARDIAN] },
          DEPENDENT_CHILDREN: { numberOfDependentChildren: 1 },
          PARENT_DETAILS: SOLE_PARENT,
        })
      )
    ).toEqual([]);
  });

  it("falls back to the children list when no count is stored", () => {
    const gaps = familyIdCrossSectionGaps(
      data({
        FAMILY_ID: { familyMembers: [NAMED_CHILD] },
        DEPENDENT_CHILDREN: { children: [{}, {}, {}] },
        PARENT_DETAILS: SOLE_PARENT,
      })
    );
    expect(gaps.map((g) => g.id)).toEqual(["FAMILY_ID_CHILD_COUNT"]);
  });

  it("also flags a missing partner for a two-parent household", () => {
    const gaps = familyIdCrossSectionGaps(
      data({
        FAMILY_ID: { familyMembers: [NAMED_CHILD, GUARDIAN] },
        DEPENDENT_CHILDREN: { numberOfDependentChildren: 1 },
        PARENT_DETAILS: { isSoleParent: false, relationshipStatus: "MARRIED" },
      })
    );
    expect(gaps.map((g) => g.id)).toEqual(["FAMILY_ID_PARTNER_ADULT"]);
  });

  it("says nothing when Family Identification has no members (not started / rolling-over)", () => {
    expect(
      familyIdCrossSectionGaps(
        data({ DEPENDENT_CHILDREN: { numberOfDependentChildren: 3 } })
      )
    ).toEqual([]);
  });
});

describe("getSectionGapStatuses — Family Identification loses its tick on a later mismatch", () => {
  function fakeTx(depCount: number) {
    return {
      applicationSection: {
        findMany: vi.fn(async () => [
          { section: "FAMILY_ID", data: { familyMembers: [NAMED_CHILD, GUARDIAN] }, isComplete: true },
          { section: "DEPENDENT_CHILDREN", data: { numberOfDependentChildren: depCount }, isComplete: true },
          { section: "PARENT_DETAILS", data: SOLE_PARENT, isComplete: true },
        ]),
      },
      document: { findMany: vi.fn(async () => []) },
    } as unknown as Tx;
  }

  it("marks FAMILY_ID not fully valid with the child-count error", async () => {
    const familyId = (await getSectionGapStatuses(fakeTx(2), "app-1")).find(
      (s) => s.sectionType === "FAMILY_ID"
    )!;
    expect(familyId.isDbComplete).toBe(true);
    expect(familyId.isFullyValid).toBe(false);
    expect(familyId.gaps.map((g) => g.id)).toContain("FAMILY_ID_CHILD_COUNT");
  });

  it("leaves FAMILY_ID untouched by the cross-check when the counts agree", async () => {
    const familyId = (await getSectionGapStatuses(fakeTx(1), "app-1")).find(
      (s) => s.sectionType === "FAMILY_ID"
    )!;
    expect(familyId.gaps.map((g) => g.id)).not.toContain("FAMILY_ID_CHILD_COUNT");
  });
});
