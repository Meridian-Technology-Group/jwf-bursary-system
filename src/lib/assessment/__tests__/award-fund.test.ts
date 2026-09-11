import { describe, it, expect } from "vitest";
import {
  awardFundOptionsForSchool,
  isAwardFundValidForSchool,
} from "../award-fund";

// Epic 18b — Charlotte, 6 Sep 2026: Whitgift = JWF / WSP-JWF / WFA;
// Trinity = JWF / TBF.

describe("award fund options", () => {
  it("Whitgift offers JWF, WSP-JWF and WFA", () => {
    expect(awardFundOptionsForSchool("WHITGIFT")).toEqual(["JWF", "WSP_JWF", "WFA"]);
  });

  it("Trinity offers JWF and TBF", () => {
    expect(awardFundOptionsForSchool("TRINITY")).toEqual(["JWF", "TBF"]);
  });

  it("validates fund-school pairs", () => {
    expect(isAwardFundValidForSchool("TBF", "TRINITY")).toBe(true);
    expect(isAwardFundValidForSchool("TBF", "WHITGIFT")).toBe(false);
    expect(isAwardFundValidForSchool("WFA", "TRINITY")).toBe(false);
    expect(isAwardFundValidForSchool("JWF", "WHITGIFT")).toBe(true);
    expect(isAwardFundValidForSchool("JWF", "TRINITY")).toBe(true);
  });
});
