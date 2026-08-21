import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const requireRoleMock = vi.fn(async () => ({
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Ad",
  lastName: "Min",
}));
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...(args as [])),
  };
});

let fakeTx: {
  emailTemplate: { findUnique: ReturnType<typeof vi.fn> };
  application: { findMany: ReturnType<typeof vi.fn> };
};
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

interface SendRawEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
const sendRawEmailMock = vi.fn(
  async (): Promise<SendRawEmailResult> => ({ success: true, messageId: "msg-1" })
);
vi.mock("@/lib/email/send", () => ({
  sendRawEmail: (...args: unknown[]) => sendRawEmailMock(...(args as [])),
  fromAddress: () => "bursary@updates.meridiantech.group",
}));

import { bulkSendEmailAction } from "../bulk-email-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tpl-1",
    type: null,
    name: "Test Template",
    subject: "Hi {{applicant_name}}",
    body: "Ref {{reference}}",
    enabled: true,
    deletedAt: null,
    mergeFields: ["applicant_name", "reference"],
    ...overrides,
  };
}

function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "TRI-2026-0001",
    childName: "Jamie Smith",
    school: "TRINITY",
    submissionDeadlineAt: null,
    round: { academicYear: "2026/27", closeDate: new Date("2026-09-30T00:00:00.000Z") },
    leadApplicant: {
      firstName: "Pat",
      lastName: "Smith",
      email: "pat@example.test",
      role: "APPLICANT",
    },
    ...overrides,
  };
}

function makeFakeTx(template: unknown, applications: unknown[]) {
  return {
    emailTemplate: { findUnique: vi.fn(async () => template) },
    application: { findMany: vi.fn(async () => applications) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@example.test",
    firstName: "Ad",
    lastName: "Min",
  });
  sendRawEmailMock.mockResolvedValue({ success: true, messageId: "msg-1" });
});

describe("bulkSendEmailAction", () => {
  it("sends to sendable recipients, pre-skips unsendable ones, and continues after a per-recipient failure", async () => {
    const sent = makeApplication({ id: "app-1", reference: "REF-1" });
    const failing = makeApplication({
      id: "app-2",
      reference: "REF-2",
      leadApplicant: { firstName: "Sam", lastName: "Jones", email: "sam@example.test", role: "APPLICANT" },
    });
    const deleted = makeApplication({
      id: "app-3",
      reference: "REF-3",
      leadApplicant: { firstName: null, lastName: null, email: "gone@example.test", role: "DELETED" },
    });
    fakeTx = makeFakeTx(makeTemplate(), [sent, failing, deleted]);

    sendRawEmailMock
      .mockResolvedValueOnce({ success: true, messageId: "msg-1" })
      .mockResolvedValueOnce({ success: false, error: "Resend rejected the address" });

    const result = await bulkSendEmailAction(["app-1", "app-2", "app-3"], "tpl-1");

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(sendRawEmailMock).toHaveBeenCalledTimes(2); // never called for the DELETED recipient

    const byId = Object.fromEntries(result.results.map((r) => [r.applicationId, r]));
    expect(byId["app-1"].outcome).toBe("sent");
    expect(byId["app-2"].outcome).toBe("failed");
    expect(byId["app-2"].reason).toBe("Resend rejected the address");
    expect(byId["app-3"].outcome).toBe("skipped");
    expect(byId["app-3"].reason).toMatch(/deleted/i);
  });

  it("writes one audit row per ATTEMPTED recipient (sent + failed), none for skipped", async () => {
    const sent = makeApplication({ id: "app-1", reference: "REF-1" });
    const deleted = makeApplication({
      id: "app-2",
      reference: "REF-2",
      leadApplicant: { firstName: null, lastName: null, email: "gone@example.test", role: "DELETED" },
    });
    fakeTx = makeFakeTx(makeTemplate(), [sent, deleted]);

    const result = await bulkSendEmailAction(["app-1", "app-2"], "tpl-1");

    expect(result.success).toBe(true);
    expect(auditMock).toHaveBeenCalledTimes(1); // only the sent one was attempted
    const auditArg = (auditMock.mock.calls[0] as unknown[])[1] as {
      action: string;
      metadata: { recipientApplicationId: string; outcome: string };
    };
    expect(auditArg.action).toBe("BULK_EMAIL_SENT");
    expect(auditArg.metadata.recipientApplicationId).toBe("app-1");
    expect(auditArg.metadata.outcome).toBe("sent");
  });

  it("rejects a batch larger than the 500-recipient cap without sending anything", async () => {
    fakeTx = makeFakeTx(makeTemplate(), []);
    const tooMany = Array.from({ length: 501 }, (_, i) => `app-${i}`);

    const result = await bulkSendEmailAction(tooMany, "tpl-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/500/);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("rejects when the template does not exist", async () => {
    fakeTx = makeFakeTx(null, [makeApplication()]);
    const result = await bulkSendEmailAction(["app-1"], "missing-tpl");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a soft-deleted template", async () => {
    fakeTx = makeFakeTx(makeTemplate({ deletedAt: new Date() }), [makeApplication()]);
    const result = await bulkSendEmailAction(["app-1"], "tpl-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a disabled template", async () => {
    fakeTx = makeFakeTx(makeTemplate({ enabled: false }), [makeApplication()]);
    const result = await bulkSendEmailAction(["app-1"], "tpl-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
  });

  it("rejects server-side (not just in the UI) a template with unresolvable merge fields", async () => {
    fakeTx = makeFakeTx(
      makeTemplate({ mergeFields: ["applicant_name", "registration_link"] }),
      [makeApplication()]
    );
    const result = await bulkSendEmailAction(["app-1"], "tpl-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/can't be filled in a bulk send/i);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any send", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    fakeTx = makeFakeTx(makeTemplate(), [makeApplication()]);

    const result = await bulkSendEmailAction(["app-1"], "tpl-1");

    expect(result.success).toBe(false);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("rejects an empty selection without touching the template or send layer", async () => {
    fakeTx = makeFakeTx(makeTemplate(), []);
    const result = await bulkSendEmailAction([], "tpl-1");

    expect(result.success).toBe(false);
    expect(sendRawEmailMock).not.toHaveBeenCalled();
  });
});
