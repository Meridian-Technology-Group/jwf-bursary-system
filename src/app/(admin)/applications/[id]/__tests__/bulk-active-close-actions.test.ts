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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// actions.ts imports sendEmail for other (unrelated) actions in the same
// file; @/lib/email/resend throws at module load without RESEND_API_KEY, so
// this must be mocked even though neither bulk action under test sends email.
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  sendBatchEmails: vi.fn(async () => ({ sent: 0, failed: 0, errors: [] })),
  sendRawEmail: vi.fn(async () => ({ success: true })),
}));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));

const promoteMock = vi.fn(
  async () => ({ bursaryAccountId: "acct-new", created: true }) as {
    bursaryAccountId: string;
    created: boolean;
  }
);
vi.mock("@/lib/applications/account-promotion", () => ({
  promoteToActiveAccount: (...args: unknown[]) => promoteMock(...(args as [])),
}));

const closeCoreMock = vi.fn();
vi.mock("@/lib/applications/close", () => ({
  closeApplicationCore: (...args: unknown[]) => closeCoreMock(...(args as [])),
}));

const deleteAuthMock = vi.fn(async () => [] as string[]);
vi.mock("@/lib/retention/close-purge", () => ({
  deleteAuthUsersPostCommit: (...args: unknown[]) => deleteAuthMock(...(args as [])),
}));

vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
  }),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
const withAdminContextMock = vi.fn((fn: (tx: unknown) => unknown) => fn(fakeTx));
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (...args: unknown[]) =>
    withAdminContextMock(...(args as [(tx: unknown) => unknown])),
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import {
  bulkMarkActiveAction,
  bulkCloseApplicationsAction,
} from "../actions";

// ─── bulkMarkActiveAction fixtures ─────────────────────────────────────────────

interface FakeApp {
  id: string;
  reference: string;
  school: string;
  childName: string;
  childDob: null;
  entryYear: number;
  entryYearGroup: null;
  bursaryAccountId: null;
  leadApplicantId: string;
  closedAt: Date | null;
  round: { academicYear: string; openDate: Date; closeDate: Date };
  assessment: {
    status: string;
    outcome: string | null;
    yearlyPayableFees: null;
    recommendation: { bursaryAward: number; scholarshipAward: number } | null;
  } | null;
}

function validApp(overrides: Partial<FakeApp> = {}): FakeApp {
  return {
    id: "app-valid",
    reference: "REF-VALID",
    school: "WHITGIFT",
    childName: "Child A",
    childDob: null,
    entryYear: 2020,
    entryYearGroup: null,
    bursaryAccountId: null,
    leadApplicantId: "lead-1",
    closedAt: null,
    round: {
      academicYear: "2025/26",
      openDate: new Date("2025-09-01"),
      closeDate: new Date("2026-01-01"),
    },
    assessment: {
      status: "COMPLETED",
      outcome: null,
      yearlyPayableFees: null,
      recommendation: null,
    },
    ...overrides,
  };
}

function makeFakeTx({
  apps = new Map<string, FakeApp | null>(),
  referenceRows = [] as { id: string; reference: string }[],
} = {}) {
  return {
    application: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        apps.has(where.id) ? apps.get(where.id) : null
      ),
      findMany: vi.fn(async () => referenceRows),
    },
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
  promoteMock.mockResolvedValue({ bursaryAccountId: "acct-new", created: true });
});

describe("bulkMarkActiveAction", () => {
  it("no-ops on empty input", async () => {
    fakeTx = makeFakeTx();
    const res = await bulkMarkActiveAction([]);
    expect(res).toEqual({ success: true, succeeded: 0, skipped: [] });
    expect(promoteMock).not.toHaveBeenCalled();
  });

  it("dedupes ids before processing", async () => {
    const apps = new Map([["app-valid", validApp()]]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-valid", "app-valid"]);
    expect(res.succeeded).toBe(1);
    expect(promoteMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a batch over the 500 cap without touching the DB", async () => {
    fakeTx = makeFakeTx();
    const ids = Array.from({ length: 501 }, (_, i) => `app-${i}`);
    const res = await bulkMarkActiveAction(ids);
    expect(res.success).toBe(false);
    expect(res.error).toContain("500");
    expect(fakeTx.application.findUnique).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    fakeTx = makeFakeTx();
    const res = await bulkMarkActiveAction(["app-valid"]);
    expect(res.success).toBe(false);
    expect(promoteMock).not.toHaveBeenCalled();
  });

  it("activates a valid row: promotes, audits APPLICATION_MARKED_ACTIVE, no skip", async () => {
    const apps = new Map([["app-valid", validApp()]]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-valid"]);

    expect(res).toEqual({ success: true, succeeded: 1, skipped: [] });
    expect(promoteMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]?.[1] as {
      action: string;
      metadata: { accountId: string; created: boolean; reference: string };
    };
    expect(auditArg.action).toBe("APPLICATION_MARKED_ACTIVE");
    expect(auditArg.metadata).toEqual({
      accountId: "acct-new",
      created: true,
      reference: "REF-VALID",
    });
  });

  it("skips a closed application", async () => {
    const apps = new Map([
      ["app-closed", validApp({ id: "app-closed", reference: "REF-CLOSED", closedAt: new Date() })],
    ]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-closed"]);
    expect(res.succeeded).toBe(0);
    expect(res.skipped).toEqual([
      { id: "app-closed", reference: "REF-CLOSED", reason: "Application is closed." },
    ]);
    expect(promoteMock).not.toHaveBeenCalled();
  });

  it("skips an application whose assessment is not COMPLETED", async () => {
    const apps = new Map([
      [
        "app-inprogress",
        validApp({
          id: "app-inprogress",
          reference: "REF-INPROGRESS",
          assessment: {
            status: "IN_PROGRESS",
            outcome: null,
            yearlyPayableFees: null,
            recommendation: null,
          },
        }),
      ],
    ]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-inprogress"]);
    expect(res.skipped).toEqual([
      {
        id: "app-inprogress",
        reference: "REF-INPROGRESS",
        reason: "The assessment is not yet complete.",
      },
    ]);
    expect(promoteMock).not.toHaveBeenCalled();
  });

  it("skips an application that already has an outcome recorded", async () => {
    const apps = new Map([
      [
        "app-decided",
        validApp({
          id: "app-decided",
          reference: "REF-DECIDED",
          assessment: {
            status: "COMPLETED",
            outcome: "AWARDED",
            yearlyPayableFees: null,
            recommendation: null,
          },
        }),
      ],
    ]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-decided"]);
    expect(res.skipped).toEqual([
      {
        id: "app-decided",
        reference: "REF-DECIDED",
        reason: "An outcome has already been recorded.",
      },
    ]);
    expect(promoteMock).not.toHaveBeenCalled();
  });

  it("skips an application that no longer exists", async () => {
    fakeTx = makeFakeTx();
    const res = await bulkMarkActiveAction(["ghost-app"]);
    expect(res.skipped).toEqual([
      { id: "ghost-app", reference: "ghost-app", reason: "Application not found." },
    ]);
  });

  it("processes a mixed batch: valid rows succeed, invalid rows are skipped (batch never fails as a whole)", async () => {
    const apps = new Map([
      ["app-valid", validApp()],
      ["app-closed", validApp({ id: "app-closed", reference: "REF-CLOSED", closedAt: new Date() })],
    ]);
    fakeTx = makeFakeTx({ apps });
    const res = await bulkMarkActiveAction(["app-valid", "app-closed"]);
    expect(res.success).toBe(true);
    expect(res.succeeded).toBe(1);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].id).toBe("app-closed");
    expect(promoteMock).toHaveBeenCalledTimes(1);
  });

  it("passes through the recommendation's award figures (nulls when absent)", async () => {
    const apps = new Map([
      [
        "app-awards",
        validApp({
          id: "app-awards",
          reference: "REF-AWARDS",
          assessment: {
            status: "COMPLETED",
            outcome: null,
            yearlyPayableFees: null,
            recommendation: { bursaryAward: 1000, scholarshipAward: 500 },
          },
        }),
      ],
    ]);
    fakeTx = makeFakeTx({ apps });
    await bulkMarkActiveAction(["app-awards"]);
    const [, , awardsArg] = promoteMock.mock.calls[0] as [unknown, unknown, unknown];
    expect(awardsArg).toEqual({ bursaryAward: 1000, scholarshipAward: 500 });
  });

  it("uses null award figures when there is no recommendation yet", async () => {
    const apps = new Map([["app-valid", validApp()]]);
    fakeTx = makeFakeTx({ apps });
    await bulkMarkActiveAction(["app-valid"]);
    const [, , awardsArg] = promoteMock.mock.calls[0] as [unknown, unknown, unknown];
    expect(awardsArg).toEqual({ bursaryAward: null, scholarshipAward: null });
  });
});

// ─── bulkCloseApplicationsAction ────────────────────────────────────────────────

beforeEach(() => {
  closeCoreMock.mockReset();
});

describe("bulkCloseApplicationsAction", () => {
  it("requires a close reason", async () => {
    fakeTx = makeFakeTx();
    const res = await bulkCloseApplicationsAction(["app-1"], "");
    expect(res.success).toBe(false);
    expect(res.error).toContain("reason");
    expect(closeCoreMock).not.toHaveBeenCalled();
  });

  it("no-ops on empty input", async () => {
    fakeTx = makeFakeTx();
    const res = await bulkCloseApplicationsAction([], "reason-1");
    expect(res).toEqual({ success: true, succeeded: 0, skipped: [] });
    expect(closeCoreMock).not.toHaveBeenCalled();
  });

  it("rejects a batch over the 500 cap", async () => {
    fakeTx = makeFakeTx();
    const ids = Array.from({ length: 501 }, (_, i) => `app-${i}`);
    const res = await bulkCloseApplicationsAction(ids, "reason-1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("500");
    expect(closeCoreMock).not.toHaveBeenCalled();
  });

  it("is role-gated: a non-ADMIN caller is rejected before any DB write", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Forbidden"));
    fakeTx = makeFakeTx();
    const res = await bulkCloseApplicationsAction(["app-1"], "reason-1");
    expect(res.success).toBe(false);
    expect(closeCoreMock).not.toHaveBeenCalled();
  });

  it("runs each row in its OWN withAdminContext transaction (not one giant tx)", async () => {
    fakeTx = makeFakeTx({
      referenceRows: [
        { id: "app-a", reference: "REF-A" },
        { id: "app-b", reference: "REF-B" },
      ],
    });
    closeCoreMock.mockResolvedValue({
      success: true,
      reference: "REF",
      closeReasonLabel: "Relocation",
      purgeRan: false,
      accountClosed: false,
      authUsersToDelete: [],
    });
    await bulkCloseApplicationsAction(["app-a", "app-b"], "reason-1");
    // One call to resolve references up front + one call per row.
    expect(withAdminContextMock).toHaveBeenCalledTimes(3);
  });

  it("loops closeApplicationCore per row and aggregates succeeded/skipped using the core's own error", async () => {
    fakeTx = makeFakeTx({
      referenceRows: [
        { id: "app-ok", reference: "REF-OK" },
        { id: "app-bad", reference: "REF-BAD" },
      ],
    });
    closeCoreMock.mockImplementation(
      async (_tx: unknown, input: { applicationId: string }) => {
        if (input.applicationId === "app-ok") {
          return {
            success: true,
            reference: "REF-OK",
            closeReasonLabel: "Relocation",
            purgeRan: false,
            accountClosed: false,
            authUsersToDelete: [],
          };
        }
        return { success: false, error: "Application is already closed." };
      }
    );

    const res = await bulkCloseApplicationsAction(["app-ok", "app-bad"], "reason-1");
    expect(res.success).toBe(true);
    expect(res.succeeded).toBe(1);
    expect(res.skipped).toEqual([
      { id: "app-bad", reference: "REF-BAD", reason: "Application is already closed." },
    ]);
    expect(closeCoreMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the raw id for skip reporting when no reference could be resolved", async () => {
    fakeTx = makeFakeTx({ referenceRows: [] });
    closeCoreMock.mockResolvedValue({ success: false, error: "Application not found." });
    const res = await bulkCloseApplicationsAction(["ghost-app"], "reason-1");
    expect(res.skipped).toEqual([
      { id: "ghost-app", reference: "ghost-app", reason: "Application not found." },
    ]);
  });

  it("runs deleteAuthUsersPostCommit after a row whose close purged and queued auth deletions", async () => {
    fakeTx = makeFakeTx({ referenceRows: [{ id: "app-purge", reference: "REF-PURGE" }] });
    closeCoreMock.mockResolvedValue({
      success: true,
      reference: "REF-PURGE",
      closeReasonLabel: "Declined by the school",
      purgeRan: true,
      accountClosed: false,
      authUsersToDelete: ["user-123"],
    });
    await bulkCloseApplicationsAction(["app-purge"], "reason-2");
    expect(deleteAuthMock).toHaveBeenCalledTimes(1);
    const [userIds] = deleteAuthMock.mock.calls[0] as [string[], unknown];
    expect(userIds).toEqual(["user-123"]);
  });

  it("does not call deleteAuthUsersPostCommit when no purge ran", async () => {
    fakeTx = makeFakeTx({ referenceRows: [{ id: "app-plain", reference: "REF-PLAIN" }] });
    closeCoreMock.mockResolvedValue({
      success: true,
      reference: "REF-PLAIN",
      closeReasonLabel: "Relocation",
      purgeRan: false,
      accountClosed: true,
      authUsersToDelete: [],
    });
    await bulkCloseApplicationsAction(["app-plain"], "reason-1");
    expect(deleteAuthMock).not.toHaveBeenCalled();
  });
});
