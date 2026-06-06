import { describe, it, expect } from "vitest";
import { isRollingOverApplication } from "@/lib/db/queries/reassessment";

describe("isRollingOverApplication (Epic 02 PR-4)", () => {
  it("ROLLING_OVER applicationType → true (ID section hidden)", () => {
    expect(
      isRollingOverApplication({ applicationType: "ROLLING_OVER", isReassessment: false })
    ).toBe(true);
  });
  it("NEW applicationType → false (full form incl. ID section)", () => {
    expect(
      isRollingOverApplication({ applicationType: "NEW", isReassessment: true })
    ).toBe(false);
  });
  it("falls back to isReassessment when applicationType is absent", () => {
    expect(isRollingOverApplication({ isReassessment: true })).toBe(true);
    expect(isRollingOverApplication({ isReassessment: false })).toBe(false);
    expect(isRollingOverApplication({})).toBe(false);
  });
  it("explicit applicationType wins over isReassessment", () => {
    // A NEW application must show the ID section even if isReassessment got set.
    expect(
      isRollingOverApplication({ applicationType: "NEW", isReassessment: true })
    ).toBe(false);
  });
});
