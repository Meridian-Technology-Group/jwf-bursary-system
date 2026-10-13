import { describe, it, expect, vi } from "vitest";
import { reassessmentEligibleWhere } from "../reassessment-eligibility";
import { getActiveBursaryHolders } from "@/lib/db/queries/invitations";

describe("reassessmentEligibleWhere (Epic 21 F3)", () => {
  it("requires an ACTIVE account with a SCHEDULED row for the round, in either spelling", () => {
    expect(reassessmentEligibleWhere("2027/28")).toEqual({
      status: "ACTIVE",
      scheduleEntries: {
        some: {
          status: "SCHEDULED",
          academicYear: { in: ["2027/28", "2027-28"] },
        },
      },
    });
  });
});

describe("getActiveBursaryHolders — filtered by the schedule (Epic 21 F3)", () => {
  function makeTx(round: { academicYear: string } | null) {
    return {
      round: { findUnique: vi.fn(async () => round) },
      invitation: { findMany: vi.fn(async () => [{ bursaryAccountId: "already" }]) },
      bursaryAccount: { findMany: vi.fn(async () => []) },
    };
  }

  it("asks only for accounts with a scheduled year for the round, minus those already invited", async () => {
    const tx = makeTx({ academicYear: "2027/28" });
    await getActiveBursaryHolders(tx as never, "round-2027");
    const where = (tx.bursaryAccount.findMany.mock.calls as unknown as { where: unknown }[][])[0][0]
      .where as Record<string, unknown>;
    expect(where).toMatchObject({
      status: "ACTIVE",
      scheduleEntries: { some: { status: "SCHEDULED" } },
      id: { notIn: ["already"] },
    });
  });

  it("returns no one for an unknown round", async () => {
    const tx = makeTx(null);
    expect(await getActiveBursaryHolders(tx as never, "missing")).toEqual([]);
    expect(tx.bursaryAccount.findMany).not.toHaveBeenCalled();
  });
});
