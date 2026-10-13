import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 13 (C4b / D13-1a): `@/lib/bursary-accounts/reference` is deleted — the
// account mints no reference at all, so there is no generator left to mock.

import {
  promoteToActiveAccount,
  type PromotionApplication,
  type AwardFigures,
} from "../account-promotion";

function makeTx(
  existing: Record<string, unknown> = {},
  existingRows: { scheduleYear: number }[] = []
) {
  return {
    round: {
      // Epic 21 #4: the schedule anchors on the account's first round.
      findUnique: vi.fn(async (args: { where: { academicYear: string } }) => ({
        openDate: new Date(`${args.where.academicYear.slice(0, 4)}-09-01`),
        closeDate: new Date(`${args.where.academicYear.slice(0, 4)}-12-01`),
      })),
    },
    bursaryAccount: {
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({
        id: "account-new",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
      })),
      findUnique: vi.fn(async () => ({
        id: "existing",
        school: "WHITGIFT",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
        status: "ACTIVE",
        scheduleEndYear: null,
        ...existing,
      })),
      update: vi.fn(async () => ({})),
    },
    application: {
      update: vi.fn(async () => ({})),
    },
    bursaryScheduleEntry: {
      findMany: vi.fn(async () => existingRows),
      create: vi.fn(async () => ({})),
    },
  };
}

function baseApp(overrides: Partial<PromotionApplication> = {}): PromotionApplication {
  return {
    id: "app-1",
    school: "WHITGIFT" as never,
    childName: "Child",
    childDob: new Date("2014-01-01"),
    entryYear: 2025,
    entryYearGroup: "Y7" as never,
    bursaryAccountId: null,
    leadApplicantId: "lead-1",
    round: {
      academicYear: "2025/2026",
      openDate: new Date("2025-09-01"),
      closeDate: new Date("2025-12-01"),
    },
    assessment: { yearlyPayableFees: 12000 },
    ...overrides,
  };
}

const awards: AwardFigures = { bursaryAward: 22456, scholarshipAward: 3000 };

describe("promoteToActiveAccount (Epic 10 seam)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an ACTIVE account and links it when none exists", async () => {
    const tx = makeTx();
    const result = await promoteToActiveAccount(
      tx as never,
      baseApp(),
      awards
    );

    expect(result).toEqual({ bursaryAccountId: "account-new", created: true });
    expect(tx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    const createArg = tx.bursaryAccount.create.mock.calls[0]![0] as unknown as {
      data: { status: string; entryYear: number };
    };
    expect(createArg.data.status).toBe("ACTIVE");
    expect(createArg.data.entryYear).toBe(2025);
    expect(tx.application.update).toHaveBeenCalledTimes(1);
    // Epic 10: a forward schedule is generated for the new account.
    expect(tx.bursaryScheduleEntry.create).toHaveBeenCalled();
    expect(tx.bursaryAccount.update).toHaveBeenCalled(); // scheduleYears persisted
  });

  it("is idempotent: continues an existing account without creating a new one", async () => {
    const tx = makeTx();
    const result = await promoteToActiveAccount(
      tx as never,
      baseApp({ bursaryAccountId: "existing" }),
      awards
    );

    expect(result).toEqual({ bursaryAccountId: "existing", created: false });
    expect(tx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(tx.application.update).not.toHaveBeenCalled();
  });

  it("falls back to the round start year when entryYear is null", async () => {
    const tx = makeTx();
    await promoteToActiveAccount(
      tx as never,
      baseApp({ entryYear: null }),
      awards
    );
    const createArg = tx.bursaryAccount.create.mock.calls[0]![0] as unknown as {
      data: { entryYear: number };
    };
    expect(createArg.data.entryYear).toBe(2025);
  });

  // ─── Epic 21 #4 ─────────────────────────────────────────────────────────

  function createdRows(tx: ReturnType<typeof makeTx>) {
    return (tx.bursaryScheduleEntry.create.mock.calls as unknown as unknown[][]).map(
      (c) => (c[0] as unknown as { data: { scheduleYear: number; academicYear: string } }).data
    );
  }

  it("anchors a re-award's schedule top-up on the account's FIRST year, not this round", async () => {
    // Account first assessed 2025/26 (year 1 exists); re-award in 2026/27.
    const tx = makeTx({}, [{ scheduleYear: 1 }]);
    await promoteToActiveAccount(
      tx as never,
      baseApp({
        bursaryAccountId: "existing",
        round: { academicYear: "2026/2027", openDate: new Date("2026-09-01"), closeDate: new Date("2026-12-01") },
      }),
      awards
    );
    const rows = createdRows(tx);
    // Year 2 is 2026-27 (not 2027-28, as anchoring on this round produced).
    expect(rows.find((r) => r.scheduleYear === 2)?.academicYear).toBe("2026-27");
    expect(tx.round.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { academicYear: "2025/2026" } })
    );
  });

  it("does not regrow years after an ADMIN's End after this year", async () => {
    const tx = makeTx({ scheduleEndYear: 2 }, [{ scheduleYear: 1 }, { scheduleYear: 2 }]);
    await promoteToActiveAccount(tx as never, baseApp({ bursaryAccountId: "existing" }), awards);
    expect(tx.bursaryScheduleEntry.create).not.toHaveBeenCalled();
  });

  it("re-activates a CLOSED account when the locked year is inside its schedule", async () => {
    const tx = makeTx({ status: "CLOSED" }, [{ scheduleYear: 1 }]);
    await promoteToActiveAccount(
      tx as never,
      baseApp({
        bursaryAccountId: "existing",
        round: { academicYear: "2026/2027", openDate: null, closeDate: null },
      }),
      awards
    );
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE", closedAt: null } })
    );
  });

  it("leaves a CLOSED account closed when the locked year is past its ended schedule", async () => {
    const tx = makeTx({ status: "CLOSED", scheduleEndYear: 1 }, [{ scheduleYear: 1 }]);
    await promoteToActiveAccount(
      tx as never,
      baseApp({
        bursaryAccountId: "existing",
        round: { academicYear: "2026/2027", openDate: null, closeDate: null },
      }),
      awards
    );
    expect(tx.bursaryAccount.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE", closedAt: null } })
    );
  });
});
