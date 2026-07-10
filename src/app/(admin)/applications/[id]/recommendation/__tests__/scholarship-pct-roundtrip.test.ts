import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CALC-16 — the v2 recommendation form's Scholarship (%) input reads its
 * initial value from `Assessment.scholarshipPct` (page.tsx), but the save
 * action never wrote it back: only the derived `scholarshipValueInclVat`
 * landed on the Recommendation row. On reload the % input reset to 0 (since
 * the DB column was never touched), and — worse — re-saving from that
 * zeroed-out input would silently overwrite the previously-persisted £
 * value with £0.
 *
 * These tests assert the save action now writes the entered % onto
 * `Assessment.scholarshipPct` (same transaction), that a v1-style save
 * (no `scholarshipPct` field at all) leaves the assessment untouched, and
 * that resaving with the read-back % is idempotent — it does NOT zero the
 * stored figures.
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

const assessmentUpdateMock = vi.fn(async (_args: unknown) => ({}));

const withUserContextMock = vi.fn(
  async (_userId: string, _role: string, fn: (tx: unknown) => unknown) =>
    fn({
      application: {
        findUnique: vi.fn(async () => fakeApplication),
      },
      assessment: {
        update: assessmentUpdateMock,
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
  yearlyPayableFees: 12000,
  monthlyPayableFees: 1000,
  dishonestyFlag: false,
  creditRiskFlag: false,
  confirmedPayableFees: SNAPSHOT_RECOMMENDED, // no gap ⇒ no gap reason required
  gapReasonIds: [] as string[],
};

describe("saveRecommendationAction — scholarship % round-trip (CALC-16)", () => {
  beforeEach(() => {
    withUserContextMock.mockClear();
    upsertRecommendationMock.mockClear();
    assessmentUpdateMock.mockClear();
  });

  it("persists the entered scholarship % onto Assessment.scholarshipPct", async () => {
    const result = await saveRecommendationAction("app-1", {
      ...baseData,
      scholarshipPct: 10,
      scholarshipValueInclVat: 4000.8,
    });

    expect(result.success).toBe(true);
    expect(assessmentUpdateMock).toHaveBeenCalledTimes(1);
    expect(assessmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "assessment-1" },
      data: { scholarshipPct: 10 },
    });

    // The derived £ value still lands on the Recommendation row, same as before.
    const [, persisted] = upsertRecommendationMock.mock.calls[0];
    expect(persisted.scholarshipValueInclVat).toBe(4000.8);
  });

  it("does not touch the assessment when scholarshipPct is absent (v1 save)", async () => {
    const { confirmedPayableFees: _confirmed, gapReasonIds: _gr, ...v1Data } =
      baseData;
    const result = await saveRecommendationAction("app-1", {
      ...v1Data,
      reasonCodeIds: [],
    });

    expect(result.success).toBe(true);
    expect(assessmentUpdateMock).not.toHaveBeenCalled();
  });

  it("resaving with the read-back % is idempotent — it does not zero the stored figures", async () => {
    // First save: assessor enters 10%.
    const first = await saveRecommendationAction("app-1", {
      ...baseData,
      scholarshipPct: 10,
      scholarshipValueInclVat: 4000.8,
    });
    expect(first.success).toBe(true);

    // Simulate a reload: the form now initialises scholarshipPctInput from
    // the persisted Assessment.scholarshipPct (10, thanks to the fix above)
    // rather than resetting to 0. Re-saving without touching the field sends
    // that same 10% back.
    const second = await saveRecommendationAction("app-1", {
      ...baseData,
      scholarshipPct: 10,
      scholarshipValueInclVat: 4000.8,
    });
    expect(second.success).toBe(true);

    expect(assessmentUpdateMock).toHaveBeenCalledTimes(2);
    for (const call of assessmentUpdateMock.mock.calls) {
      expect(call[0]).toEqual({
        where: { id: "assessment-1" },
        data: { scholarshipPct: 10 },
      });
    }
    for (const call of upsertRecommendationMock.mock.calls) {
      expect(call[1].scholarshipValueInclVat).toBe(4000.8);
    }
  });
});
