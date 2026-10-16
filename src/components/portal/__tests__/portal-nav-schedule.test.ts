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
 * Gap F2 — the "Application Schedule" calendar nav item is shown ONLY for an
 * ACTIVE family with a portal-visible schedule (`hasSchedule`), using the same
 * conditional-visibility mechanism as the Missing Documents item. First-year
 * applicants (no schedule) never see it. `buildPortalNav` is pure, so we test
 * the membership directly rather than rendering the rail.
 */
const hasScheduleItem = (items: { href: string }[]) =>
  items.some((i) => i.href === "/schedule");

describe("buildPortalNav — Application Schedule item (gap F2)", () => {
  it("HIDES the calendar for a family with no schedule", () => {
    const items = buildPortalNav(false, false);
    expect(hasScheduleItem(items)).toBe(false);
  });

  it("SHOWS the calendar for an ACTIVE, scheduled family", () => {
    const items = buildPortalNav(false, true);
    expect(hasScheduleItem(items)).toBe(true);

    const item = items.find((i) => i.href === "/schedule")!;
    expect(item.label).toBe("My Application(s) Schedule");
    expect(item.match).toBe("/schedule");
    // Read-only link — no `highlight` CTA styling (that's Missing Documents).
    expect("highlight" in item).toBe(false);
  });

  it("defaults to hidden when the schedule flag is omitted", () => {
    const items = buildPortalNav();
    expect(hasScheduleItem(items)).toBe(false);
  });

  it("is independent of the Missing Documents item", () => {
    // Both conditional items can be present together.
    const items = buildPortalNav(true, true);
    expect(hasScheduleItem(items)).toBe(true);
    expect(items.some((i) => i.href === "/respond")).toBe(true);
  });
});

describe("buildPortalNav — My Bursary Application(s) (Epic 22 P1, D-8)", () => {
  it("replaces My Application with the per-child list", () => {
    const items = buildPortalNav();
    const item = items.find((i) => i.href === "/my-applications")!;
    expect(item.label).toBe("My Bursary Application(s)");
    expect(item.alsoMatch).toEqual(["/apply", "/status", "/submitted"]);
    expect(items.some((i) => i.label === "My Application")).toBe(false);
  });

  it("keeps Missing Documents above it while paused", () => {
    const labels = buildPortalNav(true).map((i) => i.label);
    expect(labels.indexOf("Missing Documents")).toBeLessThan(
      labels.indexOf("My Bursary Application(s)")
    );
  });
});

/**
 * Epic 23 T3 (her 16 Oct decision 5): the parent Documents page is gone —
 * uploads follow the retention rules and there is no historical uploads page.
 * The flags cover every state: draft / submitted (neither), paused (needsDocs),
 * an active or migrated family (hasSchedule), and paused + scheduled.
 */
describe("buildPortalNav — no Documents item (Epic 23 T3)", () => {
  it.each([
    ["draft or submitted", false, false],
    ["paused", true, false],
    ["active or migrated, scheduled", false, true],
    ["paused and scheduled", true, true],
  ])("%s: no Documents link", (_state, needsDocs, hasSchedule) => {
    const items = buildPortalNav(needsDocs, hasSchedule);
    expect(items.some((i) => i.href === "/documents" || /^documents$/i.test(i.label))).toBe(false);
    expect(items.map((i) => i.href)).toContain("/help");
  });

  it("the paused case still reaches /respond through Missing Documents", () => {
    const missing = buildPortalNav(true, false).find((i) => i.href === "/respond");
    expect(missing?.highlight).toBe(true);
  });
});
