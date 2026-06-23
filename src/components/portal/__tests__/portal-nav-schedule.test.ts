import { describe, it, expect, vi } from "vitest";

// `portal-nav.tsx` is a "use client" module that imports `usePathname` at module
// load (and renders the RailStepper/account footer). We mock `next/navigation`
// so the pure `buildPortalNav` export can be imported and asserted in this
// no-jsdom/RTL repo — the same convention as rail-stepper-gate.test.ts.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { buildPortalNav } from "../portal-nav";

/**
 * Gap F2 — the "Assessment Schedule" calendar nav item is shown ONLY for an
 * ACTIVE family with a portal-visible schedule (`hasSchedule`), using the same
 * conditional-visibility mechanism as the Missing Documents item. First-year
 * applicants (no schedule) never see it. `buildPortalNav` is pure, so we test
 * the membership directly rather than rendering the rail.
 */
const hasScheduleItem = (items: { href: string }[]) =>
  items.some((i) => i.href === "/schedule");

describe("buildPortalNav — Assessment Schedule item (gap F2)", () => {
  it("HIDES the calendar for a family with no schedule", () => {
    const items = buildPortalNav("/apply/child-details", false, false);
    expect(hasScheduleItem(items)).toBe(false);
  });

  it("SHOWS the calendar for an ACTIVE, scheduled family", () => {
    const items = buildPortalNav("/status", false, true);
    expect(hasScheduleItem(items)).toBe(true);

    const item = items.find((i) => i.href === "/schedule")!;
    expect(item.label).toBe("Assessment Schedule");
    expect(item.match).toBe("/schedule");
    // Read-only link — no `highlight` CTA styling (that's Missing Documents).
    expect("highlight" in item).toBe(false);
  });

  it("defaults to hidden when the schedule flag is omitted", () => {
    const items = buildPortalNav("/apply/child-details");
    expect(hasScheduleItem(items)).toBe(false);
  });

  it("is independent of the Missing Documents item", () => {
    // Both conditional items can be present together.
    const items = buildPortalNav("/status", true, true);
    expect(hasScheduleItem(items)).toBe(true);
    expect(items.some((i) => i.href === "/respond")).toBe(true);
  });
});
