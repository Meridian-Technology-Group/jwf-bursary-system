import { describe, it, expect, vi } from "vitest";
import {
  isScheduleComplete,
  closeAccountIfComplete,
  mirrorApplicationToSchedule,
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
