import { describe, it, expect } from "vitest";
import {
  gapGroupHeadingForCode,
  GAP_CODE_GROUPS,
  GAP_CODE_GROUP_HEADINGS,
} from "../gap-category";
import { gapReasons } from "../../../../prisma/seed-data/gap-reasons";

// D4 (6 Sep 2026), extended 8 Sep 2026 — Charlotte's four gap-code groups,
// DB codes 101–113. Her two 8 Sep additions were appended (112 = Acrimonious
// Separation at display 10, 113 = Immaterial gap at display 13), so the groups
// are deliberately non-contiguous in code space.

describe("gap-code grouping", () => {
  it("buckets each display range under her group heading", () => {
    expect(gapGroupHeadingForCode(101)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(103)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(104)).toBe("4 – 6: Pastoral Leniency");
    expect(gapGroupHeadingForCode(107)).toBe("7 – 10: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(109)).toBe("7 – 10: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(110)).toBe("11 – 13: Contextual");
    expect(gapGroupHeadingForCode(111)).toBe("11 – 13: Contextual");
  });

  it("groups her 8 Sep additions despite their out-of-sequence codes", () => {
    // 112 joins Internal Bursary Bias (display 10), not Contextual.
    expect(gapGroupHeadingForCode(112)).toBe("7 – 10: Internal Bursary Bias");
    // 113 joins Contextual (display 13).
    expect(gapGroupHeadingForCode(113)).toBe("11 – 13: Contextual");
  });

  it("deprecated originals (1–10) and unknown codes bucket under Other", () => {
    expect(gapGroupHeadingForCode(1)).toBe("Other");
    expect(gapGroupHeadingForCode(10)).toBe("Other");
    expect(gapGroupHeadingForCode(999)).toBe("Other");
  });

  it("the ordered heading list ends with Other", () => {
    expect(GAP_CODE_GROUP_HEADINGS[GAP_CODE_GROUP_HEADINGS.length - 1]).toBe("Other");
    expect(GAP_CODE_GROUP_HEADINGS).toHaveLength(5);
  });

  // Guards the split-brain risk the append created: the grouping table and the
  // seed are two separate lists of the same codes, and nothing but this test
  // stops one drifting from the other.
  it("groups exactly the live (non-deprecated) seeded codes, with no strays", () => {
    const live = gapReasons.filter((g) => !g.isDeprecated).map((g) => g.code).sort((a, b) => a - b);
    const grouped = GAP_CODE_GROUPS.flatMap((g) => g.codes as readonly number[]).sort((a, b) => a - b);
    expect(grouped).toEqual(live);
  });

  // Her display numbering is now carried by sortOrder, not `code − 100`.
  it("sortOrder reproduces her 1–13 display numbering in her stated order", () => {
    const live = gapReasons.filter((g) => !g.isDeprecated);
    expect(live.map((g) => g.sortOrder).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    const bySort = [...live].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(bySort[9].label).toBe("Internal Bursary Bias - Acrimonious Separation");
    expect(bySort[10].label).toBe("Affordability Adjusted Calculation Preferred");
    expect(bySort[11].label).toBe("Theoretical Benchmark Calculation Preferred");
    expect(bySort[12].label).toBe("Immaterial gap, less than £100");
  });
});
