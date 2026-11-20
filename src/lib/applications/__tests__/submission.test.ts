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

const mirrorMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/bursary-accounts/lifecycle", () => ({
  mirrorApplicationToSchedule: (...args: unknown[]) => mirrorMock(...args),
}));

import { submitApplicationCore } from "../submission";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import {
  REASSESSMENT_SECTION_ORDER,
  SECTION_ORDER,
} from "@/lib/portal/sections";

function makeFakeTx() {
  return {
    application: {
      findUnique: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      updateMany: vi.fn(async (..._args: unknown[]) => ({ count: 1 })),
      // Not used by the core any more (the transition is a conditional
      // updateMany) — kept so a regression to an unconditional update fails
      // these tests on their assertions rather than on a missing mock.
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

    expect(fakeTx.application.updateMany).not.toHaveBeenCalled();
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
    expect(fakeTx.application.updateMany).toHaveBeenCalledTimes(1);
    const updateArg = fakeTx.application.updateMany.mock.calls[0]![0] as {
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

    const updateArg = fakeTx.application.updateMany.mock.calls[0]![0] as {
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

    const updateArg = fakeTx.application.updateMany.mock.calls[0]![0] as {
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

    const updateArg = fakeTx.application.updateMany.mock.calls[0]![0] as {
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
    expect(fakeTx.application.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  // ── Audit 20 Nov 2026: a rolling-over re-assessment hides FAMILY_ID ───────
  // The wizard redirects away from it and it is never created, so requiring
  // it blocked every re-assessment submit (portal and on-behalf alike).
  it("submits a ROLLING_OVER application that has no FAMILY_ID section", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        applicationType: "ROLLING_OVER",
        sections: REASSESSMENT_SECTION_ORDER.map((section) => ({
          section,
          isComplete: true,
          data: {},
        })),
      })
    );

    const result = await submitApplicationCore(CORE_INPUT);

    expect(result).toEqual({ alreadySubmitted: false, reference: "APP-1" });
    const updateArg = fakeTx.application.updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.formStatus).toBe("SUBMITTED");
  });

  it("still requires FAMILY_ID on a NEW application", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        applicationType: "NEW",
        sections: REASSESSMENT_SECTION_ORDER.map((section) => ({
          section,
          isComplete: true,
          data: {},
        })),
      })
    );

    await expect(submitApplicationCore(CORE_INPUT)).rejects.toThrow(
      "The following sections are not yet complete: FAMILY_ID. Please complete them before submitting."
    );
    expect(fakeTx.application.updateMany).not.toHaveBeenCalled();
  });

  // ── Audit finding 13: the SUBMITTED transition is conditional ─────────────
  // The gates read in earlier transactions, so two tabs submitting at once
  // both pass them. Only one may transition; the other must come back as
  // "already submitted" and must not audit, mirror or email a second time.
  it("makes the SUBMITTED write conditional on the form not already being SUBMITTED", async () => {
    fakeTx.application.findUnique.mockResolvedValue(makeApplication());

    await submitApplicationCore(CORE_INPUT);

    expect(fakeTx.application.update).not.toHaveBeenCalled();
    const arg = fakeTx.application.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where).toEqual({
      id: "app-1",
      formStatus: { not: "SUBMITTED" },
    });
  });

  it("returns alreadySubmitted — with no second audit, schedule mirror or email — when a concurrent submit won", async () => {
    // Both tabs loaded the reopened form as FILLED_IN and passed every gate…
    fakeTx.application.findUnique
      .mockResolvedValueOnce(
        makeApplication({
          bursaryAccountId: "acct-1",
          submittedAt: new Date("2026-05-01T10:00:00.000Z"),
        })
      )
      // …but by the time this tab's UPDATE runs, the other tab has committed.
      .mockResolvedValueOnce({ formStatus: "SUBMITTED" });
    fakeTx.application.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await submitApplicationCore(CORE_INPUT);

    expect(result).toEqual({ alreadySubmitted: true });
    expect(auditMock).not.toHaveBeenCalled();
    expect(mirrorMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("still fails (never a false 'already submitted') when zero rows updated but the form is not SUBMITTED", async () => {
    fakeTx.application.findUnique
      .mockResolvedValueOnce(makeApplication())
      .mockResolvedValueOnce({ formStatus: "FILLED_IN" });
    fakeTx.application.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(submitApplicationCore(CORE_INPUT)).rejects.toThrow(
      "The application could not be marked as submitted."
    );
    expect(auditMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("dates the confirmation email with the RETAINED original submission date on a re-submission", async () => {
    fakeTx.application.findUnique.mockResolvedValue(
      makeApplication({
        formStatus: "FILLED_IN",
        submittedAt: new Date("2026-05-01T10:00:00.000Z"),
      })
    );

    await submitApplicationCore(CORE_INPUT);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [, template, fields] = sendEmailMock.mock.calls[0]! as unknown as [
      string,
      string,
      Record<string, string>,
    ];
    expect(template).toBe("CONFIRMATION");
    expect(fields.submission_date).toBe("1 May 2026");
  });
});
