import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CALC-08 — the recommendation save action must REJECT a material
 * recommended→confirmed gap that carries no gap reason, and it must do so
 * BEFORE opening a DB transaction (authoritative server-side mirror of the
 * client's submit gating). We mock the auth + DB boundaries and assert the
 * transaction is never entered on a bad payload, and IS entered on a good one.
 */

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

const withUserContextMock = vi.fn(
  async (_userId: string, _role: string, fn: (tx: unknown) => unknown) =>
    fn({
      application: {
        findUnique: vi.fn(async () => ({
          id: "app-1",
          roundId: "round-1",
          bursaryAccountId: null,
          assessment: { id: "assessment-1" },
        })),
      },
    })
);
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (userId: string, role: string, fn: (tx: unknown) => unknown) =>
    withUserContextMock(userId, role, fn),
}));

const upsertRecommendationMock = vi.fn(async () => ({ id: "rec-1" }));
vi.mock("@/lib/db/queries/recommendations", () => ({
  upsertRecommendation: () => upsertRecommendationMock(),
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: vi.fn(async () => ({})),
}));

// actions.ts pulls in set-outcome-core → email/send → resend, which throws at
// import when RESEND_API_KEY is unset. Stub the email boundary so importing the
// action never touches Resend.
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ success: true, messageId: "msg-1" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveRecommendationAction } from "../actions";

const baseData = {
  bursaryAward: 12000,
  scholarshipAward: 3774,
  yearlyPayableFees: 15676,
  monthlyPayableFees: 1306.33,
  dishonestyFlag: false,
  creditRiskFlag: false,
  recommendedPayableFees: 12000,
  confirmedPayableFees: 15676,
};

describe("saveRecommendationAction — gap-reason validation (CALC-08)", () => {
  beforeEach(() => {
    withUserContextMock.mockClear();
    upsertRecommendationMock.mockClear();
  });

  it("rejects a material gap with no gap reason, before any DB work", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      gapAmount: 3676, // 15676 − 12000
      gapReasonIds: [],
    });

    expect(result.success).toBe(false);
    expect(withUserContextMock).not.toHaveBeenCalled();
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
  });

  it("proceeds when a material gap carries at least one reason", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      gapAmount: 3676,
      gapReasonIds: ["gap-reason-1"],
    });

    expect(result.success).toBe(true);
    expect(withUserContextMock).toHaveBeenCalled();
    expect(upsertRecommendationMock).toHaveBeenCalled();
  });

  it("proceeds when there is no material gap (no reason required)", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 12000,
      gapAmount: 0,
      gapReasonIds: [],
    });

    expect(result.success).toBe(true);
    expect(withUserContextMock).toHaveBeenCalled();
  });

  it("ignores the rule for v1 saves (no gapAmount supplied)", async () => {
    const result = await saveRecommendationAction("app-1", {
      bursaryAward: 5000,
      yearlyPayableFees: 10000,
      monthlyPayableFees: 833.33,
      dishonestyFlag: false,
      creditRiskFlag: false,
      reasonCodeIds: [],
    });

    expect(result.success).toBe(true);
    expect(withUserContextMock).toHaveBeenCalled();
  });
});
