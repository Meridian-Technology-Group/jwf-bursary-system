import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 13 (C4b / D13-1a): `@/lib/bursary-accounts/reference` is deleted — the
// account mints no reference at all, so there is no generator left to mock.

import {
  promoteToActiveAccount,
  type PromotionApplication,
  type AwardFigures,
} from "../account-promotion";

function makeTx() {
  return {
    bursaryAccount: {
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({
        id: "account-new",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
      })),
      findUnique: vi.fn(async () => ({
        id: "existing",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
        status: "ACTIVE",
      })),
      update: vi.fn(async () => ({})),
    },
    application: {
      update: vi.fn(async () => ({})),
    },
    bursaryScheduleEntry: {
      findMany: vi.fn(async () => []),
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
});
