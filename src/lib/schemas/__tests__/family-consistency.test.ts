import { describe, it, expect } from "vitest";
import {
  makeFamilyIdSchema,
  familyIdConsistencyIssues,
  FAMILY_ID_CHILD_COUNT_ISSUE,
  FAMILY_ID_PARTNER_ADULT_ISSUE,
} from "@/lib/schemas/family-id";
import { isTwoParentHousehold } from "@/lib/schemas/parent-details";
import { dependentChildrenSchema } from "@/lib/schemas/dependent-children";

// ─── isTwoParentHousehold ────────────────────────────────────────────────────

describe("isTwoParentHousehold", () => {
  it("is true when explicitly not a sole parent", () => {
    expect(isTwoParentHousehold({ isSoleParent: false })).toBe(true);
  });

  it.each(["MARRIED", "CIVIL_PARTNERSHIP", "COHABITING"])(
    "is true for coupled status %s even when sole-parent = yes",
    (relationshipStatus) => {
      expect(isTwoParentHousehold({ isSoleParent: true, relationshipStatus })).toBe(
        true
      );
    }
  );

  it("is false for a genuine sole parent with a non-coupled status", () => {
    expect(
      isTwoParentHousehold({ isSoleParent: true, relationshipStatus: "SINGLE" })
    ).toBe(false);
    expect(
      isTwoParentHousehold({ isSoleParent: true, relationshipStatus: "WIDOWED" })
    ).toBe(false);
  });

  it("treats a coupled status alone (sole-parent unanswered) as two-parent", () => {
    expect(isTwoParentHousehold({ relationshipStatus: "COHABITING" })).toBe(true);
  });
});

// ─── Family ID cross-section consistency ─────────────────────────────────────

const member = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  familyMemberName: "Test Member",
  role: "OTHER",
  isBritishCitizen: true,
  ...over,
});

const namedChild = () => member({ role: "CHILD", familyMemberName: "Child" });
const guardian = () => member({ role: "GUARDIAN", familyMemberName: "Parent" });

describe("familyIdConsistencyIssues", () => {
  it("flags a mismatch between child members and the declared count", () => {
    const issues = familyIdConsistencyIssues([namedChild(), guardian()], {
      dependentChildrenCount: 2,
    });
    expect(issues.map((i) => i.id)).toContain(FAMILY_ID_CHILD_COUNT_ISSUE);
  });

  it("passes when the child members match the declared count", () => {
    const members = [
      namedChild(),
      guardian(),
      member({ memberType: "CHILD" }),
    ];
    const issues = familyIdConsistencyIssues(members, {
      dependentChildrenCount: 2,
    });
    expect(issues.map((i) => i.id)).not.toContain(FAMILY_ID_CHILD_COUNT_ISSUE);
  });

  it("requires an extra adult for a two-parent household", () => {
    const issues = familyIdConsistencyIssues([namedChild(), guardian()], {
      requiresPartnerAdult: true,
    });
    expect(issues.map((i) => i.id)).toContain(FAMILY_ID_PARTNER_ADULT_ISSUE);
  });

  it("is satisfied once a partner adult is added", () => {
    const members = [namedChild(), guardian(), member({ memberType: "ADULT" })];
    const issues = familyIdConsistencyIssues(members, {
      requiresPartnerAdult: true,
    });
    expect(issues.map((i) => i.id)).not.toContain(FAMILY_ID_PARTNER_ADULT_ISSUE);
  });

  it("fires no cross-section rules without context", () => {
    expect(familyIdConsistencyIssues([namedChild(), guardian()], {})).toEqual([]);
  });
});

describe("makeFamilyIdSchema", () => {
  const parse = (members: unknown[], context = {}) =>
    makeFamilyIdSchema(context).safeParse({ familyMembers: members });

  it("blocks when the child count does not match", () => {
    const r = parse([namedChild(), guardian()], { dependentChildrenCount: 2 });
    expect(r.success).toBe(false);
  });

  it("blocks a coupled household with no extra adult", () => {
    const r = parse([namedChild(), guardian()], { requiresPartnerAdult: true });
    expect(r.success).toBe(false);
  });

  it("accepts a consistent household", () => {
    const r = parse(
      [namedChild(), guardian(), member({ memberType: "ADULT" })],
      { dependentChildrenCount: 1, requiresPartnerAdult: true }
    );
    expect(r.success).toBe(true);
  });
});

// ─── Dependent children count matches entries ────────────────────────────────

describe("dependentChildrenSchema — count matches entries", () => {
  const child = (over: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    name: "A Child",
    ...over,
  });

  it("blocks when fewer children are entered than declared", () => {
    const r = dependentChildrenSchema.safeParse({
      numberOfDependentChildren: 2,
      children: [child({ isNamedChild: true })],
    });
    expect(r.success).toBe(false);
  });

  it("accepts when the count matches the entries", () => {
    const r = dependentChildrenSchema.safeParse({
      numberOfDependentChildren: 2,
      children: [child({ isNamedChild: true }), child()],
    });
    expect(r.success).toBe(true);
  });
});
