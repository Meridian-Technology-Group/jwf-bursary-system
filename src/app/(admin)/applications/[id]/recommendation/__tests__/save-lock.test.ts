import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit 20 Nov 2026 (finding 12b) — the recommendation save had no status,
 * closed or migrated check. A stale tab or a direct server-action call could
 * rewrite the confirmed payable fees, gap and scholarship % of a locked
 * (NEW_AWARD / ROLLED_OVER), closed or Grant Tracker-migrated award. The save
 * now refuses, before any write, unless the assessment is IN_PROGRESS, PAUSED
 * or COMPLETED on an open, non-migrated application.
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

function application(overrides: {
  status?: string;
  closedAt?: Date | null;
  migrationSource?: string | null;
}) {
  return {
    id: "app-1",
    roundId: "round-1",
    bursaryAccountId: "account-1",
    closedAt: overrides.closedAt ?? null,
    migrationSource: overrides.migrationSource ?? null,
    assessment: {
      id: "assessment-1",
      status: overrides.status ?? "COMPLETED",
      recommendedPayableFees: SNAPSHOT_RECOMMENDED,
    },
  };
}

let fakeApplication = application({});
const assessmentUpdateMock = vi.fn(async (_args: unknown) => ({}));

vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_userId: string, _role: string, fn: (tx: unknown) => unknown) =>
    fn({
      application: { findUnique: vi.fn(async () => fakeApplication) },
      assessment: { update: assessmentUpdateMock },
    }),
}));

const upsertRecommendationMock = vi.fn(async (..._args: unknown[]) => ({ id: "rec-1" }));
vi.mock("@/lib/db/queries/recommendations", () => ({
  upsertRecommendation: (...args: unknown[]) => upsertRecommendationMock(...args),
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: vi.fn(async () => ({})),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ success: true, messageId: "msg-1" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveRecommendationAction } from "../actions";
import {
  RECOMMENDATION_APPLICATION_CLOSED_MESSAGE,
  RECOMMENDATION_DECIDED_MESSAGE,
} from "@/lib/applications/recommendation-gate";
import { MIGRATED_LOCKED_MESSAGE } from "@/lib/applications/migration-source";

const payload = {
  confirmedPayableFees: 9000,
  gapReasonIds: ["gap-reason-1"],
  scholarshipPct: 25,
};

describe("saveRecommendationAction — locked / closed / migrated awards", () => {
  beforeEach(() => {
    upsertRecommendationMock.mockClear();
    assessmentUpdateMock.mockClear();
  });

  it.each(["NEW_AWARD", "ROLLED_OVER", "WAITING_LIST", "CLOSED_ARCHIVED"])(
    "refuses a save while the assessment is %s, writing nothing",
    async (status) => {
      fakeApplication = application({ status });
      const result = await saveRecommendationAction("app-1", payload);
      expect(result).toEqual({ success: false, error: RECOMMENDATION_DECIDED_MESSAGE });
      expect(upsertRecommendationMock).not.toHaveBeenCalled();
      expect(assessmentUpdateMock).not.toHaveBeenCalled();
    }
  );

  it("refuses a save on a closed application", async () => {
    fakeApplication = application({ closedAt: new Date("2026-11-01") });
    const result = await saveRecommendationAction("app-1", payload);
    expect(result).toEqual({ success: false, error: RECOMMENDATION_APPLICATION_CLOSED_MESSAGE });
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
    expect(assessmentUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses a save on a migrated award", async () => {
    fakeApplication = application({ status: "NEW_AWARD", migrationSource: "GRANT_TRACKER" });
    const result = await saveRecommendationAction("app-1", payload);
    expect(result).toEqual({ success: false, error: MIGRATED_LOCKED_MESSAGE });
    expect(upsertRecommendationMock).not.toHaveBeenCalled();
    expect(assessmentUpdateMock).not.toHaveBeenCalled();
  });

  it.each(["IN_PROGRESS", "PAUSED", "COMPLETED"])(
    "still saves while the assessment is %s",
    async (status) => {
      fakeApplication = application({ status });
      const result = await saveRecommendationAction("app-1", payload);
      expect(result).toEqual({ success: true });
      expect(upsertRecommendationMock).toHaveBeenCalledTimes(1);
    }
  );
});
