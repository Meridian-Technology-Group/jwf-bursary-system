/**
 * Epic 23 T10 — per-application retention primitives: each re-checks its plan
 * inside the transaction, is idempotent, never touches another child's data,
 * and keeps the parent's profile while a sibling is live.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/queries/secondary-gdpr", () => ({
  getSecondaryContributorForGdpr: vi.fn(async () => null),
  decideSecondaryProfileErasure: vi.fn(),
}));

import { anonymiseForErasure, ANONYMISED, purgeAssessment, purgeFormAndDocuments } from "../stages";
import { countByAction, dueCandidatesWhere, sortSchedule } from "../schedule";

const NOW = new Date("2030-06-01T12:00:00Z");

function row(over: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    reference: "TS-TEST01",
    childName: "Pupil Surname",
    leadApplicantId: "lead-1",
    bursaryAccountId: null,
    closedAt: new Date("2030-05-01T00:00:00Z"),
    retentionStage: null,
    retentionStageAt: null,
    bursaryAccount: null,
    assessment: { id: "as-1", status: "COMPLETED", archivedAt: null },
    ...over,
  };
}

interface FakeAuditRow {
  id: string;
  context: string | null;
  metadata: unknown;
}

function fakeTx(
  r: Record<string, unknown> | null,
  opts: { otherApps?: number; otherAccounts?: number; auditRows?: FakeAuditRow[] } = {},
) {
  const calls: { op: string; args: unknown }[] = [];
  const fn = (op: string, ret: unknown = { count: 1 }) =>
    vi.fn(async (args: unknown) => {
      calls.push({ op, args });
      return ret;
    });
  const tx = {
    application: {
      findUnique: fn("application.findUnique", r),
      update: fn("application.update", {}),
      count: fn("application.count", opts.otherApps ?? 0),
    },
    bursaryAccount: { update: fn("bursaryAccount.update", {}), count: fn("bursaryAccount.count", opts.otherAccounts ?? 0) },
    document: { findMany: fn("document.findMany", [{ storagePath: "a/p60.pdf" }]), deleteMany: fn("document.deleteMany") },
    applicationSection: { deleteMany: fn("applicationSection.deleteMany") },
    applicationRejection: { updateMany: fn("applicationRejection.updateMany") },
    assessment: { deleteMany: fn("assessment.deleteMany"), update: fn("assessment.update", {}) },
    assessmentChecklist: { deleteMany: fn("assessmentChecklist.deleteMany") },
    recommendation: { updateMany: fn("recommendation.updateMany") },
    accountSynopsisEntry: { deleteMany: fn("accountSynopsisEntry.deleteMany") },
    contact: { findMany: fn("contact.findMany", [{ id: "contact-1" }]), updateMany: fn("contact.updateMany") },
    invitation: { findMany: fn("invitation.findMany", [{ id: "inv-1" }]), deleteMany: fn("invitation.deleteMany") },
    auditLog: {
      updateMany: fn("auditLog.updateMany"),
      findMany: fn("auditLog.findMany", opts.auditRows ?? []),
      update: fn("auditLog.update", {}),
    },
    profile: {
      update: fn("profile.update", {}),
      findUnique: fn("profile.findUnique", { email: "pat.parent@example.test", firstName: "Pat", lastName: "Parent" }),
    },
  };
  return { tx, calls, ops: () => calls.map((c) => c.op) };
}

describe("purgeFormAndDocuments", () => {
  it("rule 2 at the close: documents, sections and rejection notes go; the assessment and identity stay", async () => {
    const { tx, calls, ops } = fakeTx(row());
    const r = await purgeFormAndDocuments(tx as never, "app-1", NOW);
    expect(r.applied).toBe(true);
    expect(r.storagePaths).toEqual(["a/p60.pdf"]);
    expect(ops()).toEqual(
      expect.arrayContaining(["document.deleteMany", "applicationSection.deleteMany", "applicationRejection.updateMany", "application.update"]),
    );
    expect(ops()).not.toContain("assessment.deleteMany");
    expect(ops()).not.toContain("profile.update");
    const stage = calls.find((c) => c.op === "application.update")!.args as { data: Record<string, unknown> };
    expect(stage.data).toEqual({ retentionStage: "FORM_DOCS_PURGED", retentionStageAt: NOW });
  });

  it("re-checks inside the transaction: an account reopened meanwhile is skipped", async () => {
    const { tx, ops } = fakeTx(row({ bursaryAccountId: "acc", bursaryAccount: { closedAt: null } }));
    const r = await purgeFormAndDocuments(tx as never, "app-1", NOW);
    expect(r).toMatchObject({ applied: false });
    expect(ops()).toEqual(["application.findUnique"]);
  });

  it("is idempotent: a stage already reached is skipped", async () => {
    const { tx, ops } = fakeTx(row({ retentionStage: "FORM_DOCS_PURGED" }));
    expect((await purgeFormAndDocuments(tx as never, "app-1", NOW)).applied).toBe(false);
    expect(ops()).toEqual(["application.findUnique"]);
  });

  it("an account closed under a year ago is not due yet", async () => {
    const { tx } = fakeTx(row({ bursaryAccountId: "acc", bursaryAccount: { closedAt: new Date("2030-01-01T00:00:00Z") } }));
    const r = await purgeFormAndDocuments(tx as never, "app-1", NOW);
    expect(r.applied).toBe(false);
    expect(r.skipped).toMatch(/not due until 2031-01-01/);
  });
});

describe("purgeAssessment", () => {
  const due = () =>
    row({
      bursaryAccountId: "acc-1",
      bursaryAccount: { closedAt: new Date("2024-01-01T00:00:00Z") },
      retentionStage: "FORM_DOCS_PURGED",
    });

  it("rule 1 at +6y: assessment, synopsis and identity go; the parent is erased when nothing else is live", async () => {
    const { tx, calls, ops } = fakeTx(due());
    const r = await purgeAssessment(tx as never, "app-1", NOW);
    expect(r.applied).toBe(true);
    expect(r.authUsersToDelete).toEqual(["lead-1"]);
    expect(ops()).toEqual(expect.arrayContaining(["assessment.deleteMany", "accountSynopsisEntry.deleteMany", "profile.update"]));
    const identity = calls.find(
      (c) => c.op === "application.update" && (c.args as { data: { childName?: string } }).data.childName,
    )!.args as { data: Record<string, unknown> };
    expect(identity.data).toMatchObject({ childName: ANONYMISED, reference: ANONYMISED, childDob: null });
  });

  it("keeps the parent's profile while a sibling is still live", async () => {
    const { tx, ops } = fakeTx(due(), { otherApps: 1 });
    const r = await purgeAssessment(tx as never, "app-1", NOW);
    expect(r.applied).toBe(true);
    expect(r.authUsersToDelete).toEqual([]);
    expect(ops()).not.toContain("profile.update");
  });

  it("not before the 6 years", async () => {
    const { tx } = fakeTx(row({ retentionStage: "FORM_DOCS_PURGED", closedAt: new Date("2026-01-01T00:00:00Z") }));
    expect((await purgeAssessment(tx as never, "app-1", NOW)).applied).toBe(false);
  });
});

describe("anonymiseForErasure (rule 3)", () => {
  it("the form goes, the identity becomes XXXX, the assessment stays (prose scrubbed)", async () => {
    const { tx, ops, calls } = fakeTx(row({ closedAt: null }));
    const r = await anonymiseForErasure(tx as never, "app-1", NOW, "admin-1");
    expect(r.applied).toBe(true);
    expect(ops()).not.toContain("assessment.deleteMany");
    expect(ops()).toEqual(expect.arrayContaining(["document.deleteMany", "assessment.update", "contact.updateMany"]));
    const stage = calls.filter((c) => c.op === "application.update").map((c) => (c.args as { data: Record<string, unknown> }).data);
    expect(stage).toContainEqual({ retentionStage: "ANONYMISED", retentionStageAt: NOW });
  });
  it("the contact-linked invitation goes too (an accepted one has no applicationId)", async () => {
    const { tx, calls } = fakeTx(row({ closedAt: null }));
    await anonymiseForErasure(tx as never, "app-1", NOW, "admin-1");
    const found = calls.find((c) => c.op === "invitation.findMany")!.args as { where: unknown };
    expect(JSON.stringify(found.where)).toContain('"contactId":{"in":["contact-1"]}');
    const deleted = calls.find((c) => c.op === "invitation.deleteMany")!.args as { where: unknown };
    expect(deleted.where).toEqual({ id: { in: ["inv-1"] } });
  });

  // Charlotte, 22 Oct 2026: "if I am nosey and keep going down the history
  // trail, I can find the original name of the file still".
  it("blanks the child's reference and name, and the erased parent's email, in the family's history", async () => {
    const auditRows = [
      {
        id: "a1",
        context: "Reference: TS-TEST01",
        metadata: { reference: "TS-TEST01", submittedAt: "2030-01-01" },
      },
      {
        id: "a2",
        context: "Invited pat.parent@example.test from contact (Pupil Surname)",
        metadata: { email: "pat.parent@example.test", contactId: "contact-1" },
      },
      { id: "a3", context: "Assessor began review", metadata: { toStatus: "NOT_STARTED" } },
    ];
    const { tx, calls } = fakeTx(row({ closedAt: null }), { auditRows });
    await anonymiseForErasure(tx as never, "app-1", NOW, "admin-1");
    const updates = calls.filter((c) => c.op === "auditLog.update").map((c) => c.args as { where: { id: string }; data: Record<string, unknown> });
    expect(updates.map((u) => u.where.id)).toEqual(["a1", "a2"]); // a3 names nobody
    expect(updates[0].data).toEqual({ context: "Reference: XXXX", metadata: { reference: "XXXX", submittedAt: "2030-01-01" } });
    expect(updates[1].data).toEqual({
      context: "Invited XXXX from contact (XXXX)",
      metadata: { email: "XXXX", contactId: "contact-1" },
    });
    // the scope is this family's rows only
    const where = JSON.stringify((calls.find((c) => c.op === "auditLog.findMany")!.args as { where: unknown }).where);
    expect(where).toContain('"entityId":{"in":["app-1","as-1","contact-1","inv-1"]}');
    expect(where).toContain('"userId":"lead-1"');
  });

  it("keeps the parent's email in the history while a sibling is live", async () => {
    const auditRows = [{ id: "a2", context: "Invited pat.parent@example.test from contact (Pupil Surname)", metadata: {} }];
    const { tx, calls } = fakeTx(row({ closedAt: null }), { auditRows, otherApps: 1 });
    await anonymiseForErasure(tx as never, "app-1", NOW, "admin-1");
    const update = calls.find((c) => c.op === "auditLog.update")!.args as { data: { context: string } };
    expect(update.data.context).toBe("Invited pat.parent@example.test from contact (XXXX)");
  });

  it("refused once the child has a bursary account", async () => {
    const { tx } = fakeTx(row({ bursaryAccountId: "acc", bursaryAccount: { closedAt: null } }));
    expect((await anonymiseForErasure(tx as never, "app-1", NOW, "admin-1")).applied).toBe(false);
  });
});

describe("cron candidate selection", () => {
  it("selects by due date in SQL, never by submittedAt, and skips finished rows", () => {
    const w = dueCandidatesWhere(NOW);
    const json = JSON.stringify(w);
    expect(json).not.toContain("submittedAt");
    expect(json).toContain('"retentionStage":{"not":"ASSESSMENT_PURGED"}');
    expect(json).toContain(new Date("2029-06-01T12:00:00.000Z").toISOString()); // account closed ≥ 1 year ago
    expect(json).toContain(new Date("2024-06-01T12:00:00.000Z").toISOString()); // erasure ≥ 6 years ago
  });
  it("schedule sorts soonest first; summary counts per stage", () => {
    const plan = (iso: string, action: "purge-form-docs" | "purge-assessment") => ({
      action,
      dueAt: new Date(iso),
      due: false,
      rule: "unsuccessful" as const,
      anchor: null,
      reason: "",
    });
    const items = sortSchedule([
      { applicationId: "b", reference: "B", plan: plan("2031-01-01", "purge-assessment") },
      { applicationId: "a", reference: "A", plan: plan("2030-07-01", "purge-form-docs") },
    ]);
    expect(items.map((i) => i.reference)).toEqual(["A", "B"]);
    expect(countByAction(items.map((i) => i.plan))).toEqual({ "purge-form-docs": 1, "purge-assessment": 1 });
  });
});
