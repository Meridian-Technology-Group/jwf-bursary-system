import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ withAdminContext: vi.fn() }));

import {
  defaultSecondParentDeadline,
  isSecondParentDeadlinePassed,
} from "../second-parent-deadline";

// Charlotte, 26 Nov 2026 (Option 1): the second parent gets their own deadline,
// 7 days from the link by default, independent of the lead's.
const application = { submissionDeadlineAt: new Date("2026-11-20T23:59:59.999Z"), applicationType: "NEW" as const };
const round = {
  closeDate: new Date("2026-11-30T00:00:00Z"),
  defaultSubmissionDeadlineNew: null,
  defaultSubmissionDeadlineRolling: null,
  windows: [],
};

describe("defaultSecondParentDeadline", () => {
  it("is the end of the London day 7 days on (GMT)", () => {
    expect(defaultSecondParentDeadline(new Date("2026-11-26T10:00:00Z")).toISOString()).toBe(
      "2026-12-03T23:59:59.999Z"
    );
  });
  it("follows London time in summer (BST)", () => {
    expect(defaultSecondParentDeadline(new Date("2026-06-01T23:30:00Z")).toISOString()).toBe(
      // 00:30 BST on 2 Jun → 9 Jun, 23:59:59.999 BST
      "2026-06-09T22:59:59.999Z"
    );
  });
});

describe("isSecondParentDeadlinePassed", () => {
  const now = new Date("2026-11-26T12:00:00Z");

  it("their own deadline wins over an application deadline that has passed", () => {
    expect(
      isSecondParentDeadlinePassed(new Date("2026-12-03T23:59:59.999Z"), application, round, now)
    ).toBe(false);
  });

  it("their own deadline locks them once it has passed", () => {
    expect(
      isSecondParentDeadlinePassed(new Date("2026-11-25T23:59:59.999Z"), application, round, now)
    ).toBe(true);
  });

  it("no own deadline falls back to the application's", () => {
    expect(isSecondParentDeadlinePassed(null, application, round, now)).toBe(true);
  });
});
