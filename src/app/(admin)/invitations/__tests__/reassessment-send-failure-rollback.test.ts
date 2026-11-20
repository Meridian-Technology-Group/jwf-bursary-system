import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit finding 16 — a re-assessment invite whose email fails to send must be
 * rolled back like every other invite path (createInvitationAction,
 * sendInvitationFromContactAction): the invitation row deleted, the failure
 * audited, and a login THIS call created removed. Previously the PENDING row
 * survived, so `getActiveBursaryHolders` treated the holder as invited and a
 * re-run silently skipped them.
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER", APPLICANT: "APPLICANT" },
}));

const deleteUserMock = vi.fn(async (_id: string) => ({ error: null }));
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser: (id: string) => deleteUserMock(id) } },
  })),
}));
const provisionMock = vi.fn();
vi.mock("@/lib/auth/provision-applicant", () => ({
  provisionApplicantAuthUser: () => provisionMock(),
}));
vi.mock("@/lib/auth/create-profile", () => ({
  createProfile: vi.fn(async () => ({ success: true })),
}));
const sendEmailMock = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  normaliseBccAddress: (v: unknown) => v,
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const auditMock = vi.fn(async (_tx: unknown, _entry: unknown) => undefined);
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (tx: unknown, entry: unknown) => auditMock(tx, entry),
}));
vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => "contrib-1"),
}));
vi.mock("@/lib/db/queries/reassessment", () => ({
  prepopulateReassessment: vi.fn(async () => undefined),
  getPreviousYearApplication: vi.fn(async () => null),
  getPreviousYearReferenceSource: vi.fn(async () => null),
}));

const holdersMock = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("@/lib/db/queries/invitations", () => ({
  createInvitation: vi.fn(async () => ({ id: "inv-1", token: "tok-1" })),
  generateInvitationToken: vi.fn(() => "token"),
  getActiveBursaryHolders: () => holdersMock(),
}));

const fakeTx = {
  assessment: { count: vi.fn(async () => 0) },
  round: {
    findUnique: vi.fn(async () => ({
      academicYear: "2027/2028",
      closeDate: new Date("2099-05-21"),
      defaultSubmissionDeadlineNew: null,
      defaultSubmissionDeadlineRolling: null,
      windows: [],
    })),
  },
  invitation: { delete: vi.fn(async () => ({})) },
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { batchReassessmentInviteAction } from "../actions";

const holder = {
  id: "acct-1",
  childName: "Child",
  school: "WHITGIFT",
  leadApplicant: { email: "parent@example.test", firstName: "P", lastName: "Q" },
};

function auditActions(): string[] {
  return auditMock.mock.calls.map((c) => (c[1] as { action: string }).action);
}

beforeEach(() => {
  vi.clearAllMocks();
  holdersMock.mockResolvedValue([holder]);
});

describe("re-assessment invite — email failure rolls back (audit finding 16)", () => {
  it("deletes the invitation, audits the failure and removes the login it created", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result).toEqual({ sent: 0, failed: 1, errors: ["parent@example.test: bounced"] });
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(auditActions()).toEqual(["BATCH_REASSESSMENT_INVITE", "CREATE_INVITATION_FAILED"]);
    expect(deleteUserMock).toHaveBeenCalledWith("auth-new");
  });

  it("keeps a REUSED login (only a login this call created is rolled back)", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-existing", created: false });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result.failed).toBe(1);
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("a successful send keeps the invitation", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
    expect(fakeTx.invitation.delete).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
