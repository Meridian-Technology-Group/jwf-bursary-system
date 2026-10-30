import { describe, it, expect, vi } from "vitest";
import {
  mainSynopsisSeed,
  checkMainSynopsisBody,
  isSynopsisLocked,
  seedMainSynopsisAtLock,
  MAIN_SYNOPSIS_MAX,
} from "../standing-synopsis";
import type { Tx } from "@/lib/db/prisma";

describe("mainSynopsisSeed (Epic 21 #6 rework)", () => {
  it("is the trimmed synopsis", () => {
    expect(mainSynopsisSeed("  Notes  ")).toBe("Notes");
  });

  it("is null for a blank or missing synopsis", () => {
    expect(mainSynopsisSeed("   ")).toBeNull();
    expect(mainSynopsisSeed(null)).toBeNull();
    expect(mainSynopsisSeed(undefined)).toBeNull();
  });
});

describe("checkMainSynopsisBody", () => {
  it("trims, and allows a blank (staff may clear it)", () => {
    expect(checkMainSynopsisBody("  Two earners.  ")).toEqual({ ok: true, body: "Two earners." });
    expect(checkMainSynopsisBody("   ")).toEqual({ ok: true, body: "" });
  });

  it("refuses text over the cap", () => {
    const res = checkMainSynopsisBody("x".repeat(MAIN_SYNOPSIS_MAX + 1));
    expect(res.ok).toBe(false);
  });
});

describe("isSynopsisLocked — this year's synopsis locks with the assessment", () => {
  it("is locked in every post-assessment final state", () => {
    for (const s of ["NEW_AWARD", "ROLLED_OVER", "WAITING_LIST", "CLOSED_ARCHIVED"] as const) {
      expect(isSynopsisLocked(s)).toBe(true);
    }
  });

  it("is open while the assessment is worked, and when stored as complete", () => {
    for (const s of ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED"] as const) {
      expect(isSynopsisLocked(s)).toBe(false);
    }
    expect(isSynopsisLocked(null)).toBe(false);
  });

  it("an unrecognised status is locked, not editable (allowlist)", () => {
    expect(isSynopsisLocked("SOME_FUTURE_STATE")).toBe(true);
  });
});

describe("seedMainSynopsisAtLock", () => {
  function fakeTx(existing: { id: string } | null) {
    return {
      accountSynopsisEntry: {
        findFirst: vi.fn(async () => existing),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
    };
  }

  it("creates the account's MAIN from this year's synopsis when it has none", async () => {
    const tx = fakeTx(null);
    const wrote = await seedMainSynopsisAtLock(tx as unknown as Tx, {
      bursaryAccountId: "acc-1",
      synopsis: " Year one. ",
      userId: "u-1",
    });
    expect(wrote).toBe(true);
    expect(tx.accountSynopsisEntry.createMany).toHaveBeenCalledWith({
      data: [{ bursaryAccountId: "acc-1", kind: "MAIN", body: "Year one.", createdById: "u-1" }],
      skipDuplicates: true,
    });
  });

  it("leaves an existing MAIN alone", async () => {
    const tx = fakeTx({ id: "main-1" });
    const wrote = await seedMainSynopsisAtLock(tx as unknown as Tx, {
      bursaryAccountId: "acc-1",
      synopsis: "Year two.",
      userId: "u-1",
    });
    expect(wrote).toBe(false);
    expect(tx.accountSynopsisEntry.createMany).not.toHaveBeenCalled();
  });

  it("does nothing for a blank synopsis", async () => {
    const tx = fakeTx(null);
    expect(
      await seedMainSynopsisAtLock(tx as unknown as Tx, { bursaryAccountId: "acc-1", synopsis: " ", userId: null })
    ).toBe(false);
    expect(tx.accountSynopsisEntry.findFirst).not.toHaveBeenCalled();
  });
});
