import { describe, it, expect } from "vitest";
import {
  gapGroupHeadingForCode,
  GAP_CODE_GROUPS,
  GAP_CODE_GROUP_HEADINGS,
} from "../gap-category";
import { gapReasons } from "../../../../prisma/seed-data/gap-reasons";

// D4 (6 Sep 2026), extended 8 Sep 2026 — Charlotte's four gap-code groups,
// DB codes 101–119. Her two 8 Sep additions were appended (112 = Acrimonious
// Separation at display 10, 113 = Immaterial gap at display 13), so the groups
// are deliberately non-contiguous in code space. Her 7 Oct additions (114–117)
// extend Contextual; her batch-4 additions add 118 (Contextual) and 119
// (Pastoral, display 7), moving the later groups down one place.

describe("gap-code grouping", () => {
  it("buckets each display range under her group heading", () => {
    expect(gapGroupHeadingForCode(101)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(103)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(104)).toBe("4 – 7: Pastoral Leniency");
    expect(gapGroupHeadingForCode(107)).toBe("8 – 11: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(109)).toBe("8 – 11: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(110)).toBe("12 – 19: Contextual");
    expect(gapGroupHeadingForCode(111)).toBe("12 – 19: Contextual");
  });

  it("groups her 8 Sep additions despite their out-of-sequence codes", () => {
    // 112 joins Internal Bursary Bias (display 11 since batch 4), not Contextual.
    expect(gapGroupHeadingForCode(112)).toBe("8 – 11: Internal Bursary Bias");
    // 113 joins Contextual (display 14 since batch 4).
    expect(gapGroupHeadingForCode(113)).toBe("12 – 19: Contextual");
  });

  it("groups her 7 Oct additions (114–117) under Contextual", () => {
    for (const code of [114, 115, 116, 117]) {
      expect(gapGroupHeadingForCode(code)).toBe("12 – 19: Contextual");
    }
  });

  it("groups her batch-4 additions with their named groups", () => {
    expect(gapGroupHeadingForCode(119)).toBe("4 – 7: Pastoral Leniency");
    expect(gapGroupHeadingForCode(118)).toBe("12 – 19: Contextual");
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
  it("sortOrder reproduces her 1–19 display numbering in her stated order", () => {
    const live = gapReasons.filter((g) => !g.isDeprecated);
    expect(live.map((g) => g.sortOrder).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    const bySort = [...live].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(bySort[6].label).toBe("Pastoral Exceptional Leniency - Ukraine or war refugee scheme");
    expect(bySort[10].label).toBe("Internal Bursary Bias - Acrimonious Separation");
    expect(bySort[11].label).toBe("Affordability Adjusted Calculation Preferred");
    expect(bySort[12].label).toBe("Theoretical Benchmark Calculation Preferred");
    expect(bySort[13].label).toBe("Immaterial gap, less than £100");
    expect(bySort[14].label).toBe("Additional wealth outside the scope of direct family");
    expect(bySort[17].label).toBe("Multiple cash deposits seemingly undeclared");
    expect(bySort[18].label).toBe("Household at a financial crossroads for the better- award at risk");
  });
});
