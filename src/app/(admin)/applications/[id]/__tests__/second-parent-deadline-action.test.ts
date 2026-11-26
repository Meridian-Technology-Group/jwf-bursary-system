import { describe, it, expect, vi, beforeEach } from "vitest";

// Charlotte, 26 Nov 2026 (Option 1): the second parent has their own deadline;
// only an ADMIN can move it (Brian: admin-only, like the application's).

const ADMIN_USER = { id: "admin-1", role: "ADMIN" };
const requireRoleMock = vi.fn(async (_roles: string[]) => ADMIN_USER);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, requireRole: (roles: string[]) => requireRoleMock(roles) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
const auditMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...args),
}));

const findUnique = vi.fn();
const update = vi.fn(async () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn({ applicationContributor: { findUnique, update } }),
}));

import { setSecondParentDeadlineAction } from "../actions";

describe("setSecondParentDeadlineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ id: "contrib-2", application: { reference: "TS-0001" } });
  });

  it("is ADMIN-only", async () => {
    await setSecondParentDeadlineAction("app-1", "2026-12-10T23:59:00.000Z");
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("moves the SECONDARY row's deadline and audits it", async () => {
    const res = await setSecondParentDeadlineAction("app-1", "2026-12-10T23:59:00.000Z");
    expect(res).toEqual({ success: true });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId_role: { applicationId: "app-1", role: "SECONDARY" } },
      })
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "contrib-2" },
      data: { submissionDeadlineAt: new Date("2026-12-10T23:59:00.000Z") },
    });
    expect(auditMock).toHaveBeenCalledOnce();
  });

  it("refuses an invalid date without writing", async () => {
    const res = await setSecondParentDeadlineAction("app-1", "not a date");
    expect(res.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when the application has no second parent", async () => {
    findUnique.mockResolvedValue(null);
    const res = await setSecondParentDeadlineAction("app-1", "2026-12-10T23:59:00.000Z");
    expect(res).toEqual({ success: false, error: "This application has no second parent." });
    expect(update).not.toHaveBeenCalled();
  });
});
