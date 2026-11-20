import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit 20 Nov 2026, finding 6: Send to assessor resumes the assessment only
 * when every requested slot has a file uploaded AFTER the request. Before,
 * the old (wrong) file counted and the assessment resumed unchanged.
 */

vi.mock("@/lib/auth/roles", () => ({
  requireRole: vi.fn(async () => ({ id: "lead-1", role: "APPLICANT" })),
  Role: { APPLICANT: "APPLICANT", ADMIN: "ADMIN", ASSESSOR: "ASSESSOR" },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/queries/invitations", () => ({
  getLatestAcceptedInvitationForUser: vi.fn(),
  markInvitationAccepted: vi.fn(),
}));
vi.mock("@/lib/db/queries/reassessment", () => ({
  createReassessmentApplicationFromInvitation: vi.fn(),
}));
vi.mock("@/lib/applications/create-from-invitation", () => ({
  canCreateFirstYearApplication: vi.fn(),
  createFirstYearApplicationFromSource: vi.fn(),
}));
vi.mock("@/lib/portal/active-application", () => ({ setActiveApplicationId: vi.fn() }));
const resumeReviewMock = vi.fn(async () => undefined);
vi.mock("@/lib/applications/status", () => ({
  resumeReview: (...args: unknown[]) => resumeReviewMock(...(args as [])),
}));
const auditMock = vi.fn(async () => undefined);
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (...args: unknown[]) => auditMock(...(args as [])),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));

const REQUESTED_AT = new Date("2026-11-20T10:00:00Z");
vi.mock("@/lib/db/queries/missing-docs", () => ({
  getLatestMissingDocsRequest: vi.fn(async () => ({
    requestedSlots: ["BANK_STATEMENT_PARENT_1"],
    customMessage: null,
    requestedAt: REQUESTED_AT,
  })),
}));

const SUBMITTED_AT = new Date("2026-10-01T09:00:00Z");
let newDocs: { slot: string; uploadedAt: Date }[];
const fakeTx = {
  application: {
    findUnique: vi.fn(async (args: { select: Record<string, unknown> }) =>
      "leadApplicantId" in args.select
        ? {
            id: "app-1",
            reference: "REF-1",
            formStatus: "SUBMITTED",
            submittedAt: SUBMITTED_AT,
            childName: "Child",
            leadApplicantId: "lead-1",
            assignedToId: null,
            assessment: { id: "assess-1", status: "PAUSED", assessorId: "assessor-1" },
          }
        : { submittedAt: SUBMITTED_AT, formStatus: "SUBMITTED" }
    ),
  },
  document: {
    findMany: vi.fn(async () => newDocs),
  },
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { submitMissingDocsResponse } from "../actions";

describe("submitMissingDocsResponse — a new file is required", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses when the only file in the requested slot predates the request", async () => {
    newDocs = []; // the query only returns files uploaded after the request
    const result = await submitMissingDocsResponse("app-1");

    expect(result).toEqual({
      success: false,
      error:
        "Please upload a new copy of: Bank Statement — Parent 1. The documents you sent earlier are still on file, but the assessor has asked for new ones.",
    });
    expect(resumeReviewMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
    // Only files newer than the request are looked for.
    expect(fakeTx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uploadedAt: { gt: REQUESTED_AT } }),
      })
    );
  });

  it("resumes the assessment once a new file is uploaded", async () => {
    newDocs = [{ slot: "BANK_STATEMENT_PARENT_1", uploadedAt: new Date("2026-11-20T10:30:00Z") }];
    const result = await submitMissingDocsResponse("app-1");

    expect(result).toEqual({ success: true });
    expect(resumeReviewMock).toHaveBeenCalledTimes(1);
  });
});
