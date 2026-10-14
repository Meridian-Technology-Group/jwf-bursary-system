import { describe, it, expect } from "vitest";
import { portalHomeMain } from "@/lib/portal/home-state";

describe("portalHomeMain (Epic 21 T1 / WP-F1)", () => {
  it("shows the application whenever there is one, schedule or not", () => {
    expect(
      portalHomeMain({ hasApplication: true, hasInvitation: true, hasSchedule: true })
    ).toBe("application");
    expect(
      portalHomeMain({ hasApplication: true, hasInvitation: false, hasSchedule: false })
    ).toBe("application");
  });

  it("shows the chooser for an invited family with no application yet", () => {
    expect(
      portalHomeMain({ hasApplication: false, hasInvitation: true, hasSchedule: true })
    ).toBe("invitation");
    expect(
      portalHomeMain({ hasApplication: false, hasInvitation: true, hasSchedule: false })
    ).toBe("invitation");
  });

  it("shows nothing more for a family with a schedule but no application or invitation (migrated / between rounds)", () => {
    expect(
      portalHomeMain({ hasApplication: false, hasInvitation: false, hasSchedule: true })
    ).toBe("none");
  });

  it("still shows 'No invitation found' to a parent with nothing at all", () => {
    expect(
      portalHomeMain({ hasApplication: false, hasInvitation: false, hasSchedule: false })
    ).toBe("no-invitation");
  });
});

import {
  activeBursariesText,
  homeHeading,
  homeVariant,
} from "@/lib/portal/home-state";

describe("homeVariant / heading / count (Epic 22 P4)", () => {
  it("a family with an active bursary gets the rolling-over version", () => {
    expect(homeVariant({ activeAccounts: 3 })).toBe("rolling-over");
    expect(homeHeading("rolling-over", "Pat")).toBe("Welcome back, Pat");
    expect(activeBursariesText(3)).toBe(
      "You currently have 3 active bursaries with the John Whitgift Foundation."
    );
  });

  it("one bursary is singular", () => {
    expect(activeBursariesText(1)).toBe(
      "You currently have 1 active bursary with the John Whitgift Foundation."
    );
  });

  it("a family with no active account gets the new version", () => {
    expect(homeVariant({ activeAccounts: 0 })).toBe("new");
    expect(homeHeading("new", "Pat")).toBe("Welcome, Pat");
    expect(activeBursariesText(0)).toBe("You currently do not have an active bursary.");
  });
});
