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
      update: vi.fn(async (..._args: unknown[]) => ({})),
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

  it("re-submits a REOPENED application keeping the ORIGINAL submission date and never rewriting submitted_at (D-G6/D3)", async () => {
    // A reopened app: form back to FILLED_IN, but submittedAt is the RETAINED
    // original instant. The core must not throw (write-once guard relaxed for
    // re-submit) and must NOT include submittedAt in the update (leaving it
    // unchanged satisfies the immutable-submitted_at trigger).
    const originalSubmittedAt = new Date("2026-05-01T10:00:00.000Z");
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        formStatus: "FILLED_IN",
        submittedAt: originalSubmittedAt,
      })
    );

    const result = await submitApplicationCore(CORE_INPUT);
    expect(result).toEqual({ alreadySubmitted: false, reference: "APP-1" });

    // The SUBMITTED transition ran...
    expect(fakeTx.application.update).toHaveBeenCalledTimes(1);
    const updateArg = fakeTx.application.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.formStatus).toBe("SUBMITTED");
    // ...but submitted_at (and the historic T&Cs acceptance) is NOT rewritten.
    expect(updateArg.data).not.toHaveProperty("submittedAt");
    expect(updateArg.data).not.toHaveProperty("termsAcceptedAt");
    expect(updateArg.data).not.toHaveProperty("termsVersion");

    // The audit records the ORIGINAL submission instant, not "now".
    expect(auditMock).toHaveBeenCalledTimes(1);
    const auditArg = auditMock.mock.calls[0]![0] as {
      metadata: Record<string, unknown>;
    };
    expect(auditArg.metadata.submittedAt).toBe(originalSubmittedAt.toISOString());
  });

  it("stamps submitted_at + T&Cs on a FIRST submission (submittedAt was null)", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({ formStatus: "FILLED_IN", submittedAt: null })
    );

    await submitApplicationCore(CORE_INPUT);

    const updateArg = fakeTx.application.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.formStatus).toBe("SUBMITTED");
    expect(updateArg.data.submittedAt).toBeInstanceOf(Date);
    expect(updateArg.data).toHaveProperty("termsAcceptedAt");
    expect(updateArg.data).toHaveProperty("termsVersion");
  });

  // ── Entry year group is JWF-facing only (Q1, Brian 2026-08-14) ───────────
  // The applicant cannot enter it, so submit must not read it out of the
  // CHILD_DETAILS blob nor write the column at all. The entry *calendar* year
  // is still backfilled from the round.
  it("never promotes an entryYearGroup out of the CHILD_DETAILS blob", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        entryYear: null,
        entryYearGroup: null,
        sections: SECTION_ORDER.map((section) => ({
          section,
          isComplete: true,
          // A legacy draft that still carries the field in its blob.
          data: section === "CHILD_DETAILS" ? { entryYearGroup: "Y12" } : {},
        })),
      })
    );

    await submitApplicationCore(CORE_INPUT);

    const updateArg = fakeTx.application.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data).not.toHaveProperty("entryYearGroup");
    // The entry calendar year is still derived from the round.
    expect(updateArg.data.entryYear).toBe(2026);
  });

  it("never clobbers an admin-set entry year group on submit", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        entryYear: 2024,
        entryYearGroup: "Y9",
        sections: SECTION_ORDER.map((section) => ({
          section,
          isComplete: true,
          data: section === "CHILD_DETAILS" ? { entryYearGroup: "Y12" } : {},
        })),
      })
    );

    await submitApplicationCore(CORE_INPUT);

    const updateArg = fakeTx.application.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // Not written at all — so the admin value on the row survives untouched.
    expect(updateArg.data).not.toHaveProperty("entryYearGroup");
    // An entry calendar year already set is likewise preserved.
    expect(updateArg.data.entryYear).toBe(2024);
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
