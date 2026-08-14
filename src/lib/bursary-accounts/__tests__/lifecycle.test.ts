import { describe, it, expect, vi } from "vitest";
import {
  isScheduleComplete,
  closeAccountIfComplete,
  mirrorApplicationToSchedule,
  reopenAccountForAssessmentYear,
} from "../lifecycle";

describe("isScheduleComplete", () => {
  it("false for an empty schedule (never auto-close on emptiness)", () => {
    expect(isScheduleComplete([])).toBe(false);
  });

  it("false while any row is not COMPLETE", () => {
    expect(isScheduleComplete(["COMPLETE", "RECEIVED"])).toBe(false);
    expect(isScheduleComplete(["COMPLETE", "SCHEDULED"])).toBe(false);
  });

  it("true when every row is COMPLETE", () => {
    expect(isScheduleComplete(["COMPLETE", "COMPLETE"])).toBe(true);
  });
});

function makeTx(account: {
  status: string;
  statuses: string[];
} | null) {
  return {
    bursaryAccount: {
      findUnique: vi.fn(async () =>
        account
          ? {
              status: account.status,
              scheduleEntries: account.statuses.map((s) => ({ status: s })),
            }
          : null
      ),
      update: vi.fn(async () => ({})),
    },
  };
}

describe("closeAccountIfComplete", () => {
  const NOW = new Date("2026-06-06T00:00:00.000Z");

  it("closes an ACTIVE account whose schedule is fully complete", async () => {
    const tx = makeTx({ status: "ACTIVE", statuses: ["COMPLETE", "COMPLETE"] });
    const res = await closeAccountIfComplete(tx as never, "acc-1", NOW);
    expect(res.closed).toBe(true);
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { status: "CLOSED", closedAt: NOW },
    });
  });

  it("does not close while a row is still pending", async () => {
    const tx = makeTx({ status: "ACTIVE", statuses: ["COMPLETE", "RECEIVED"] });
    const res = await closeAccountIfComplete(tx as never, "acc-1", NOW);
    expect(res.closed).toBe(false);
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
  });

  it("is idempotent — already-CLOSED accounts are untouched", async () => {
    const tx = makeTx({ status: "CLOSED", statuses: ["COMPLETE"] });
    const res = await closeAccountIfComplete(tx as never, "acc-1", NOW);
    expect(res.closed).toBe(false);
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
  });

  it("no-op for a missing account", async () => {
    const tx = makeTx(null);
    const res = await closeAccountIfComplete(tx as never, "acc-x", NOW);
    expect(res.closed).toBe(false);
  });
});

function makeMirrorTx(entry: { id: string; status: string } | null) {
  return {
    bursaryScheduleEntry: {
      findFirst: vi.fn(async () => entry),
      update: vi.fn(async () => ({})),
    },
  };
}

describe("mirrorApplicationToSchedule", () => {
  it("marks a matching year RECEIVED + links app/round", async () => {
    const tx = makeMirrorTx({ id: "e1", status: "SCHEDULED" });
    const id = await mirrorApplicationToSchedule(tx as never, {
      bursaryAccountId: "acc-1",
      academicYear: "2027-28",
      applicationId: "app-2",
      roundId: "round-2",
      status: "RECEIVED",
      receivedOn: new Date("2027-10-01"),
    });
    expect(id).toBe("e1");
    expect(tx.bursaryScheduleEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1" },
        data: expect.objectContaining({
          status: "RECEIVED",
          applicationId: "app-2",
          roundId: "round-2",
        }),
      })
    );
  });

  it("returns null when no schedule row matches the year", async () => {
    const tx = makeMirrorTx(null);
    const id = await mirrorApplicationToSchedule(tx as never, {
      bursaryAccountId: "acc-1",
      academicYear: "2099-00",
      applicationId: "app-2",
      roundId: "round-2",
      status: "RECEIVED",
    });
    expect(id).toBeNull();
    expect(tx.bursaryScheduleEntry.update).not.toHaveBeenCalled();
  });

  it("never moves a COMPLETE row back to RECEIVED", async () => {
    const tx = makeMirrorTx({ id: "e1", status: "COMPLETE" });
    const id = await mirrorApplicationToSchedule(tx as never, {
      bursaryAccountId: "acc-1",
      academicYear: "2027-28",
      applicationId: "app-2",
      roundId: "round-2",
      status: "RECEIVED",
    });
    expect(id).toBe("e1");
    expect(tx.bursaryScheduleEntry.update).not.toHaveBeenCalled();
  });
});

// ─── Reopen (Epic 13 / C1) ────────────────────────────────────────────────────

function makeReopenTx(
  entry: { id: string; status: string } | null,
  accountStatus: string
) {
  return {
    bursaryScheduleEntry: {
      findFirst: vi.fn(async () => entry),
      update: vi.fn(async () => ({})),
    },
    bursaryAccount: {
      findUnique: vi.fn(async () => ({ status: accountStatus })),
      update: vi.fn(async () => ({})),
    },
  };
}

describe("reopenAccountForAssessmentYear", () => {
  const PARAMS = { bursaryAccountId: "acc-1", academicYear: "2026-27" };

  it("moves the year's COMPLETE entry back to RECEIVED", async () => {
    const tx = makeReopenTx({ id: "e1", status: "COMPLETE" }, "ACTIVE");
    const res = await reopenAccountForAssessmentYear(tx as never, PARAMS);
    expect(res.scheduleEntryReopened).toBe(true);
    expect(tx.bursaryScheduleEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { status: "RECEIVED" },
    });
  });

  it("un-closes an account that this year's completion had auto-closed", async () => {
    const tx = makeReopenTx({ id: "e1", status: "COMPLETE" }, "CLOSED");
    const res = await reopenAccountForAssessmentYear(tx as never, PARAMS);
    expect(res).toEqual({ scheduleEntryReopened: true, accountReopened: true });
    // The documented exception to set-once closedAt: it is CLEARED, not
    // back-dated — the account is genuinely no longer closed.
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { status: "ACTIVE", closedAt: null },
    });
  });

  it("leaves a CLOSED account alone when this year had nothing to reverse", async () => {
    // No COMPLETE entry for this year ⇒ the close came from somewhere else
    // (an admin manual close, or another year). Not ours to undo.
    const tx = makeReopenTx({ id: "e1", status: "RECEIVED" }, "CLOSED");
    const res = await reopenAccountForAssessmentYear(tx as never, PARAMS);
    expect(res).toEqual({
      scheduleEntryReopened: false,
      accountReopened: false,
    });
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
    expect(tx.bursaryScheduleEntry.update).not.toHaveBeenCalled();
  });

  it("no-ops when the account has no schedule entry for that year", async () => {
    const tx = makeReopenTx(null, "ACTIVE");
    const res = await reopenAccountForAssessmentYear(tx as never, PARAMS);
    expect(res).toEqual({
      scheduleEntryReopened: false,
      accountReopened: false,
    });
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
  });

  it("leaves an ACTIVE account active after reverting the entry", async () => {
    const tx = makeReopenTx({ id: "e1", status: "COMPLETE" }, "ACTIVE");
    const res = await reopenAccountForAssessmentYear(tx as never, PARAMS);
    expect(res.accountReopened).toBe(false);
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
  });
});
