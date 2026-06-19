import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * submitApplicationCore sanity (CR-001 PR B).
 *
 * The core was extracted verbatim from the portal `submitApplication` action;
 * the full portal flow is covered by the suite's existing submit tests. These
 * two checks pin the contract the on-behalf caller depends on:
 *
 *   - an already-SUBMITTED form returns `{ alreadySubmitted: true }` (never
 *     throws, never redirects, writes nothing);
 *   - the completeness gate throws with the exact applicant-grade message the
 *     portal threw before the extraction.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

// The real email module throws at import time when RESEND_API_KEY is unset.
const sendEmailMock = vi.fn(async (..._args: unknown[]) => ({
  success: true,
  messageId: "msg-1",
}));
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...(args as [])),
}));

const auditMock = vi.fn(async (_entry: unknown) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (_tx: unknown, entry: unknown) => auditMock(entry),
}));

// The gap engine is `server-only`, which vitest cannot resolve — and neither
// of these tests should reach it.
const gapStatusesMock = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("@/lib/portal/section-gaps", () => ({
  getSectionGapStatuses: (..._args: unknown[]) => gapStatusesMock(),
}));

import { submitApplicationCore } from "../submission";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { SECTION_ORDER } from "@/lib/portal/sections";

function makeFakeTx() {
  return {
    application: {
      findUnique: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      update: vi.fn(async () => ({})),
    },
  };
}

// The full select shape the core loads, with every section complete.
function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "APP-1",
    formStatus: "FILLED_IN",
    submittedAt: null,
    leadApplicantId: "lead-1",
    childName: "Charlie Example",
    childDob: null,
    school: "WHITGIFT",
    entryYear: null,
    entryYearGroup: null,
    submissionDeadlineAt: null,
    bursaryAccountId: null,
    roundId: "round-1",
    round: { academicYear: "2026/2027", closeDate: new Date("2026-08-31") },
    sections: SECTION_ORDER.map((section) => ({
      section,
      isComplete: true,
      data: {},
    })),
    ...overrides,
  };
}

const CORE_INPUT = {
  actor: { id: "lead-1", role: "APPLICANT" as const },
  applicationId: "app-1",
  ownerContributorId: "contrib-1",
  enforceDeadline: false,
  auditAction: AUDIT_ACTIONS.APPLICATION_SUBMITTED,
  confirmation: { to: "lead@example.test", applicantName: "Lia Lead" },
};

describe("submitApplicationCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeTx = makeFakeTx();
  });

  it("short-circuits an already-SUBMITTED form without writing anything", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        formStatus: "SUBMITTED",
        submittedAt: new Date("2026-05-01T10:00:00.000Z"),
      })
    );

    const result = await submitApplicationCore(CORE_INPUT);
    expect(result).toEqual({ alreadySubmitted: true });

    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(gapStatusesMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("throws the exact completeness-gate message naming the incomplete sections", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        sections: SECTION_ORDER.map((section) => ({
          section,
          isComplete: section !== "DECLARATION",
          data: {},
        })),
      })
    );

    await expect(submitApplicationCore(CORE_INPUT)).rejects.toThrow(
      "The following sections are not yet complete: DECLARATION. Please complete them before submitting."
    );

    // The gate fires BEFORE the gap engine, the transition and the email.
    expect(gapStatusesMock).not.toHaveBeenCalled();
    expect(fakeTx.application.update).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});
