import { describe, it, expect, vi } from "vitest";

import {
  getPortalScheduleForUser,
  hasPortalSchedule,
} from "../schedule";

/**
 * Gap F2 — the portal-scoped schedule read. Verifies the query asks Prisma for
 * ONLY `showOnPortal` rows of the user's own ACTIVE account, and returns just
 * the calendar fields (no application/round/assessment data). The mock asserts
 * the `where` clause rather than re-implementing Prisma — the same `vi.fn()` +
 * `as never` convention as the other unit-level query tests.
 */
type Args = Record<string, unknown>;

function makeTx(account: unknown) {
  const findFirst = vi.fn(async (_args: Args) => account);
  const count = vi.fn(async (_args: Args) => (account ? 2 : 0));
  return {
    tx: {
      bursaryAccount: { findFirst },
      bursaryScheduleEntry: { count },
    } as never,
    findFirst,
    count,
  };
}

describe("getPortalScheduleForUser", () => {
  it("scopes to the user's ACTIVE account and filters to showOnPortal rows only", async () => {
    const { tx, findFirst } = makeTx({
      id: "acc-1",
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      scheduleEntries: [
        { scheduleYear: 1, academicYear: "2026-27" },
        { scheduleYear: 2, academicYear: "2027-28" },
      ],
    });

    const data = await getPortalScheduleForUser(tx, "user-1");

    // Account scoped to lead applicant + ACTIVE.
    const args = findFirst.mock.calls[0][0] as {
      where: unknown;
      select: {
        scheduleEntries: { where: unknown; select: Record<string, unknown> };
      };
    };
    expect(args.where).toEqual({ leadApplicantId: "user-1", status: "ACTIVE" });
    // The schedule-entry relation is filtered to showOnPortal === true.
    expect(args.select.scheduleEntries.where).toEqual({ showOnPortal: true });
    // Only calendar fields are selected (no application/round/assessment).
    expect(Object.keys(args.select.scheduleEntries.select).sort()).toEqual([
      "academicYear",
      "scheduleYear",
    ]);

    expect(data).toEqual({
      bursaryAccountId: "acc-1",
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      visibleEntries: [
        { scheduleYear: 1, academicYear: "2026-27" },
        { scheduleYear: 2, academicYear: "2027-28" },
      ],
    });
  });

  it("returns null when the user has no ACTIVE account", async () => {
    const { tx } = makeTx(null);
    expect(await getPortalScheduleForUser(tx, "user-1")).toBeNull();
  });
});

describe("hasPortalSchedule", () => {
  it("counts only showOnPortal rows on the user's ACTIVE account", async () => {
    const { tx, count } = makeTx({ id: "acc-1" });
    const result = await hasPortalSchedule(tx, "user-1");

    expect(result).toBe(true);
    expect(count.mock.calls[0][0]).toEqual({
      where: {
        showOnPortal: true,
        bursaryAccount: { leadApplicantId: "user-1", status: "ACTIVE" },
      },
    });
  });

  it("is false when there are no portal-visible rows", async () => {
    const { tx } = makeTx(null);
    expect(await hasPortalSchedule(tx, "user-1")).toBe(false);
  });
});
