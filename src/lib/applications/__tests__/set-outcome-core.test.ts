import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// The shared core authenticates, runs two `withUserContext` transactions
// (promotion/outcome write, then the audit write) and sends an email. We mock
// those boundaries and pass a fake Prisma `tx` through `withUserContext` so we
// can assert the Epic 08 invariants:
//   - AWARDED → exactly one BursaryAccount create (idempotent), the scholarship
//     award persisted onto the recommendation, one audit row carrying both
//     award figures.
//   - QUALIFIES_NOT_AWARDED → no account, no scholarship write, one audit row.
//   - DOES_NOT_QUALIFY → no account, one audit row.
//   - non-COMPLETED assessment → rejected, no side effects.

vi.mock("@/lib/auth/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/roles")>(
    "@/lib/auth/roles"
  );
  return {
    ...actual,
    requireRole: vi.fn(async () => ({
      id: "assessor-1",
      role: "ASSESSOR",
      email: "assessor@example.test",
      firstName: "Ada",
      lastName: "Assessor",
    })),
  };
});

const sendEmailMock = vi.fn(async () => ({
  success: true as const,
  messageId: "msg-123",
}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: () => sendEmailMock(),
}));

// Epic 13 (C4b / D13-1a): `@/lib/bursary-accounts/reference` is deleted — the
// account mints no reference at all, so there is no generator left to mock.

// `withUserContext` normally opens a real transaction. Here it just invokes
// the callback with our fake `tx`.
let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (
    _userId: string,
    _role: string,
    fn: (tx: unknown) => unknown
  ) => fn(fakeTx),
}));

import { setApplicationOutcome } from "../set-outcome-core";

// ─── Fake Prisma transaction client ───────────────────────────────────────────

function makeFakeTx(application: Record<string, unknown>) {
  return {
    application: {
      findUnique: vi.fn(async () => application),
      update: vi.fn(async () => ({})),
    },
    bursaryAccount: {
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({
        id: "account-1",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
      })),
      findUnique: vi.fn(async () => ({
        id: "existing-account",
        entryYearGroup: "Y7",
        firstAssessmentYear: "2025/2026",
        status: "ACTIVE",
      })),
      update: vi.fn(async () => ({})),
    },
    bursaryScheduleEntry: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
    assessment: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    recommendation: {
      updateMany: vi.fn(async (_args: { data: { scholarshipAward: number } }) => ({
        count: 1,
      })),
    },
    auditLog: {
      create: vi.fn(async (_args: { data: { action: string } }) => ({})),
    },
  };
}

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "APP-2025-0001",
    status: "COMPLETED",
    childName: "Child Name",
    childDob: new Date("2014-01-01"),
    entryYear: 2025,
    entryYearGroup: "Y7",
    school: "WHITGIFT",
    bursaryAccountId: null,
    applicationType: "NEW",
    archivedAt: null,
    leadApplicantId: "lead-1",
    leadApplicant: {
      id: "lead-1",
      email: "parent@example.test",
      firstName: "Pat",
      lastName: "Parent",
    },
    round: {
      academicYear: "2025/2026",
      openDate: new Date("2025-09-01"),
      closeDate: new Date("2025-12-01"),
    },
    assessment: {
      id: "assess-1",
      status: "COMPLETED",
      yearlyPayableFees: 12000,
    },
    ...overrides,
  };
}

describe("setApplicationOutcome (shared core, Epic 08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AWARDED: creates one account, records scholarship, writes one audit row with both awards", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome("app-1", "AWARDED", {
      bursaryAward: 22456,
      scholarshipAward: 3000,
    });

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    // Scholarship award persisted onto the recommendation.
    expect(fakeTx.recommendation.updateMany).toHaveBeenCalledTimes(1);
    const recArg = fakeTx.recommendation.updateMany.mock.calls[0]![0] as unknown as {
      data: { scholarshipAward: number };
    };
    expect(recArg.data.scholarshipAward).toBe(3000);

    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = fakeTx.auditLog.create.mock.calls[0]![0] as unknown as {
      data: { action: string; metadata: Record<string, unknown> };
    };
    expect(auditArg.data.action).toBe("APPLICATION_OUTCOME_SET");
    expect(auditArg.data.metadata.outcome).toBe("AWARDED");
    expect(auditArg.data.metadata.bursaryAward).toBe(22456);
    expect(auditArg.data.metadata.scholarshipAward).toBe(3000);
  });

  it("AWARDED with no scholarship: still creates account, does not write scholarship", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome("app-1", "AWARDED", {
      bursaryAward: 10000,
      scholarshipAward: null,
    });

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    expect(fakeTx.recommendation.updateMany).not.toHaveBeenCalled();
  });

  it("AWARDED (v2): account benchmark falls back to the recommendation's confirmed fees when the legacy column is null (CALC-08)", async () => {
    // A v2 assessment leaves the legacy yearlyPayableFees null — the benchmark
    // must walk recommendation.confirmedPayableFees → assessment
    // recommendedPayableFees → legacy (account-promotion.ts).
    fakeTx = makeFakeTx(
      baseApplication({
        assessment: {
          id: "assess-1",
          status: "COMPLETED",
          yearlyPayableFees: null,
          recommendedPayableFees: 12000,
          recommendation: { confirmedPayableFees: 15676 },
        },
      })
    );

    const result = await setApplicationOutcome("app-1", "AWARDED", {
      bursaryAward: 12000,
      scholarshipAward: null,
    });

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    const createArg = fakeTx.bursaryAccount.create.mock.calls[0]![0] as unknown as {
      data: { benchmarkPayableFees: unknown };
    };
    expect(createArg.data.benchmarkPayableFees).toBe(15676);
  });

  it("AWARDED (v2, no confirmed figure): benchmark falls back to the assessment's recommended snapshot", async () => {
    fakeTx = makeFakeTx(
      baseApplication({
        assessment: {
          id: "assess-1",
          status: "COMPLETED",
          yearlyPayableFees: null,
          recommendedPayableFees: 12000,
          recommendation: { confirmedPayableFees: null },
        },
      })
    );

    const result = await setApplicationOutcome("app-1", "AWARDED", {
      bursaryAward: 12000,
      scholarshipAward: null,
    });

    expect(result).toEqual({ success: true });
    const createArg = fakeTx.bursaryAccount.create.mock.calls[0]![0] as unknown as {
      data: { benchmarkPayableFees: unknown };
    };
    expect(createArg.data.benchmarkPayableFees).toBe(12000);
  });

  it("AWARDED is idempotent: continues an existing account, no new account", async () => {
    fakeTx = makeFakeTx(
      baseApplication({ bursaryAccountId: "existing-account" })
    );

    const result = await setApplicationOutcome("app-1", "AWARDED", {
      bursaryAward: 5000,
      scholarshipAward: 0,
    });

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    // scholarshipAward of 0 is a real figure (not null) → recorded.
    expect(fakeTx.recommendation.updateMany).toHaveBeenCalledTimes(1);
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("QUALIFIES_NOT_AWARDED: no account, no scholarship write, one audit row", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome(
      "app-1",
      "QUALIFIES_NOT_AWARDED"
    );

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.recommendation.updateMany).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = fakeTx.auditLog.create.mock.calls[0]![0] as unknown as {
      data: { metadata: Record<string, unknown> };
    };
    expect(auditArg.data.metadata.outcome).toBe("QUALIFIES_NOT_AWARDED");
  });

  it("DOES_NOT_QUALIFY: no account create, still writes one audit row", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome("app-1", "DOES_NOT_QUALIFY");

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("rejects the decision when the assessment is not COMPLETED, no side effects", async () => {
    fakeTx = makeFakeTx(
      baseApplication({
        assessment: { id: "assess-1", status: "IN_PROGRESS", yearlyPayableFees: null },
      })
    );

    const result = await setApplicationOutcome("app-1", "AWARDED");

    expect(result.success).toBe(false);
    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).not.toHaveBeenCalled();
  });
});
