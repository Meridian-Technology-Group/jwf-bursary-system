import { describe, it, expect, vi } from "vitest";
import type { Tx } from "@/lib/db/prisma";
import {
  getRejectionsForAccounts,
  recordRejection,
  scheduleRowAfterRestart,
  type RecordRejectionParams,
} from "../rejection-record";

describe("scheduleRowAfterRestart (D-18)", () => {
  it("resets a RECEIVED row that pointed at the rejected application", () => {
    expect(
      scheduleRowAfterRestart({ status: "RECEIVED", applicationId: "old" }, "old", "new")
    ).toEqual({ status: "SCHEDULED", receivedOn: null, applicationId: "new" });
  });

  it("leaves a row that points elsewhere, or nowhere", () => {
    expect(
      scheduleRowAfterRestart({ status: "RECEIVED", applicationId: "other" }, "old", "new")
    ).toBeNull();
    expect(
      scheduleRowAfterRestart({ status: "SCHEDULED", applicationId: null }, "old", "new")
    ).toBeNull();
  });

  it("never touches a COMPLETE row", () => {
    expect(
      scheduleRowAfterRestart({ status: "COMPLETE", applicationId: "old" }, "old", "new")
    ).toBeNull();
  });
});

function fakeTx(entry: { id: string; status: string; applicationId: string | null } | null) {
  const created: Record<string, unknown>[] = [];
  const updates: unknown[] = [];
  let n = 0;
  const tx = {
    applicationRejection: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `rej-${++n}` };
      }),
      findMany: vi.fn(async (args: unknown) => args),
    },
    bursaryScheduleEntry: {
      findFirst: vi.fn(async () => entry),
      update: vi.fn(async (args: unknown) => {
        updates.push(args);
        return args;
      }),
    },
  };
  return { tx: tx as unknown as Tx, raw: tx, created, updates };
}

const PARAMS: RecordRejectionParams = {
  rejectedApplicationId: "old-app",
  newApplicationId: "new-app",
  roundId: "round-2027",
  academicYear: "2027/28",
  leadApplicantId: "parent-1",
  bursaryAccountId: "acc-1",
  childName: "Alex Doe",
  reference: "TS-DOE01",
  submittedAt: new Date("2027-05-01T10:00:00Z"),
  rejectedById: "staff-1",
  fromPhase: "SUBMITTED",
};

describe("recordRejection (Epic 22 P3)", () => {
  it("keeps the old submitted date and the new application id, nothing from the form", async () => {
    const { tx, created } = fakeTx(null);
    const result = await recordRejection(tx, PARAMS);
    expect(result.rejectionId).toBe("rej-1");
    expect(created[0]).toEqual({
      roundId: "round-2027",
      academicYear: "2027/28",
      leadApplicantId: "parent-1",
      bursaryAccountId: "acc-1",
      childName: "Alex Doe",
      reference: "TS-DOE01",
      submittedAt: new Date("2027-05-01T10:00:00Z"),
      rejectedById: "staff-1",
      replacementApplicationId: "new-app",
      fromPhase: "SUBMITTED",
    });
  });

  it("resets the year's schedule row when it pointed at the rejected application", async () => {
    const { tx, raw, updates } = fakeTx({ id: "e-1", status: "RECEIVED", applicationId: "old-app" });
    const result = await recordRejection(tx, PARAMS);
    expect(raw.bursaryScheduleEntry.findFirst).toHaveBeenCalledWith({
      where: {
        bursaryAccountId: "acc-1",
        academicYear: { in: ["2027/28", "2027-28"] },
      },
      select: { id: true, status: true, applicationId: true },
    });
    expect(updates).toEqual([
      {
        where: { id: "e-1" },
        data: { status: "SCHEDULED", receivedOn: null, applicationId: "new-app" },
      },
    ]);
    expect(result.scheduleEntryId).toBe("e-1");
  });

  it("does not touch a row pointing at another application", async () => {
    const { tx, updates } = fakeTx({ id: "e-1", status: "RECEIVED", applicationId: "someone-else" });
    expect((await recordRejection(tx, PARAMS)).scheduleEntryId).toBeNull();
    expect(updates).toEqual([]);
  });

  it("a first-year applicant with no account: record only, no schedule lookup", async () => {
    const { tx, raw } = fakeTx(null);
    await recordRejection(tx, { ...PARAMS, bursaryAccountId: null });
    expect(raw.bursaryScheduleEntry.findFirst).not.toHaveBeenCalled();
  });

  it("rejecting the replacement too adds a second record that links on", async () => {
    const { tx, created } = fakeTx(null);
    await recordRejection(tx, PARAMS);
    await recordRejection(tx, {
      ...PARAMS,
      rejectedApplicationId: "new-app",
      newApplicationId: "newer-app",
      submittedAt: new Date("2027-05-10T10:00:00Z"),
    });
    expect(created.map((c) => c.replacementApplicationId)).toEqual(["new-app", "newer-app"]);
  });
});

describe("getRejectionsForAccounts", () => {
  it("skips the query for no accounts and orders oldest first", async () => {
    const { tx, raw } = fakeTx(null);
    expect(await getRejectionsForAccounts(tx, [])).toEqual([]);
    expect(raw.applicationRejection.findMany).not.toHaveBeenCalled();
    await getRejectionsForAccounts(tx, ["acc-1"]);
    expect(raw.applicationRejection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bursaryAccountId: { in: ["acc-1"] } },
        orderBy: { rejectedAt: "asc" },
      })
    );
  });
});
