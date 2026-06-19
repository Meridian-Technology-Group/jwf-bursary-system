import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Al",
  lastName: "Admin",
  phone: null,
};

const requireRoleMock = vi.fn(async () => ADMIN_USER);
const requireAccessMock = vi.fn(async () => undefined);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...(args as [])),
    requireApplicationAccess: (...args: unknown[]) =>
      requireAccessMock(...(args as [])),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Boundary-mock the email module — its real implementation throws at import
// time when RESEND_API_KEY is unset, and the actions module now reaches it
// (finishEditingOnBehalf directly; submitApplicationOnBehalf via the
// submission core).
type SendEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
};
const sendEmailMock = vi.fn(
  async (..._args: unknown[]): Promise<SendEmailResult> => ({
    success: true,
    messageId: "msg-1",
  })
);
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...(args as [])),
}));

// Boundary-mock the shared submission core (tested on its own) — importing the
// real module would drag in `server-only` via the gap engine, which vitest
// cannot resolve.
const submitCoreMock = vi.fn(
  async (
    ..._args: unknown[]
  ): Promise<
    { alreadySubmitted: true } | { alreadySubmitted: false; reference: string }
  > => ({ alreadySubmitted: false, reference: "APP-1" })
);
vi.mock("@/lib/applications/submission", () => ({
  submitApplicationCore: (...args: unknown[]) =>
    submitCoreMock(...(args as [])),
}));

const auditMock = vi.fn(async (_entry: unknown) => {});
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (_tx: unknown, entry: unknown) => auditMock(entry),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import {
  saveSectionOnBehalf,
  finishEditingOnBehalf,
  submitApplicationOnBehalf,
} from "../actions";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// Default scenario: SUBMITTED form, no assessment yet → review phase SUBMITTED,
// which IS editable on behalf. The same application object serves every
// preflight read (leadApplicantId/childName/leadApplicant) and the write-tx
// read (reference/formStatus/assessment) — the action only picks the fields
// each select names.
function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        leadApplicantId: "lead-1",
        reference: "APP-1",
        formStatus: "SUBMITTED",
        assessment: null,
        childName: "Charlie Example",
        leadApplicant: {
          email: "lead@example.test",
          firstName: "Lia",
          lastName: "Lead",
        },
      })),
      // refreshFormStatus reads this — SUBMITTED returns early without writing.
      findUniqueOrThrow: vi.fn(async () => ({
        formStatus: "SUBMITTED",
        applicationType: "NEW",
      })),
      update: vi.fn(async () => ({})),
    },
    applicationContributor: {
      // resolveOwningContributorId — the PRIMARY contributor already exists.
      findUnique: vi.fn(async () => ({ id: "contrib-1" })),
      upsert: vi.fn(async () => ({ id: "contrib-1" })),
    },
    applicationSection: {
      findUnique: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      // finishEditingOnBehalf derives the edited-section list from these rows.
      findMany: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
      upsert: vi.fn(async (..._args: unknown[]) => ({ id: "sec-row-1" })),
      count: vi.fn(async () => 0),
    },
    ...overrides,
  };
}

// ADDITIONAL_INFO has the simplest real schema (optional narrative + doc ids).
const VALID_PAYLOAD = {
  additionalNarrative: "Context from a phone call with the applicant.",
  additionalDocumentIds: [],
};

describe("saveSectionOnBehalf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(async () => ADMIN_USER);
    requireAccessMock.mockImplementation(async () => undefined);
    fakeTx = makeFakeTx();
  });

  it("propagates the requireRole redirect — nothing written, nothing audited", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(
      saveSectionOnBehalf("app-1", "ADDITIONAL_INFO", VALID_PAYLOAD)
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("propagates the requireApplicationAccess redirect for an unassigned assessor", async () => {
    requireRoleMock.mockResolvedValueOnce({
      ...ADMIN_USER,
      id: "assessor-1",
      role: "ASSESSOR",
    });
    requireAccessMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(
      saveSectionOnBehalf("app-1", "ADDITIONAL_INFO", VALID_PAYLOAD)
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("refuses when the assessment is COMPLETED — phase gate inside the tx", async () => {
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => ({
          leadApplicantId: "lead-1",
          reference: "APP-1",
          formStatus: "SUBMITTED",
          assessment: { status: "COMPLETED", outcome: null },
        })),
        findUniqueOrThrow: vi.fn(async () => ({
          formStatus: "SUBMITTED",
          applicationType: "NEW",
        })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await saveSectionOnBehalf(
      "app-1",
      "ADDITIONAL_INFO",
      VALID_PAYLOAD
    );
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toContain("review phase: COMPLETED");
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("refuses once an outcome is set", async () => {
    fakeTx = makeFakeTx({
      application: {
        findUnique: vi.fn(async () => ({
          leadApplicantId: "lead-1",
          reference: "APP-1",
          formStatus: "SUBMITTED",
          assessment: { status: "COMPLETED", outcome: "AWARDED" },
        })),
        findUniqueOrThrow: vi.fn(async () => ({
          formStatus: "SUBMITTED",
          applicationType: "NEW",
        })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await saveSectionOnBehalf(
      "app-1",
      "ADDITIONAL_INFO",
      VALID_PAYLOAD
    );
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toContain("review phase: QUALIFIES");
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns schema errors for an invalid payload without touching the DB", async () => {
    const res = await saveSectionOnBehalf("app-1", "ADDITIONAL_INFO", {
      additionalNarrative: 12345, // wrong type — real additionalInfoSchema rejects
    });
    expect(res.success).toBe(false);
    expect(res.errors?.length).toBeGreaterThan(0);
    // Validation fails BEFORE any transaction is opened.
    expect(fakeTx.application.findUnique).not.toHaveBeenCalled();
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("saves against a SUBMITTED form without demoting it", async () => {
    const res = await saveSectionOnBehalf(
      "app-1",
      "ADDITIONAL_INFO",
      VALID_PAYLOAD
    );
    expect(res).toEqual({ success: true });
    expect(fakeTx.applicationSection.upsert).toHaveBeenCalledTimes(1);
    // refreshFormStatus ran (terminal-safe) and wrote no status demotion.
    expect(fakeTx.application.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(fakeTx.application.update).not.toHaveBeenCalled();
  });

  it("merges provenance — untouched stamps survive, changed paths get the new editor", async () => {
    const oldStamp = {
      editedBy: "old-assessor",
      editedByName: "Old Assessor",
      editedAt: "2026-01-01T00:00:00.000Z",
    };
    fakeTx.applicationSection.findUnique.mockResolvedValue({
      data: {
        additionalNarrative: "Context from a phone call with the applicant.",
        additionalDocumentIds: ["doc-1"],
      },
      assessorProvenance: { additionalNarrative: oldStamp },
    });

    const res = await saveSectionOnBehalf("app-1", "ADDITIONAL_INFO", {
      additionalNarrative: "Context from a phone call with the applicant.",
      additionalDocumentIds: ["doc-1", "doc-2"], // only path Y changes
    });
    expect(res).toEqual({ success: true });

    const upsertArg = fakeTx.applicationSection.upsert.mock
      .calls[0]![0] as unknown as {
      update: { assessorProvenance: Record<string, unknown> };
    };
    const provenance = upsertArg.update.assessorProvenance;
    // Path X (narrative) keeps its ORIGINAL stamp — not re-attributed.
    expect(provenance.additionalNarrative).toEqual(oldStamp);
    // Path Y (the new doc id leaf) is stamped with the current editor.
    expect(provenance["additionalDocumentIds.1"]).toEqual({
      editedBy: "admin-1",
      editedByName: "Al Admin",
      editedAt: expect.any(String),
    });
  });

  it("audits SECTION_SAVED_BY_ASSESSOR with changedFields, section and reference", async () => {
    await saveSectionOnBehalf("app-1", "ADDITIONAL_INFO", VALID_PAYLOAD);
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AUDIT_ACTIONS.SECTION_SAVED_BY_ASSESSOR,
        entityType: AUDIT_ENTITY_TYPES.ApplicationSection,
        entityId: "sec-row-1",
        metadata: expect.objectContaining({
          applicationId: "app-1",
          reference: "APP-1",
          section: "ADDITIONAL_INFO",
          // No stored row → every supplied leaf reads as changed.
          changedFields: ["additionalNarrative"],
          formStatus: "SUBMITTED",
          reviewPhase: "SUBMITTED",
        }),
      })
    );
  });
});

// ─── finishEditingOnBehalf ────────────────────────────────────────────────────

// A well-formed stored stamp; hasProvenanceEntries only checks for a non-empty
// plain object, but the fixtures stay realistic.
const STAMP = {
  editedBy: "assessor-9",
  editedByName: "Ada Assessor",
  editedAt: "2026-06-01T00:00:00.000Z",
};

describe("finishEditingOnBehalf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(async () => ADMIN_USER);
    requireAccessMock.mockImplementation(async () => undefined);
    fakeTx = makeFakeTx();
  });

  it("emails exactly the provenance-carrying sections, in workbook order", async () => {
    // Rows deliberately OUT of workbook order, with one empty-{} and one null
    // provenance row — only the two stamped sections may appear, CHILD_DETAILS
    // first (SECTION_ORDER), regardless of the findMany return order.
    fakeTx.applicationSection.findMany.mockResolvedValue([
      {
        section: "PARENTS_INCOME",
        assessorProvenance: { "employed.0.netSalary": STAMP },
      },
      { section: "ADDITIONAL_INFO", assessorProvenance: {} },
      { section: "DECLARATION", assessorProvenance: null },
      { section: "CHILD_DETAILS", assessorProvenance: { fullName: STAMP } },
    ]);

    const res = await finishEditingOnBehalf("app-1");
    expect(res).toEqual({ success: true });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      "lead@example.test",
      "APPLICATION_EDITED_ON_BEHALF",
      expect.objectContaining({
        applicant_name: "Lia Lead",
        child_name: "Charlie Example",
        reference: "APP-1",
        edited_sections: "• Details of Child\n• Parents' Income",
      })
    );

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AUDIT_ACTIONS.EDIT_ON_BEHALF_FINISHED,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: "app-1",
        metadata: expect.objectContaining({
          reference: "APP-1",
          sections: ["Details of Child", "Parents' Income"],
          emailSent: true,
          emailSkipped: false,
          emailMessageId: "msg-1",
        }),
      })
    );
  });

  it("records a disabled template as not-notified (emailSkipped)", async () => {
    fakeTx.applicationSection.findMany.mockResolvedValue([
      { section: "CHILD_DETAILS", assessorProvenance: { fullName: STAMP } },
    ]);
    sendEmailMock.mockResolvedValueOnce({ success: true, skipped: true });

    const res = await finishEditingOnBehalf("app-1");
    expect(res).toEqual({ success: true });

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emailSent: false,
          emailSkipped: true,
          emailMessageId: null,
        }),
      })
    );
  });

  it("is a silent no-op when no section carries provenance", async () => {
    fakeTx.applicationSection.findMany.mockResolvedValue([
      { section: "CHILD_DETAILS", assessorProvenance: {} },
      { section: "PARENTS_INCOME", assessorProvenance: null },
    ]);

    const res = await finishEditingOnBehalf("app-1");
    expect(res).toEqual({ success: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("still succeeds when the email fails — audited as not sent", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeTx.applicationSection.findMany.mockResolvedValue([
      { section: "CHILD_DETAILS", assessorProvenance: { fullName: STAMP } },
    ]);
    sendEmailMock.mockResolvedValueOnce({ success: false, error: "Resend 500" });

    const res = await finishEditingOnBehalf("app-1");
    expect(res).toEqual({ success: true });

    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emailSent: false,
          emailSkipped: false,
          emailMessageId: null,
        }),
      })
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── submitApplicationOnBehalf ────────────────────────────────────────────────

// Preflight shape for a form that is ready to submit on behalf.
const FILLED_IN_APP = {
  leadApplicantId: "lead-1",
  reference: "APP-1",
  formStatus: "FILLED_IN",
  assessment: null,
  childName: "Charlie Example",
  leadApplicant: {
    email: "lead@example.test",
    firstName: "Lia",
    lastName: "Lead",
  },
};

describe("submitApplicationOnBehalf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(async () => ADMIN_USER);
    requireAccessMock.mockImplementation(async () => undefined);
    fakeTx = makeFakeTx();
  });

  it("propagates a requireApplicationAccess redirect — core never invoked", async () => {
    requireAccessMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(submitApplicationOnBehalf("app-1")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(submitCoreMock).not.toHaveBeenCalled();
  });

  it("refuses when the form is not FILLED_IN — core never invoked", async () => {
    fakeTx.application.findUnique.mockResolvedValue({
      ...FILLED_IN_APP,
      formStatus: "IN_PROGRESS",
    });

    const res = await submitApplicationOnBehalf("app-1");
    expect(res).toEqual({
      success: false,
      error:
        "The application must be fully filled in before it can be submitted on the applicant's behalf.",
    });
    expect(submitCoreMock).not.toHaveBeenCalled();
  });

  it("submits a FILLED_IN form through the shared core with the staff knobs", async () => {
    fakeTx.application.findUnique.mockResolvedValue(FILLED_IN_APP);

    const res = await submitApplicationOnBehalf("app-1");
    expect(res).toEqual({ success: true });

    expect(submitCoreMock).toHaveBeenCalledTimes(1);
    // Exact-match: no expectedLeadApplicantId (staff authorise via access
    // check, not ownership), deadline NOT enforced, staff audit action, and
    // the CONFIRMATION addressed to the LEAD APPLICANT.
    expect(submitCoreMock).toHaveBeenCalledWith({
      actor: { id: "admin-1", role: "ADMIN" },
      applicationId: "app-1",
      ownerContributorId: "contrib-1",
      enforceDeadline: false,
      auditAction: AUDIT_ACTIONS.APPLICATION_SUBMITTED_BY_ASSESSOR,
      auditMetadata: { onBehalf: true, submittedByRole: "ADMIN" },
      confirmation: { to: "lead@example.test", applicantName: "Lia Lead" },
    });
  });

  it("surfaces already-submitted from the core as a failure (idempotent)", async () => {
    fakeTx.application.findUnique.mockResolvedValue(FILLED_IN_APP);
    submitCoreMock.mockResolvedValueOnce({ alreadySubmitted: true });

    const res = await submitApplicationOnBehalf("app-1");
    expect(res).toEqual({
      success: false,
      error: "This application has already been submitted.",
    });
  });
});
