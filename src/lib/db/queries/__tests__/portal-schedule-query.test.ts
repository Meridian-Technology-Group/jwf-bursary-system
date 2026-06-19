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
  return {
    tx: {
      bursaryAccount: { findFirst },
    } as never,
    findFirst,
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
  it("is true when the resolved ACTIVE account has ≥1 portal-visible entry", async () => {
    const { tx, findFirst } = makeTx({
      id: "acc-1",
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      scheduleEntries: [{ scheduleYear: 1, academicYear: "2026-27" }],
    });

    expect(await hasPortalSchedule(tx, "user-1")).toBe(true);
    // Resolves the SAME account the page loader would (scoped + showOnPortal).
    const args = findFirst.mock.calls[0][0] as {
      where: unknown;
      select: { scheduleEntries: { where: unknown } };
    };
    expect(args.where).toEqual({ leadApplicantId: "user-1", status: "ACTIVE" });
    expect(args.select.scheduleEntries.where).toEqual({ showOnPortal: true });
  });

  it("is false when the user has no ACTIVE account", async () => {
    const { tx } = makeTx(null);
    expect(await hasPortalSchedule(tx, "user-1")).toBe(false);
  });

  it("is false when the resolved account has NO portal-visible entries", async () => {
    // An ACTIVE account exists but its showOnPortal entries are empty — the nav
    // gate must NOT show the calendar (the page would redirect to an empty view).
    const { tx } = makeTx({
      id: "acc-1",
      entryYearGroup: "Y7",
      firstAssessmentYear: "2026/2027",
      scheduleEntries: [],
    });
    expect(await hasPortalSchedule(tx, "user-1")).toBe(false);
  });
});

describe("gate vs loader agree on the same account (siblings edge case)", () => {
  // A lead applicant with MORE THAN ONE ACTIVE account (e.g. one per sibling).
  // findFirst applies the deterministic ordering; whichever account it returns,
  // BOTH the loader and the gate must read the SAME one — never disagree.
  const newestAccount = {
    id: "acc-newest",
    entryYearGroup: "Y9",
    firstAssessmentYear: "2027/2028",
    // The deterministically-resolved (newest) account has no portal entries.
    scheduleEntries: [],
  };

  it("hasPortalSchedule and getPortalScheduleForUser read the SAME resolved account", async () => {
    // Same fixture drives both queries, so they cannot pick different accounts.
    const gate = makeTx(newestAccount);
    const loader = makeTx(newestAccount);

    const gateShows = await hasPortalSchedule(gate.tx, "user-1");
    const loaded = await getPortalScheduleForUser(loader.tx, "user-1");

    // Both resolve the SAME account id.
    expect(loaded?.bursaryAccountId).toBe("acc-newest");
    // The page would render an EMPTY calendar (no visible entries) → the gate
    // must HIDE the nav item. Agreement: gate shown IFF loaded calendar non-empty.
    expect(loaded?.visibleEntries.length).toBe(0);
    expect(gateShows).toBe(false);

    // Both used the IDENTICAL deterministic ordering, so the DB returns one
    // fixed account to each query rather than two different siblings.
    const gateOrder = (gate.findFirst.mock.calls[0][0] as { orderBy: unknown })
      .orderBy;
    const loaderOrder = (
      loader.findFirst.mock.calls[0][0] as { orderBy: unknown }
    ).orderBy;
    expect(gateOrder).toEqual(loaderOrder);
    expect(gateOrder).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("when the resolved account HAS visible entries, the gate shows it too", async () => {
    const scheduled = {
      ...newestAccount,
      scheduleEntries: [{ scheduleYear: 1, academicYear: "2027-28" }],
    };
    const gate = makeTx(scheduled);
    const loader = makeTx(scheduled);

    const loaded = await getPortalScheduleForUser(loader.tx, "user-1");
    expect(loaded?.visibleEntries.length).toBeGreaterThan(0);
    expect(await hasPortalSchedule(gate.tx, "user-1")).toBe(true);
  });
});
