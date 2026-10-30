import { describe, it, expect, vi } from "vitest";

import {
  getPortalScheduleAccountsForUser,
  getScheduleHomeForUser,
  hasPortalSchedule,
} from "../schedule";

/**
 * The portal-scoped schedule reads (gap F2, Epic 22 P5). The mocks assert the
 * `where` clauses rather than re-implementing Prisma — the same `vi.fn()` +
 * `as never` convention as the other unit-level query tests.
 */
type Args = Record<string, unknown>;

describe("getPortalScheduleAccountsForUser (Epic 22 P5)", () => {
  it("reads EVERY active account the parent leads, showOnPortal rows only", async () => {
    const findMany = vi.fn(async (_args: Args) => [
      { id: "acc-1", scheduleEntries: [{ scheduleYear: 1 }] },
      { id: "acc-2", scheduleEntries: [{ scheduleYear: 1 }, { scheduleYear: 2 }] },
    ]);
    const accounts = await getPortalScheduleAccountsForUser(
      { bursaryAccount: { findMany } } as never,
      "user-1"
    );
    expect(accounts.map((a) => a.id)).toEqual(["acc-1", "acc-2"]);
    const args = findMany.mock.calls[0]![0] as {
      where: Args;
      select: { scheduleEntries: { where: Args } };
    };
    expect(args.where).toEqual({ leadApplicantId: "user-1", status: "ACTIVE" });
    expect(args.select.scheduleEntries.where).toEqual({ showOnPortal: true });
  });

  it("leaves out an account with nothing shown to the family", async () => {
    const findMany = vi.fn(async (_args: Args) => [
      { id: "acc-1", scheduleEntries: [] },
      { id: "acc-2", scheduleEntries: [{ scheduleYear: 1 }] },
    ]);
    const accounts = await getPortalScheduleAccountsForUser(
      { bursaryAccount: { findMany } } as never,
      "user-1"
    );
    expect(accounts.map((a) => a.id)).toEqual(["acc-2"]);
  });
});

describe("hasPortalSchedule", () => {
  function tx(count: number) {
    const fn = vi.fn(async (_args: Args) => count);
    return { tx: { bursaryScheduleEntry: { count: fn } } as never, fn };
  }

  it("counts visible rows across ALL the parent's active accounts", async () => {
    const { tx: t, fn } = tx(2);
    expect(await hasPortalSchedule(t, "user-1")).toBe(true);
    expect(fn.mock.calls[0]![0]).toEqual({
      where: {
        showOnPortal: true,
        bursaryAccount: { leadApplicantId: "user-1", status: "ACTIVE" },
      },
    });
  });

  it("is false with no visible row", async () => {
    expect(await hasPortalSchedule(tx(0).tx, "user-1")).toBe(false);
  });
});

describe("getScheduleHomeForUser — show-on-portal (Epic 21 #5)", () => {
  it("asks only for the rows the admin has left shown to the family", async () => {
    const findMany = vi.fn(async (_args: Args) => []);
    await getScheduleHomeForUser({ bursaryAccount: { findMany } } as never, "user-1");
    const args = findMany.mock.calls[0]![0] as {
      where: Args;
      select: { scheduleEntries: { where: Args } };
    };
    expect(args.where).toEqual({ leadApplicantId: "user-1", status: "ACTIVE" });
    expect(args.select.scheduleEntries.where).toEqual({ showOnPortal: true });
  });
});
