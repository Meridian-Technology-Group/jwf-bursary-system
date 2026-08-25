import { describe, it, expect } from "vitest";
import {
  incomeCategoryBands,
  financialEquityBands,
} from "../profiling-reference";

/**
 * CH-38 + CH-39 — the two reference-band tables Charlotte corrected on
 * 24 Aug 2026.
 *
 * These are seed-data assertions rather than engine tests, deliberately: both
 * defects were in the DATA, not the code. The engine faithfully reproduced a
 * slip in her workbook (CH-39) and a coarser savings table than she wanted
 * (CH-38). A test on the resolver would have passed throughout.
 *
 * The monotonicity test below is the one that matters most. Her correction was
 * *"it should show logically and incrementally from category 1 to category 11"*
 * — that is an invariant, not a list of values, and asserting it as an invariant
 * is what stops the 7,8,7,8 shape coming back the next time someone edits the
 * table by hand.
 */

describe("CH-39 / CH-54 — income category bands run 1..12 incrementally", () => {
  it("assigns exactly one category per band, in ascending income order", () => {
    // CH-54 — she asked for a twelfth band on 25 Aug: £120–140k is category 11
    // and above £140k is category 12, so the count is even.
    const categories = incomeCategoryBands.map((b) => b.category);
    expect(categories).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("never decreases as income rises — the invariant her correction asked for", () => {
    // Sort by band floor with the open-ended bottom first, exactly as the
    // resolver walks them, then assert a strict +1 step every time. This is the
    // assertion that would have caught the original workbook slip.
    const ordered = [...incomeCategoryBands].sort(
      (a, b) => (a.bandFloor ?? -Infinity) - (b.bandFloor ?? -Infinity)
    );
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].category).toBe(ordered[i - 1].category + 1);
    }
  });

  it("keeps the bands contiguous — each floor meets the previous ceiling", () => {
    const ordered = [...incomeCategoryBands].sort(
      (a, b) => (a.bandFloor ?? -Infinity) - (b.bandFloor ?? -Infinity)
    );
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].bandFloor).toBe(ordered[i - 1].bandCeiling);
    }
  });

  it("stays open-ended at both extremes, so no income falls outside a band", () => {
    expect(incomeCategoryBands.at(0)?.bandFloor).toBeNull();
    expect(incomeCategoryBands.at(-1)?.bandCeiling).toBeNull();
  });

  it("leaves the fee-benchmark percentages alone — she asked for bands, not new percentages", () => {
    expect(incomeCategoryBands.map((b) => b.feesBenchmarkPct)).toEqual([
      2, 3, 6, 10, 15, 19, 23, 27, 30, 30, 30, 30,
    ]);
  });

  it("CH-54 — splits the old open-ended top band at £140,000", () => {
    const top = incomeCategoryBands.at(-1);
    const penultimate = incomeCategoryBands.at(-2);
    expect(penultimate?.bandFloor).toBe(120000);
    expect(penultimate?.bandCeiling).toBe(140000);
    expect(top?.bandFloor).toBe(140000);
    expect(top?.bandCeiling).toBeNull();
  });
});

describe("CH-38 — financial equity bands match her supplied table", () => {
  it("carries her fifteen levels, in her order, with her labels verbatim", () => {
    expect(
      financialEquityBands.map((b) => [b.bandFloor, b.bandCeiling, b.label])
    ).toEqual([
      [null, -0.01, "in debt"],
      [0, 0, "no debt, no equity"],
      [0, 3000, "negligible savings"],
      [3000, 20000, "within default cushion savings"],
      [20000, 50000, "fair savings"],
      [50000, 75000, "decent savings"],
      [75000, 100000, "comfortable savings"],
      [100000, 150000, "large savings"],
      [150000, 250000, "high savings"],
      [250000, 400000, "very high savings"],
      [400000, 600000, "extremely high savings"],
      [600000, 900000, "stratospheric savings - level 1"],
      [900000, 1200000, "stratospheric savings - level 2"],
      [1200000, 1600000, "stratospheric savings - level 3"],
      [1600000, null, "stratospheric savings - level 4"],
    ]);
  });

  it("retires the coarse 0–50,000 'some savings' band she replaced", () => {
    expect(financialEquityBands.map((b) => b.label)).not.toContain(
      "some savings"
    );
  });

  it("has no duplicate labels — every level reads distinctly to an assessor", () => {
    const labels = financialEquityBands.map((b) => b.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("stays open-ended at both extremes", () => {
    expect(financialEquityBands.at(0)?.bandFloor).toBeNull();
    expect(financialEquityBands.at(-1)?.bandCeiling).toBeNull();
  });

  it("keeps the savings bands contiguous above the debt/zero rows", () => {
    // Rows 0 and 1 are the special "in debt" and exact-zero cases; the savings
    // ladder proper starts at row 2 and must not leave gaps.
    const ladder = financialEquityBands.slice(2);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].bandFloor).toBe(ladder[i - 1].bandCeiling);
    }
  });
});
