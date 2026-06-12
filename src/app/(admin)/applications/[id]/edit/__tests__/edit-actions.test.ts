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

import { saveSectionOnBehalf } from "../actions";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";

// Default scenario: SUBMITTED form, no assessment yet → review phase SUBMITTED,
// which IS editable on behalf. The same application object serves both the
// preflight read (leadApplicantId) and the write-tx read (reference/formStatus/
// assessment) — the action only picks the fields each select names.
function makeFakeTx(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        leadApplicantId: "lead-1",
        reference: "APP-1",
        formStatus: "SUBMITTED",
        assessment: null,
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
