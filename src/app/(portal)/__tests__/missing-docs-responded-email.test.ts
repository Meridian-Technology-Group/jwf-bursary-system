/**
 * Who is told when a parent responds to a missing-documents request.
 *
 * Charlotte (7 Nov 2026): the MISSING_DOCS_RESPONDED email goes to the fees
 * inbox (`PORTAL_ENQUIRY_INBOX`) only — never the assessor's own email — and
 * whether or not an assessor is assigned. Unset inbox → nothing is sent.
 *
 * Boundary mocks follow apply/__tests__/submit-error-surface.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const APPLICANT_USER = {
  id: "parent-1",
  role: "APPLICANT",
  email: "parent@example.test",
  firstName: "Pat",
  lastName: "Parent",
  phone: null,
};

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, requireRole: async () => APPLICANT_USER };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/applications/status", () => ({ resumeReview: vi.fn() }));
vi.mock("@/lib/portal/missing-docs-invariant", () => ({
  assertSubmissionInvariantPreserved: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://app.test" }));

const sendEmailMock = vi.fn(async () => ({ success: true, messageId: "msg-1" }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...(args as [])),
}));

const PAUSED_APP = {
  id: "app-1",
  reference: "APP-1",
  formStatus: "SUBMITTED",
  submittedAt: new Date("2026-11-01T00:00:00Z"),
  childName: "Charlie Example",
  leadApplicantId: "parent-1",
  assignedToId: "assessor-1" as string | null,
  assessment: { id: "asmt-1", status: "PAUSED", assessorId: "assessor-1" },
};

const fakeTx = {
  application: { findUnique: vi.fn() },
  profile: {
    findUnique: vi.fn(async () => ({
      email: "assessor@example.test",
      firstName: "Ada",
      lastName: "Assessor",
    })),
  },
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { submitMissingDocsResponse } from "../actions";

describe("submitMissingDocsResponse — MISSING_DOCS_RESPONDED recipient", () => {
  const originalInbox = process.env.PORTAL_ENQUIRY_INBOX;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeTx.application.findUnique.mockResolvedValue({ ...PAUSED_APP });
    process.env.PORTAL_ENQUIRY_INBOX = "fees@example.test";
  });

  afterEach(() => {
    if (originalInbox === undefined) delete process.env.PORTAL_ENQUIRY_INBOX;
    else process.env.PORTAL_ENQUIRY_INBOX = originalInbox;
    vi.restoreAllMocks();
  });

  it("emails the fees inbox, not the assessor, greeting the assigned assessor", async () => {
    const res = await submitMissingDocsResponse("app-1");
    expect(res).toEqual({ success: true });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      "fees@example.test",
      "MISSING_DOCS_RESPONDED",
      {
        assessor_name: "Ada Assessor",
        child_name: "Charlie Example",
        reference: "APP-1",
        application_link: "https://app.test/applications/app-1",
      }
    );
  });

  it("still emails the fees inbox when no assessor is assigned", async () => {
    fakeTx.application.findUnique.mockResolvedValue({
      ...PAUSED_APP,
      assignedToId: null,
    });

    const res = await submitMissingDocsResponse("app-1");
    expect(res).toEqual({ success: true });

    expect(fakeTx.profile.findUnique).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledWith(
      "fees@example.test",
      "MISSING_DOCS_RESPONDED",
      expect.objectContaining({ assessor_name: "Fees team" })
    );
  });

  it("sends nothing when the fees inbox is unset", async () => {
    delete process.env.PORTAL_ENQUIRY_INBOX;

    const res = await submitMissingDocsResponse("app-1");
    expect(res).toEqual({ success: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
