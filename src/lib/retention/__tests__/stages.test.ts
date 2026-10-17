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

function fakeTx(r: Record<string, unknown> | null, opts: { otherApps?: number; otherAccounts?: number } = {}) {
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
    contact: { updateMany: fn("contact.updateMany") },
    invitation: { deleteMany: fn("invitation.deleteMany") },
    auditLog: { updateMany: fn("auditLog.updateMany") },
    profile: { update: fn("profile.update", {}) },
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
