import { describe, it, expect } from "vitest";
import {
  gapGroupHeadingForCode,
  GAP_CODE_GROUP_HEADINGS,
} from "../gap-category";

// D4 (6 Sep 2026) — Charlotte's four gap-code groups, DB codes 101–111.

describe("gap-code grouping", () => {
  it("buckets each display range under her group heading", () => {
    expect(gapGroupHeadingForCode(101)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(103)).toBe("1 – 3: External");
    expect(gapGroupHeadingForCode(104)).toBe("4 – 6: Pastoral Leniency");
    expect(gapGroupHeadingForCode(107)).toBe("7 – 9: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(109)).toBe("7 – 9: Internal Bursary Bias");
    expect(gapGroupHeadingForCode(110)).toBe("10 – 11: Contextual");
    expect(gapGroupHeadingForCode(111)).toBe("10 – 11: Contextual");
  });

  it("deprecated originals (1–10) and out-of-range codes bucket under Other", () => {
    expect(gapGroupHeadingForCode(1)).toBe("Other");
    expect(gapGroupHeadingForCode(10)).toBe("Other");
    expect(gapGroupHeadingForCode(112)).toBe("Other");
  });

  it("the ordered heading list ends with Other", () => {
    expect(GAP_CODE_GROUP_HEADINGS[GAP_CODE_GROUP_HEADINGS.length - 1]).toBe("Other");
    expect(GAP_CODE_GROUP_HEADINGS).toHaveLength(5);
  });
});
