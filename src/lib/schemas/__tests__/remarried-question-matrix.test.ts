import { describe, it, expect } from "vitest";
import {
  relationshipStatusSchema,
  shouldAskRemarriedQuestion,
} from "@/lib/schemas/parent-details";
import { householdInputFromSources } from "@/lib/household/from-sections";

/**
 * CF-13 — the remarried / new-partnership question follows the client's matrix
 * exactly. Rows are relationship status, columns are the sole-parent answer:
 *
 * | Relationship status | Sole = YES | Sole = NO |
 * |---------------------|------------|-----------|
 * | Single              | ask        | ask       |
 * | Widowed             | ask        | ask       |
 * | Separated           | ask        | ask       |
 * | Divorced            | ask        | ask       |
 * | Married             | ask        | do NOT ask |
 * | Civil Partnership   | ask        | do NOT ask |
 * | Cohabiting          | ask        | do NOT ask |
 *
 * All 7 statuses × 2 sole-parent values are enumerated below; the table IS the
 * specification, so a change in behaviour must show up as a changed row here.
 */
const MATRIX: ReadonlyArray<{
  relationshipStatus: string;
  isSoleParent: boolean;
  ask: boolean;
}> = [
  { relationshipStatus: "SINGLE", isSoleParent: true, ask: true },
  { relationshipStatus: "SINGLE", isSoleParent: false, ask: true },
  { relationshipStatus: "WIDOWED", isSoleParent: true, ask: true },
  { relationshipStatus: "WIDOWED", isSoleParent: false, ask: true },
  { relationshipStatus: "SEPARATED", isSoleParent: true, ask: true },
  { relationshipStatus: "SEPARATED", isSoleParent: false, ask: true },
  { relationshipStatus: "DIVORCED", isSoleParent: true, ask: true },
  { relationshipStatus: "DIVORCED", isSoleParent: false, ask: true },
  { relationshipStatus: "MARRIED", isSoleParent: true, ask: true },
  { relationshipStatus: "MARRIED", isSoleParent: false, ask: false },
  { relationshipStatus: "CIVIL_PARTNERSHIP", isSoleParent: true, ask: true },
  { relationshipStatus: "CIVIL_PARTNERSHIP", isSoleParent: false, ask: false },
  { relationshipStatus: "COHABITING", isSoleParent: true, ask: true },
  { relationshipStatus: "COHABITING", isSoleParent: false, ask: false },
];

describe("shouldAskRemarriedQuestion — CF-13 matrix", () => {
  it("covers every relationship status the form offers, in both columns", () => {
    const statuses = [...relationshipStatusSchema.options].sort();
    const covered = MATRIX.map((r) => r.relationshipStatus)
      .filter((s, i, all) => all.indexOf(s) === i)
      .sort();
    expect(covered).toEqual(statuses);
    expect(MATRIX).toHaveLength(statuses.length * 2);
  });

  it.each(MATRIX)(
    "$relationshipStatus + sole parent = $isSoleParent → ask = $ask",
    ({ relationshipStatus, isSoleParent, ask }) => {
      expect(
        shouldAskRemarriedQuestion({ relationshipStatus, isSoleParent })
      ).toBe(ask);
    }
  );

  it("does not ask before a relationship status has been chosen", () => {
    expect(shouldAskRemarriedQuestion({})).toBe(false);
    expect(shouldAskRemarriedQuestion({ isSoleParent: true })).toBe(false);
    expect(
      shouldAskRemarriedQuestion({ relationshipStatus: null, isSoleParent: false })
    ).toBe(false);
    expect(
      shouldAskRemarriedQuestion({
        relationshipStatus: "NOT_A_STATUS",
        isSoleParent: true,
      })
    ).toBe(false);
  });

  it("treats an unanswered sole-parent question as not-a-sole-parent for coupled statuses", () => {
    expect(shouldAskRemarriedQuestion({ relationshipStatus: "MARRIED" })).toBe(
      false
    );
    expect(shouldAskRemarriedQuestion({ relationshipStatus: "SINGLE" })).toBe(
      true
    );
  });
});

describe("householdInputFromSources — stale remarried answers", () => {
  it.each(MATRIX)(
    "$relationshipStatus + sole parent = $isSoleParent → a stored YES reaches the rules engine only when asked ($ask)",
    ({ relationshipStatus, isSoleParent, ask }) => {
      const input = householdInputFromSources({
        parentDetails: {
          relationshipStatus,
          isSoleParent,
          isRemarriedSoleParent: true,
        },
      });
      expect(input.isRemarriedSoleParent).toBe(ask);
    }
  );

  it("never invents an answer that was not given", () => {
    const input = householdInputFromSources({
      parentDetails: { relationshipStatus: "SINGLE", isSoleParent: true },
    });
    expect(input.isRemarriedSoleParent).toBe(false);
  });
});
