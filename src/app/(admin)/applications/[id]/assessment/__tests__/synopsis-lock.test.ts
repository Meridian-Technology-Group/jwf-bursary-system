import { describe, it, expect, vi, beforeEach } from "vitest";

// Epic 21 #6 (rework, 14 Oct 2026) — "This year's synopsis" locks with the
// assessment. Before the rework `saveSynopsis` had no status guard at all.

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => ({ id: "user-1", role: "ADMIN", email: "u@example.test" })),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...args),
}));

let status = "COMPLETED";
const updateMock = vi.fn(async () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn({
      assessment: {
        findUnique: vi.fn(async () => ({ status })),
        update: updateMock,
      },
    }),
}));

import { saveSynopsis } from "../checklist-actions";
import { SYNOPSIS_LOCKED_MESSAGE } from "@/lib/bursary-accounts/standing-synopsis";

describe("saveSynopsis — locks with the assessment", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["IN_PROGRESS", "COMPLETED"])("saves while %s", async (s) => {
    status = s;
    const res = await saveSynopsis("asmt-1", "app-1", "Some text");
    expect(res).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: { synopsis: "Some text" },
    });
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it.each(["NEW_AWARD", "ROLLED_OVER", "WAITING_LIST", "CLOSED_ARCHIVED"])(
    "refuses once %s, and writes nothing",
    async (s) => {
      status = s;
      const res = await saveSynopsis("asmt-1", "app-1", "Late edit");
      expect(res).toEqual({ success: false, error: SYNOPSIS_LOCKED_MESSAGE });
      expect(updateMock).not.toHaveBeenCalled();
      expect(auditMock).not.toHaveBeenCalled();
    }
  );
});
