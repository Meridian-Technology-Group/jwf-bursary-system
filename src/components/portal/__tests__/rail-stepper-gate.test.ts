import { describe, expect, it, vi } from "vitest";

// `rail-stepper.tsx` is a "use client" module that imports `usePathname` and
// `useStepperData` (React context) at module load. We mock those so the pure
// `isApplyRoute` gate can be imported and asserted in this no-jsdom/RTL repo —
// same convention as section-form.test.tsx (unit-test the extracted pure logic
// rather than render the component).
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { isApplyRoute } from "../rail-stepper";

/**
 * The pathname gate is the correctness guarantee for defect #4 (the section
 * stepper persisting on Home/Help/Documents after a soft-nav out of /apply/*).
 * The old `@stepper/default.tsx → null` only fell back on HARD nav; this gate
 * hides the stepper on EVERY non-wizard route regardless of any stale store
 * value, on soft-nav too.
 */
describe("isApplyRoute — the route gate that scopes the rail stepper to the wizard (#4)", () => {
  it("matches the wizard index and section routes", () => {
    expect(isApplyRoute("/apply")).toBe(true);
    expect(isApplyRoute("/apply/child-details")).toBe(true);
    expect(isApplyRoute("/apply/household")).toBe(true);
    expect(isApplyRoute("/apply/review")).toBe(true);
  });

  it("does NOT match the portal routes the stepper was leaking onto (#4)", () => {
    expect(isApplyRoute("/")).toBe(false);
    expect(isApplyRoute("/help")).toBe(false);
    expect(isApplyRoute("/documents")).toBe(false);
    expect(isApplyRoute("/history")).toBe(false);
    expect(isApplyRoute("/status")).toBe(false);
  });

  it("does NOT match a sibling route that merely shares the /apply prefix", () => {
    // Guard against a naive startsWith("/apply") that would also match e.g.
    // a hypothetical "/apply-guidance" route.
    expect(isApplyRoute("/apply-guidance")).toBe(false);
    expect(isApplyRoute("/applyx")).toBe(false);
  });

  it("treats a null pathname as off-route (renders nothing)", () => {
    expect(isApplyRoute(null)).toBe(false);
  });
});
