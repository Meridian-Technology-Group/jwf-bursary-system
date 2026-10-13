import { describe, it, expect } from "vitest";
import { planGapRanks, type RankableGapReason } from "../gap-rank";

// Five live codes ranked 1–5, plus one live unranked code.
const live: RankableGapReason[] = [
  { id: "a", code: 101, rank: 1 },
  { id: "b", code: 102, rank: 2 },
  { id: "c", code: 103, rank: 3 },
  { id: "d", code: 110, rank: 4 },
  { id: "e", code: 111, rank: 5 },
  { id: "u", code: 130, rank: null },
];

function apply(changes: ReturnType<typeof planGapRanks>, rows = live) {
  const byId = new Map(changes.map((c) => [c.id, c.to]));
  return rows.map((r) => [r.code, byId.has(r.id) ? byId.get(r.id) : r.rank]);
}

describe("planGapRanks (Epic 21 #2)", () => {
  it("changes nothing when a code is saved at its own rank", () => {
    expect(planGapRanks(live, { id: "c", code: 103, currentRank: 3 }, 3)).toEqual([]);
  });

  it("inserts a new code at a taken rank and moves the rest down one", () => {
    const withNew = [...live, { id: "n", code: 121, rank: null }];
    const changes = planGapRanks(withNew, { id: "n", code: 121, currentRank: null }, 2);
    expect(apply(changes, withNew)).toEqual([
      [101, 1], [102, 3], [103, 4], [110, 5], [111, 6], [130, null], [121, 2],
    ]);
  });

  it("moves a code up, shifting the codes it passes down", () => {
    const changes = planGapRanks(live, { id: "e", code: 111, currentRank: 5 }, 2);
    expect(apply(changes)).toEqual([
      [101, 1], [102, 3], [103, 4], [110, 5], [111, 2], [130, null],
    ]);
  });

  it("moves a code down, shifting the codes it passes up", () => {
    const changes = planGapRanks(live, { id: "a", code: 101, currentRank: 1 }, 4);
    expect(apply(changes)).toEqual([
      [101, 4], [102, 1], [103, 2], [110, 3], [111, 5], [130, null],
    ]);
  });

  it("clamps a rank past the end to the next free rank", () => {
    const changes = planGapRanks(live, { id: "u", code: 130, currentRank: null }, 99);
    expect(changes).toEqual([{ id: "u", code: 130, from: null, to: 6 }]);
  });

  it("unranks a code (or a deprecation) and closes the gap", () => {
    const changes = planGapRanks(live, { id: "b", code: 102, currentRank: 2 }, null);
    expect(apply(changes)).toEqual([
      [101, 1], [102, null], [103, 2], [110, 3], [111, 4], [130, null],
    ]);
  });

  it("ignores codes that are not live (the caller passes live codes only)", () => {
    // A deprecated code saved with no rank and no live neighbours to move.
    expect(planGapRanks(live, { id: "x", code: 5, currentRank: null }, null)).toEqual([]);
  });
});
