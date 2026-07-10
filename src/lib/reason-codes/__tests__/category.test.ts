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
    expect(categoryKeyForCode(137)).toBe("other"); // display 37 — beyond list
    expect(categoryForCode(132)).toBe("Other");
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
    expect(groupHeadingForCode(108)).toBe("8 – 21: Income & Employment");
    expect(groupHeadingForCode(125)).toBe("22 – 27: Property & Assets");
    expect(groupHeadingForCode(129)).toBe("28 – 31: Documentation & Compliance");
    expect(groupHeadingForCode(135)).toBe("33 – 36: Fees & Adjustments");
    expect(groupHeadingForCode(132)).toBe("Other");
    expect(groupHeadingForCode(14)).toBe("Legacy (deprecated)");
  });

  it("the selector heading order matches the category order, Legacy last", () => {
    expect(REASON_CODE_GROUP_HEADINGS).toEqual([
      "1 – 7: Circumstances",
      "8 – 21: Income & Employment",
      "22 – 27: Property & Assets",
      "28 – 31: Documentation & Compliance",
      "33 – 36: Fees & Adjustments",
      "Other",
      "Legacy (deprecated)",
    ]);
    expect(REASON_CODE_GROUP_HEADINGS[REASON_CODE_GROUP_HEADINGS.length - 1]).toBe(
      "Legacy (deprecated)"
    );
  });
});
