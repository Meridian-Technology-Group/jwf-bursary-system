import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit 20 Nov 2026 (finding 7): an assessor is scoped to the applications
 * assigned to them. These actions run under the service role (RLS bypassed),
 * so the assignment check must happen in the action itself — before any read
 * or write. `requireApplicationAccess` redirects (throws NEXT_REDIRECT) for an
 * unassigned assessor; here it is mocked to do exactly that.
 */

const ASSESSOR = {
  id: "assessor-a",
  role: "ASSESSOR",
  email: "a@example.test",
  firstName: "A",
  lastName: "Assessor",
};

const requireRoleMock = vi.fn(async (..._args: unknown[]) => ASSESSOR);
const requireAccessMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
    requireApplicationAccess: (...args: unknown[]) => requireAccessMock(...args),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sendEmailMock = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => {}) }));

const withAdminContextMock = vi.fn();
const withUserContextMock = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (...args: unknown[]) => withAdminContextMock(...args),
  withUserContext: (...args: unknown[]) => withUserContextMock(...args),
}));

import {
  rejectAndRestartApplication,
  getRejectionDraft,
  gdprDeleteApplicantAction,
} from "../actions";

const APP_X = "app-x";

function denyUnassigned() {
  requireAccessMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
}

describe("assessor scoping on application actions (audit finding 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue(ASSESSOR);
  });

  it("rejectAndRestartApplication: an unassigned assessor is refused before any read, delete or email", async () => {
    denyUnassigned();
    const res = await rejectAndRestartApplication(APP_X, "Dear family", "2099-01-01", ["doc-1"]);

    expect(requireAccessMock).toHaveBeenCalledWith(ASSESSOR, APP_X);
    expect(res.success).toBe(false);
    expect(withAdminContextMock).not.toHaveBeenCalled();
    expect(withUserContextMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("getRejectionDraft: an unassigned assessor gets no names or filenames", async () => {
    denyUnassigned();
    await expect(getRejectionDraft(APP_X)).rejects.toThrow("NEXT_REDIRECT");

    expect(requireAccessMock).toHaveBeenCalledWith(ASSESSOR, APP_X);
    expect(withAdminContextMock).not.toHaveBeenCalled();
  });

  it("gdprDeleteApplicantAction: ADMIN only — an assessor is refused before any read", async () => {
    // requireRole redirects anyone outside the allowed roles.
    requireRoleMock.mockImplementationOnce(async (...args: unknown[]) => {
      const allowed = args[0] as string[];
      if (!allowed.includes(ASSESSOR.role)) throw new Error("NEXT_REDIRECT");
      return ASSESSOR;
    });
    const res = await gdprDeleteApplicantAction(APP_X);

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(res.success).toBe(false);
    expect(withAdminContextMock).not.toHaveBeenCalled();
  });
});
