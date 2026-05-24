import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// The shared core authenticates, runs two `withUserContext` transactions
// (status/account write, then the audit write) and sends an email. We mock
// those boundaries and pass a fake Prisma `tx` through `withUserContext` so we
// can assert the invariant: exactly one BursaryAccount create and one audit
// write on QUALIFIES, and zero account creates on DOES_NOT_QUALIFY.

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

const sendEmailMock = vi.fn(async () => ({
  success: true as const,
  messageId: "msg-123",
}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: () => sendEmailMock(),
}));

const generateRefMock = vi.fn(async () => "BA-20252026-0001");
vi.mock("@/lib/bursary-accounts/reference", () => ({
  generateBursaryAccountReference: () => generateRefMock(),
}));

// `withUserContext` normally opens a real transaction. Here it just invokes
// the callback with our fake `tx`.
let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (
    _userId: string,
    _role: string,
    fn: (tx: unknown) => unknown
  ) => fn(fakeTx),
}));

import { setApplicationOutcome } from "../set-outcome-core";

// ─── Fake Prisma transaction client ───────────────────────────────────────────

function makeFakeTx(application: Record<string, unknown>) {
  return {
    application: {
      findUnique: vi.fn(async () => application),
      update: vi.fn(async () => ({})),
    },
    bursaryAccount: {
      create: vi.fn(async () => ({ id: "account-1" })),
    },
    auditLog: {
      create: vi.fn(async (_args: { data: { action: string } }) => ({})),
    },
  };
}

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "APP-2025-0001",
    status: "COMPLETED",
    childName: "Child Name",
    childDob: new Date("2014-01-01"),
    entryYear: 2025,
    entryYearGroup: "Year 7",
    school: "WHITGIFT",
    bursaryAccountId: null,
    leadApplicantId: "lead-1",
    leadApplicant: {
      id: "lead-1",
      email: "parent@example.test",
      firstName: "Pat",
      lastName: "Parent",
    },
    round: { academicYear: "2025/2026" },
    assessment: { yearlyPayableFees: 12000 },
    ...overrides,
  };
}

describe("setApplicationOutcome (shared core)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates exactly one BursaryAccount and one audit row on QUALIFIES", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome("app-1", "QUALIFIES");

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).toHaveBeenCalledTimes(1);
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);

    // Canonical audit action key.
    const auditArg = fakeTx.auditLog.create.mock.calls[0]?.[0];
    expect(auditArg?.data.action).toBe("APPLICATION_OUTCOME_SET");
  });

  it("does NOT create a BursaryAccount on DOES_NOT_QUALIFY, but still writes one audit row", async () => {
    fakeTx = makeFakeTx(baseApplication());

    const result = await setApplicationOutcome("app-1", "DOES_NOT_QUALIFY");

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: skips BursaryAccount creation when the application is already linked", async () => {
    fakeTx = makeFakeTx(
      baseApplication({ bursaryAccountId: "existing-account" })
    );

    const result = await setApplicationOutcome("app-1", "QUALIFIES");

    expect(result).toEqual({ success: true });
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("rejects the transition from a non-COMPLETED status without side effects", async () => {
    fakeTx = makeFakeTx(baseApplication({ status: "NOT_STARTED" }));

    const result = await setApplicationOutcome("app-1", "QUALIFIES");

    expect(result.success).toBe(false);
    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(fakeTx.bursaryAccount.create).not.toHaveBeenCalled();
    expect(fakeTx.auditLog.create).not.toHaveBeenCalled();
  });
});
