import { describe, it, expect } from "vitest";
import {
  categoryKeyForCode,
  categoryForCode,
  groupHeadingForCode,
  REASON_CODE_GROUP_HEADINGS,
} from "../category";
import { reasonCodes } from "../../../../prisma/seed-data/reason-codes";

describe("reason-code category util (Epic 08 / CALC-09)", () => {
  it("maps the new-list display-number ranges to their categories", () => {
    // Display number = DB code − 100
    expect(categoryKeyForCode(101)).toBe("circumstances"); // display 1
    expect(categoryKeyForCode(107)).toBe("circumstances"); // display 7
    expect(categoryKeyForCode(108)).toBe("income"); // display 8
    expect(categoryKeyForCode(121)).toBe("income"); // display 21
    expect(categoryKeyForCode(122)).toBe("property"); // display 22
    expect(categoryKeyForCode(127)).toBe("property"); // display 27
    expect(categoryKeyForCode(128)).toBe("documentation"); // display 28
    expect(categoryKeyForCode(131)).toBe("documentation"); // display 31
    expect(categoryKeyForCode(133)).toBe("fees"); // display 33
    expect(categoryKeyForCode(136)).toBe("fees"); // display 36
  });

  it("buckets display 32 (Other) and out-of-range new codes under Other", () => {
    expect(categoryKeyForCode(132)).toBe("other"); // display 32 "Other"
    expect(categoryKeyForCode(100)).toBe("other"); // display 0 — no such code
    expect(categoryKeyForCode(138)).toBe("other"); // display 38 — beyond list
    expect(categoryForCode(132)).toBe("Other");
  });

  it("buckets display 37 (her 6 Sep 2026 addition) under Fees & Adjustments", () => {
    expect(categoryKeyForCode(137)).toBe("fees");
    expect(categoryForCode(137)).toBe("Fees & Adjustments");
  });

  it("buckets legacy placeholder codes (< 100) under Legacy (deprecated)", () => {
    expect(categoryKeyForCode(1)).toBe("legacy");
    expect(categoryKeyForCode(14)).toBe("legacy");
    expect(categoryKeyForCode(35)).toBe("legacy");
    expect(categoryKeyForCode(99)).toBe("legacy");
    expect(categoryForCode(14)).toBe("Legacy (deprecated)");
  });

  it("exposes plain labels for the settings table", () => {
    expect(categoryForCode(103)).toBe("Circumstances");
    expect(categoryForCode(112)).toBe("Income & Employment");
    expect(categoryForCode(124)).toBe("Property & Assets");
    expect(categoryForCode(130)).toBe("Documentation & Compliance");
    expect(categoryForCode(134)).toBe("Fees & Adjustments");
  });

  it("exposes range-prefixed headings for the selector; Other and Legacy unprefixed", () => {
    expect(groupHeadingForCode(103)).toBe("1 – 7: Circumstances");
    // S18 (19 Sep 2026) — headings carry the ACTIVE (2xx) taxonomy's ranges.
    expect(groupHeadingForCode(208)).toBe("8 – 27: Income & Employment");
    expect(groupHeadingForCode(227)).toBe("28 – 35: Property & Assets");
    expect(groupHeadingForCode(234)).toBe("36 – 39: Documentation & Compliance");
    expect(groupHeadingForCode(238)).toBe("40 – 43: Fees & Adjustments");
    expect(groupHeadingForCode(132)).toBe("Other");
    expect(groupHeadingForCode(14)).toBe("Legacy (deprecated)");
  });

  it("the selector heading order matches the category order, Legacy last", () => {
    expect(REASON_CODE_GROUP_HEADINGS).toEqual([
      "1 – 7: Circumstances",
      "8 – 27: Income & Employment",
      "28 – 35: Property & Assets",
      "36 – 39: Documentation & Compliance",
      "40 – 43: Fees & Adjustments",
      "Other",
      "Legacy (deprecated)",
    ]);
    expect(REASON_CODE_GROUP_HEADINGS[REASON_CODE_GROUP_HEADINGS.length - 1]).toBe(
      "Legacy (deprecated)"
    );
  });
});

// ─── D4 (6 Sep 2026) — the definitive 201–241 generation ────────────────────

describe("D4 — the 2xx reason-code generation buckets by her regrouping", () => {
  it("boundary codes land in the right groups", () => {
    expect(categoryKeyForCode(201)).toBe("circumstances");
    expect(categoryKeyForCode(207)).toBe("circumstances");
    expect(categoryKeyForCode(208)).toBe("income");
    expect(categoryKeyForCode(226)).toBe("income");
    expect(categoryKeyForCode(227)).toBe("property");
    expect(categoryKeyForCode(233)).toBe("property");
    expect(categoryKeyForCode(234)).toBe("documentation");
    expect(categoryKeyForCode(237)).toBe("documentation");
    expect(categoryKeyForCode(238)).toBe("fees");
    expect(categoryKeyForCode(241)).toBe("fees"); // display 43 "Other" lives in Fees & Adjustments
    expect(categoryKeyForCode(244)).toBe("other"); // beyond her list
  });

  it("the retired 1xx generation keeps its own historic buckets", () => {
    expect(categoryKeyForCode(122)).toBe("property"); // old 22 – 27 range
    expect(categoryKeyForCode(226)).toBe("income"); // same display number, new range
    expect(categoryKeyForCode(132)).toBe("other"); // old display 32 "Other"
  });
});

// ─── S18 (19 Sep 2026) — 27 and 35 inserted, 27–41 renumbered to 28–43 ──────

describe("S18 — her two additions join the groups she put them in", () => {
  it("242 (27 - Major change in income) is Income & Employment", () => {
    expect(categoryKeyForCode(242)).toBe("income");
    expect(groupHeadingForCode(242)).toBe("8 – 27: Income & Employment");
  });

  it("243 (35 - Major change in assets) is Property & Assets", () => {
    expect(categoryKeyForCode(243)).toBe("property");
    expect(groupHeadingForCode(243)).toBe("28 – 35: Property & Assets");
  });

  it("every active seed row's display number falls inside its group's range", () => {
    const active = reasonCodes.filter((r) => !r.isDeprecated);
    expect(active).toHaveLength(43);
    for (const r of active) {
      const display = Number(r.label.split(" - ")[0]);
      expect(display).toBe(r.sortOrder);
      const [lo, hi] = groupHeadingForCode(r.code).split(":")[0].split(" – ").map(Number);
      expect(display, r.label).toBeGreaterThanOrEqual(lo);
      expect(display, r.label).toBeLessThanOrEqual(hi);
    }
    expect(active.map((r) => r.sortOrder).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 43 }, (_, i) => i + 1),
    );
  });
});
