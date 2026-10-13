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
