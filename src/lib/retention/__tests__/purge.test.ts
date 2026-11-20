import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const secondaryMock = vi.fn();
const decisionMock = vi.fn();
vi.mock("@/lib/db/queries/secondary-gdpr", () => ({
  getSecondaryContributorForGdpr: () => secondaryMock(),
  decideSecondaryProfileErasure: () => decisionMock(),
}));

import {
  purgeApplication,
  buildPurgeAuditMetadata,
  type PurgeableApplication,
} from "../purge";

function makeTx() {
  const auditDelete = vi.fn();
  return {
    tx: {
      assessmentEarner: { deleteMany: vi.fn() },
      assessmentChecklist: { deleteMany: vi.fn() },
      assessmentProperty: { delete: vi.fn() },
      recommendationReasonCode: { deleteMany: vi.fn() },
      recommendation: { delete: vi.fn() },
      assessment: { delete: vi.fn() },
      applicationSection: { deleteMany: vi.fn() },
      document: { deleteMany: vi.fn() },
      application: { update: vi.fn() },
      contact: { updateMany: vi.fn() },
      applicationRejection: { updateMany: vi.fn(async () => ({ count: 0 })) },
      bursaryAccount: { updateMany: vi.fn() },
      accountSynopsisEntry: { deleteMany: vi.fn() },
      invitation: { deleteMany: vi.fn() },
      profile: {
        findUnique: vi.fn(async () => ({ email: "lead@x.test" })),
        update: vi.fn(),
      },
      auditLog: {
        updateMany: vi.fn(),
        delete: auditDelete,
        deleteMany: auditDelete,
      },
      applicationContributor: { deleteMany: vi.fn() },
    },
    auditDelete,
  };
}

function makeApp(): PurgeableApplication {
  return {
    id: "app-1",
    reference: "REF-1",
    leadApplicantId: "lead-1",
    documents: [{ id: "doc-1", storagePath: "documents/app-1/a.pdf" }],
    assessment: {
      id: "asmt-1",
      property: { id: "prop-1" },
      recommendation: { id: "rec-1" },
    },
  };
}

describe("purgeApplication — single parent", () => {
  it("runs storage, the anonymising tx and auth deletion; nulls (never deletes) audit", async () => {
    secondaryMock.mockResolvedValue(null);
    const { tx, auditDelete } = makeTx();
    const deleteDocuments = vi.fn(async (_paths: readonly string[]) => []);
    const deleteAuthUser = vi.fn(async () => ({ error: null }));

    const result = await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => fn(tx as never),
      deleteDocuments,
      deleteAuthUser,
    });

    // One batched call for every file (audit finding 15).
    expect(deleteDocuments).toHaveBeenCalledTimes(1);
    expect(deleteDocuments).toHaveBeenCalledWith(["documents/app-1/a.pdf"]);
    // Application is ANONYMISED, not deleted.
    expect(tx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { childName: "[Child Removed]", childDob: null },
    });
    // Audit rows are nulled, NEVER deleted.
    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: "lead-1" },
      data: { userId: null },
    });
    expect(auditDelete).not.toHaveBeenCalled();
    // Lead profile anonymised + role DELETED.
    expect(tx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: expect.objectContaining({ role: "DELETED" }),
      })
    );
    expect(deleteAuthUser).toHaveBeenCalledWith("lead-1");
    expect(result.secondary).toBeNull();
    expect(result.storageErrors).toEqual([]);
    // Item 10.5 residue-gap fixes: contact register + account child identity.
    expect(tx.contact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "lead-1" },
        data: expect.objectContaining({
          lastName: "[Removed]",
          childName: "[Child Removed]",
          postcode: null,
          notes: null,
        }),
      })
    );
    expect(tx.bursaryAccount.updateMany).toHaveBeenCalledWith({
      where: { leadApplicantId: "lead-1" },
      data: { childName: "[Child Removed]", childDob: null },
    });
    // Epic 21 #6 — the account's main synopsis goes with the person: every
    // entry on the lead's accounts, whatever its kind (MAIN, or a retired
    // YEAR/NOTE), so no kind filter.
    expect(tx.accountSynopsisEntry.deleteMany).toHaveBeenCalledWith({
      where: { bursaryAccount: { leadApplicantId: "lead-1" } },
    });
  });

  it("storage failures are non-fatal and recorded", async () => {
    secondaryMock.mockResolvedValue(null);
    const { tx } = makeTx();
    const result = await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => fn(tx as never),
      deleteDocuments: vi.fn(async () => {
        throw new Error("boom");
      }),
      deleteAuthUser: vi.fn(async () => ({ error: null })),
    });
    expect(result.storageErrors).toEqual(["doc-1: boom"]);
    // The tx still ran.
    expect(tx.application.update).toHaveBeenCalled();
  });

  it("a per-file failure from the batch is recorded against its document id", async () => {
    secondaryMock.mockResolvedValue(null);
    const { tx } = makeTx();
    const result = await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => fn(tx as never),
      deleteDocuments: vi.fn(async () => [
        { path: "documents/app-1/a.pdf", message: "object locked" },
      ]),
      deleteAuthUser: vi.fn(async () => ({ error: null })),
    });
    expect(result.storageErrors).toEqual(["doc-1: object locked"]);
  });

  it("audit finding 15: files are deleted only AFTER the DB transaction commits", async () => {
    secondaryMock.mockResolvedValue(null);
    const { tx } = makeTx();
    const order: string[] = [];
    const deleteDocuments = vi.fn(async () => {
      order.push("storage");
      return [];
    });
    await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => {
        const out = await fn(tx as never);
        order.push("tx");
        return out;
      },
      deleteDocuments,
      deleteAuthUser: vi.fn(async () => ({ error: null })),
    });
    // The secondary lookups are their own (read-only) transactions; storage
    // must follow the LAST one — the anonymising write.
    expect(order[order.length - 1]).toBe("storage");
  });

  it("audit finding 15: a rolled-back transaction deletes no files", async () => {
    secondaryMock.mockResolvedValue(null);
    const { tx } = makeTx();
    (tx.application.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rollback"));
    const deleteDocuments = vi.fn(async () => []);
    await expect(
      purgeApplication(makeApp(), {
        withAdminContext: async (fn) => fn(tx as never),
        deleteDocuments,
        deleteAuthUser: vi.fn(async () => ({ error: null })),
      })
    ).rejects.toThrow("rollback");
    expect(deleteDocuments).not.toHaveBeenCalled();
  });
});

describe("purgeApplication — dual parent", () => {
  it("erases the secondary when the shared-profile guard clears it", async () => {
    secondaryMock.mockResolvedValue({
      contributorId: "c2",
      profileId: "sec-1",
      email: "sec@x.test",
    });
    decisionMock.mockResolvedValue({
      canErase: true,
      otherContributorLinks: 0,
      leadApplicantApplications: 0,
      bursaryAccounts: 0,
    });
    const { tx } = makeTx();
    const deleteAuthUser = vi.fn(async () => ({ error: null }));

    const result = await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => fn(tx as never),
      deleteDocuments: vi.fn(async () => []),
      deleteAuthUser,
    });

    expect(deleteAuthUser).toHaveBeenCalledWith("sec-1");
    expect(result.secondary?.authDeleted).toBe(true);
    expect(result.secondary?.decision.canErase).toBe(true);
  });

  it("RETAINS the secondary when lawfully linked elsewhere", async () => {
    secondaryMock.mockResolvedValue({
      contributorId: "c2",
      profileId: "sec-1",
      email: "sec@x.test",
    });
    decisionMock.mockResolvedValue({
      canErase: false,
      otherContributorLinks: 1,
      leadApplicantApplications: 0,
      bursaryAccounts: 0,
    });
    const { tx } = makeTx();
    const deleteAuthUser = vi.fn(async () => ({ error: null }));

    const result = await purgeApplication(makeApp(), {
      withAdminContext: async (fn) => fn(tx as never),
      deleteDocuments: vi.fn(async () => []),
      deleteAuthUser,
    });

    // Only the lead's auth user is deleted, never the retained secondary.
    expect(deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(deleteAuthUser).toHaveBeenCalledWith("lead-1");
    expect(result.secondary?.authDeleted).toBe(false);
  });
});

describe("append-only audit invariant (static)", () => {
  it("the purge module never calls auditLog.delete*", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "purge.ts"), "utf8");
    expect(src).not.toMatch(/auditLog\.delete/);
  });
});

describe("buildPurgeAuditMetadata", () => {
  it("omits the secondary block for single-parent purges", () => {
    const meta = buildPurgeAuditMetadata({ reference: "REF-1" }, "lead-1", {
      storageErrors: [],
      authDeleteError: null,
      secondary: null,
    });
    expect(meta.reference).toBe("REF-1");
    expect(meta.secondary).toBeUndefined();
  });
});
