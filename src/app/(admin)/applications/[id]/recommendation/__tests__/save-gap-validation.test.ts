import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CALC-08 — the recommendation save action's gap rule is AUTHORITATIVE:
 * whenever a confirmed payable-fees figure is saved, the recommended figure is
 * re-read from the assessment's persisted snapshot (never trusted from the
 * client), the gap is recomputed as confirmed − snapshotRecommended, and a
 * material gap with no gap reason is rejected before any write. The
 * server-computed figures are what get persisted — client-sent
 * `recommendedPayableFees`/`gapAmount` are ignored.
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

// The fake application row the tx returns — the assessment snapshot's
// recommendedPayableFees (12000) is the authoritative gap baseline.
const SNAPSHOT_RECOMMENDED = 12000;
const fakeApplication = {
  id: "app-1",
  roundId: "round-1",
  bursaryAccountId: null,
  assessment: {
    id: "assessment-1",
    recommendedPayableFees: SNAPSHOT_RECOMMENDED,
  },
};

const withUserContextMock = vi.fn(
  async (_userId: string, _role: string, fn: (tx: unknown) => unknown) =>
    fn({
      application: {
        findUnique: vi.fn(async () => fakeApplication),
      },
    })
);
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (userId: string, role: string, fn: (tx: unknown) => unknown) =>
    withUserContextMock(userId, role, fn),
}));

const upsertRecommendationMock = vi.fn(
  async (_assessmentId: string, _data: Record<string, unknown>) => ({
    id: "rec-1",
  })
);
vi.mock("@/lib/db/queries/recommendations", () => ({
  upsertRecommendation: (
    _tx: unknown,
    assessmentId: string,
    data: Record<string, unknown>
  ) => upsertRecommendationMock(assessmentId, data),
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
};

describe("saveRecommendationAction — authoritative gap validation (CALC-08)", () => {
  beforeEach(() => {
    withUserContextMock.mockClear();
    upsertRecommendationMock.mockClear();
  });

  it("rejects a material gap (vs the SNAPSHOT recommended) with no gap reason", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 15676, // gap vs snapshot = 3676
      gapReasonIds: [],
    });

    expect(result.success).toBe(false);
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
  });

  it("rejects a DISHONEST client that reports no gap when the snapshot says otherwise", async () => {
    // Client lies: claims recommended == confirmed (gapAmount 0) — but the
    // snapshot's recommended is 12000, so the true gap is 3676.
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 15676,
      recommendedPayableFees: 15676, // lie
      gapAmount: 0, // lie
      gapReasonIds: [],
    });

    expect(result.success).toBe(false);
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
  });

  it("persists the SERVER-computed recommended + gap, ignoring client-sent values", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 15676,
      recommendedPayableFees: 99999, // ignored
      gapAmount: -1, // ignored
      gapReasonIds: ["gap-reason-1"],
    });

    expect(result.success).toBe(true);
    expect(upsertRecommendationMock).toHaveBeenCalledTimes(1);
    const [assessmentId, persisted] = upsertRecommendationMock.mock.calls[0];
    expect(assessmentId).toBe("assessment-1");
    expect(persisted.recommendedPayableFees).toBe(SNAPSHOT_RECOMMENDED);
    expect(persisted.gapAmount).toBe(15676 - SNAPSHOT_RECOMMENDED);
  });

  it("proceeds when confirmed equals the snapshot recommended (no gap, no reason needed)", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: SNAPSHOT_RECOMMENDED,
      gapReasonIds: [],
    });

    expect(result.success).toBe(true);
    const [, persisted] = upsertRecommendationMock.mock.calls[0];
    expect(persisted.gapAmount).toBe(0);
  });

  it("strips client-sent v2 gap figures on a v1 save (no confirmed figure)", async () => {
    const result = await saveRecommendationAction("app-1", {
      bursaryAward: 5000,
      yearlyPayableFees: 10000,
      monthlyPayableFees: 833.33,
      dishonestyFlag: false,
      creditRiskFlag: false,
      reasonCodeIds: [],
      // A dishonest/buggy client sends v2 figures without a confirmed value.
      recommendedPayableFees: 99999,
      gapAmount: 12345,
    });

    expect(result.success).toBe(true);
    const [, persisted] = upsertRecommendationMock.mock.calls[0];
    expect(persisted.recommendedPayableFees).toBeUndefined();
    expect(persisted.gapAmount).toBeUndefined();
  });
});
