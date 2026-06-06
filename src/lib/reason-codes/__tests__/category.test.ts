import { describe, it, expect } from "vitest";
import {
  categoryKeyForCode,
  categoryForCode,
  groupHeadingForCode,
  REASON_CODE_GROUP_HEADINGS,
} from "../category";

describe("reason-code category util (Epic 08)", () => {
  it("maps the four numeric ranges to their categories", () => {
    expect(categoryKeyForCode(1)).toBe("income");
    expect(categoryKeyForCode(9)).toBe("income");
    expect(categoryKeyForCode(10)).toBe("property");
    expect(categoryKeyForCode(19)).toBe("property");
    expect(categoryKeyForCode(20)).toBe("family");
    expect(categoryKeyForCode(29)).toBe("family");
    expect(categoryKeyForCode(30)).toBe("risk");
    expect(categoryKeyForCode(39)).toBe("risk");
  });

  it("falls back to Other outside the known ranges", () => {
    expect(categoryKeyForCode(0)).toBe("other");
    expect(categoryKeyForCode(40)).toBe("other");
    expect(categoryForCode(99)).toBe("Other");
  });

  it("exposes plain labels for the settings table", () => {
    expect(categoryForCode(3)).toBe("Income");
    expect(categoryForCode(12)).toBe("Property & Assets");
    expect(categoryForCode(22)).toBe("Family Circumstances");
    expect(categoryForCode(33)).toBe("Risk Flags");
  });

  it("exposes range-prefixed headings for the selector, Other unprefixed", () => {
    expect(groupHeadingForCode(3)).toBe("1 – 9: Income");
    expect(groupHeadingForCode(35)).toBe("30 – 39: Risk Flags");
    expect(groupHeadingForCode(50)).toBe("Other");
  });

  it("the selector heading order matches the category order", () => {
    expect(REASON_CODE_GROUP_HEADINGS).toEqual([
      "1 – 9: Income",
      "10 – 19: Property & Assets",
      "20 – 29: Family Circumstances",
      "30 – 39: Risk Flags",
      "Other",
    ]);
  });
});
