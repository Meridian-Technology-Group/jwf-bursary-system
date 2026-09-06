import { describe, it, expect } from "vitest";
import {
  categoryKeyForCode,
  categoryForCode,
  groupHeadingForCode,
  REASON_CODE_GROUP_HEADINGS,
} from "../category";

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
    // D4 (6 Sep 2026) — headings carry the ACTIVE (2xx) taxonomy's ranges.
    expect(groupHeadingForCode(208)).toBe("8 – 26: Income & Employment");
    expect(groupHeadingForCode(227)).toBe("27 – 33: Property & Assets");
    expect(groupHeadingForCode(234)).toBe("34 – 37: Documentation & Compliance");
    expect(groupHeadingForCode(238)).toBe("38 – 41: Fees & Adjustments");
    expect(groupHeadingForCode(132)).toBe("Other");
    expect(groupHeadingForCode(14)).toBe("Legacy (deprecated)");
  });

  it("the selector heading order matches the category order, Legacy last", () => {
    expect(REASON_CODE_GROUP_HEADINGS).toEqual([
      "1 – 7: Circumstances",
      "8 – 26: Income & Employment",
      "27 – 33: Property & Assets",
      "34 – 37: Documentation & Compliance",
      "38 – 41: Fees & Adjustments",
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
    expect(categoryKeyForCode(241)).toBe("fees"); // display 41 "Other" lives in Fees & Adjustments
    expect(categoryKeyForCode(242)).toBe("other"); // beyond her list
  });

  it("the retired 1xx generation keeps its own historic buckets", () => {
    expect(categoryKeyForCode(122)).toBe("property"); // old 22 – 27 range
    expect(categoryKeyForCode(226)).toBe("income"); // same display number, new range
    expect(categoryKeyForCode(132)).toBe("other"); // old display 32 "Other"
  });
});
