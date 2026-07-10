import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CALC-15 — a v2 assessment's `recommendedPayableFees` snapshot column must
 * NEVER be treated as an implicit £0 when it is null. Before this fix,
 * `saveRecommendationAction` fell back to `0` for a null snapshot and happily
 * computed a gap against it — exactly what happened when a stale-client save
 * failure left a COMPLETED v2 assessment with all-null snapshot columns. The
 * action must now reject the save outright with a clear "reopen and re-save"
 * error instead of persisting a bogus gap.
 *
 * Mocking pattern mirrors ../save-gap-validation.test.ts.
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

// The fake application row: recommendedPayableFees is NULL — the exact shape
// a v2 assessment has when its calculation snapshot was never saved.
interface FakeApplication {
  id: string;
  roundId: string;
  bursaryAccountId: string | null;
  assessment: { id: string; recommendedPayableFees: number | null };
}

const fakeApplicationNullSnapshot: FakeApplication = {
  id: "app-1",
  roundId: "round-1",
  bursaryAccountId: null,
  assessment: {
    id: "assessment-1",
    recommendedPayableFees: null,
  },
};

let fakeApplication: FakeApplication = fakeApplicationNullSnapshot;

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

describe("saveRecommendationAction — null v2 snapshot guard (CALC-15)", () => {
  beforeEach(() => {
    withUserContextMock.mockClear();
    upsertRecommendationMock.mockClear();
    fakeApplication = fakeApplicationNullSnapshot;
  });

  it("rejects a v2 save (confirmedPayableFees present) when the snapshot's recommendedPayableFees is null", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 15676,
      gapReasonIds: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/reopen/i);
    }
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
  });

  it("never falls back to treating the null snapshot as £0 (no silent gap computed)", async () => {
    // A gap of "0 vs implicit £0" would incorrectly succeed pre-fix even with
    // no gap reason supplied, because 15676 - 0 = 15676 IS material and would
    // normally require a reason — but the real bug was the reverse case: a
    // client that (accidentally or not) sends a confirmed figure equal to
    // what it displayed (recommendedPayableFees ?? 0 = 0) diverging from the
    // true (unknown) recommended figure. Assert the action never reaches
    // upsert at all for a null snapshot, regardless of gap reasons supplied.
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 0,
      gapReasonIds: ["gap-reason-1"],
    });

    expect(result.success).toBe(false);
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
  });

  it("still proceeds normally once the snapshot is present (non-null recommendedPayableFees)", async () => {
    fakeApplication = {
      ...fakeApplicationNullSnapshot,
      assessment: { id: "assessment-1", recommendedPayableFees: 12000 },
    };

    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      confirmedPayableFees: 12000,
      gapReasonIds: [],
    });

    expect(result.success).toBe(true);
    expect(upsertRecommendationMock).toHaveBeenCalledTimes(1);
  });

  it("does not trigger the guard on a v1 save (no confirmed figure) even with a null snapshot", async () => {
    const result = await saveRecommendationAction("app-1", {
      bursaryAward: 5000,
      yearlyPayableFees: 10000,
      monthlyPayableFees: 833.33,
      dishonestyFlag: false,
      creditRiskFlag: false,
      reasonCodeIds: [],
    });

    expect(result.success).toBe(true);
    expect(upsertRecommendationMock).toHaveBeenCalledTimes(1);
  });
});
