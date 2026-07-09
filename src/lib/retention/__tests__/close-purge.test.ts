import { describe, it, expect, vi, beforeEach } from "vitest";
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
  purgeClosedApplication,
  deleteAuthUsersPostCommit,
  buildClosePurgeAuditMetadata,
  isApplicationPurged,
  type ClosePurgeableApplication,
} from "../close-purge";
import {
  REDACTED_CHILD_NAME,
  CLOSE_PURGE_SUMMARY,
} from "../scrub-map";

function makeTx({
  otherApplications = 0,
  otherAccounts = 0,
}: { otherApplications?: number; otherAccounts?: number } = {}) {
  const auditDelete = vi.fn();
  return {
    tx: {
      document: { deleteMany: vi.fn(async () => ({ count: 2 })) },
      applicationSection: { deleteMany: vi.fn(async () => ({ count: 5 })) },
      application: {
        update: vi.fn(),
        count: vi.fn(async () => otherApplications),
      },
      assessment: { update: vi.fn() },
      assessmentChecklist: { deleteMany: vi.fn(async () => ({ count: 3 })) },
      recommendation: { update: vi.fn() },
      contact: { updateMany: vi.fn(async () => ({ count: 1 })) },
      bursaryAccount: {
        update: vi.fn(),
        count: vi.fn(async () => otherAccounts),
      },
      invitation: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      applicationContributor: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      profile: {
        findUnique: vi.fn(async () => ({ email: "lead@x.test" })),
        update: vi.fn(),
      },
      auditLog: {
        updateMany: vi.fn(),
        delete: auditDelete,
        deleteMany: auditDelete,
      },
    },
    auditDelete,
  };
}

function makeApp(
  overrides: Partial<ClosePurgeableApplication> = {}
): ClosePurgeableApplication {
  return {
    id: "app-1",
    reference: "WS-202627-0001",
    childName: "Jane Doe",
    leadApplicantId: "lead-1",
    bursaryAccountId: "acct-1",
    documents: [{ id: "doc-1", storagePath: "documents/app-1/a.pdf" }],
    assessment: { id: "asmt-1", recommendation: { id: "rec-1" } },
    ...overrides,
  };
}

const noStorageFailure = { deleteDocument: vi.fn(async () => {}) };

beforeEach(() => {
  secondaryMock.mockReset().mockResolvedValue(null);
  decisionMock.mockReset();
});

describe("purgeClosedApplication — retention split", () => {
  it("deletes documents/sections, scrubs identities, RETAINS assessment + recommendation rows", async () => {
    const { tx, auditDelete } = makeTx();

    const result = await purgeClosedApplication(tx as never, makeApp(), {
      deleteDocument: vi.fn(async () => {}),
    });

    // Deleted: files, form sections, legacy checklist notes, invitations.
    expect(tx.document.deleteMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1" },
    });
    expect(tx.applicationSection.deleteMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1" },
    });
    expect(tx.assessmentChecklist.deleteMany).toHaveBeenCalledWith({
      where: { assessmentId: "asmt-1" },
    });

    // Scrubbed-not-deleted: application child identity.
    expect(tx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { childName: REDACTED_CHILD_NAME, childDob: null },
    });

    // RETAINED: the assessment row is UPDATED (prose only), never deleted —
    // there is no tx.assessment.delete in this routine at all.
    expect(tx.assessment.update).toHaveBeenCalledWith({
      where: { id: "asmt-1" },
      data: {
        manualAdjustmentReason: null,
        secondaryParentOverrideReason: null,
      },
    });
    expect(
      (tx.assessment as Record<string, unknown>).delete
    ).toBeUndefined();

    // RETAINED: recommendation row updated (prose only) — awards untouched.
    expect(tx.recommendation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { familySynopsis: null, summary: null },
    });
    const recUpdateData = (tx.recommendation.update as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(recUpdateData).not.toHaveProperty("bursaryAward");
    expect(recUpdateData).not.toHaveProperty("scholarshipAward");

    // The assessment update must NOT touch the synopsis (D-2) or financials.
    const asmtUpdateData = (tx.assessment.update as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(asmtUpdateData).not.toHaveProperty("synopsis");
    expect(asmtUpdateData).not.toHaveProperty("bursaryAward");
    expect(asmtUpdateData).not.toHaveProperty("totalHouseholdNetIncome");

    // Contact register scoped to THIS child (pre-scrub name) or the account.
    expect(tx.contact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { profileId: "lead-1", childName: "Jane Doe" },
            { bursaryAccountId: "acct-1" },
          ],
        },
      })
    );

    // Bursary account child identity scrubbed.
    expect(tx.bursaryAccount.update).toHaveBeenCalledWith({
      where: { id: "acct-1" },
      data: { childName: REDACTED_CHILD_NAME, childDob: null },
    });

    // Audit rows never deleted.
    expect(auditDelete).not.toHaveBeenCalled();

    expect(result.counts.documentsDeleted).toBe(2);
    expect(result.counts.sectionsDeleted).toBe(5);
    expect(result.counts.contactsScrubbed).toBe(1);
  });

  it("handles an application with no assessment and no account", async () => {
    const { tx } = makeTx();
    const result = await purgeClosedApplication(
      tx as never,
      makeApp({ assessment: null, bursaryAccountId: null }),
      noStorageFailure
    );
    expect(tx.assessment.update).not.toHaveBeenCalled();
    expect(tx.recommendation.update).not.toHaveBeenCalled();
    expect(tx.bursaryAccount.update).not.toHaveBeenCalled();
    // Contact where-clause omits the account branch entirely.
    expect(tx.contact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ profileId: "lead-1", childName: "Jane Doe" }] },
      })
    );
    expect(result.leadProfile).toBe("erased");
  });

  it("storage failures are non-fatal, recorded, and surfaced in audit metadata", async () => {
    const { tx } = makeTx();
    const result = await purgeClosedApplication(tx as never, makeApp(), {
      deleteDocument: vi.fn(async () => {
        throw new Error("object locked");
      }),
    });
    expect(result.storageErrors).toHaveLength(1);
    expect(result.storageErrors[0]).toContain("doc-1");

    const meta = buildClosePurgeAuditMetadata(makeApp(), result);
    expect(meta.storageErrors).toEqual(result.storageErrors);
    // Metadata carries counts and references, never personal values.
    expect(JSON.stringify(meta)).not.toContain("Jane Doe");
  });
});

describe("purgeClosedApplication — lead-profile guard", () => {
  it("erases the lead profile when this is their last live record", async () => {
    const { tx } = makeTx({ otherApplications: 0, otherAccounts: 0 });
    const result = await purgeClosedApplication(
      tx as never,
      makeApp(),
      noStorageFailure
    );
    expect(result.leadProfile).toBe("erased");
    expect(tx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: expect.objectContaining({ role: "DELETED" }),
      })
    );
    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: "lead-1" },
      data: { userId: null },
    });
    expect(result.authUsersToDelete).toContain("lead-1");
  });

  it("retains the lead profile when they have other live applications", async () => {
    const { tx } = makeTx({ otherApplications: 2 });
    const result = await purgeClosedApplication(
      tx as never,
      makeApp(),
      noStorageFailure
    );
    expect(result.leadProfile).toBe("retained");
    expect(result.leadProfileRetainedBecause).toContain("2 other live");
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(tx.auditLog.updateMany).not.toHaveBeenCalled();
    expect(result.authUsersToDelete).toHaveLength(0);
  });

  it("retains the lead profile when they hold another bursary account", async () => {
    const { tx } = makeTx({ otherAccounts: 1 });
    const result = await purgeClosedApplication(
      tx as never,
      makeApp(),
      noStorageFailure
    );
    expect(result.leadProfile).toBe("retained");
    expect(result.leadProfileRetainedBecause).toContain("bursary account");
  });
});

describe("purgeClosedApplication — secondary contributor", () => {
  it("erases an unshared secondary profile and queues its auth deletion", async () => {
    secondaryMock.mockResolvedValue({
      contributorId: "contrib-2",
      profileId: "second-1",
      email: "second@x.test",
    });
    decisionMock.mockResolvedValue({
      canErase: true,
      otherContributorLinks: 0,
      leadApplicantApplications: 0,
      bursaryAccounts: 0,
    });
    const { tx } = makeTx();
    const result = await purgeClosedApplication(
      tx as never,
      makeApp(),
      noStorageFailure
    );
    expect(result.secondaryProfile).toBe("erased");
    expect(tx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "second-1" } })
    );
    expect(result.authUsersToDelete).toEqual(
      expect.arrayContaining(["lead-1", "second-1"])
    );
  });

  it("retains a shared secondary profile", async () => {
    secondaryMock.mockResolvedValue({
      contributorId: "contrib-2",
      profileId: "second-1",
      email: "second@x.test",
    });
    decisionMock.mockResolvedValue({
      canErase: false,
      otherContributorLinks: 1,
      leadApplicantApplications: 0,
      bursaryAccounts: 0,
    });
    const { tx } = makeTx();
    const result = await purgeClosedApplication(
      tx as never,
      makeApp(),
      noStorageFailure
    );
    expect(result.secondaryProfile).toBe("retained");
    expect(result.authUsersToDelete).not.toContain("second-1");
  });
});

describe("deleteAuthUsersPostCommit", () => {
  it("continues past failures and aggregates error messages", async () => {
    const deleteAuthUser = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "gone already" } })
      .mockResolvedValueOnce({ error: null });
    const errors = await deleteAuthUsersPostCommit(["u1", "u2"], {
      deleteAuthUser,
    });
    expect(deleteAuthUser).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("u1");
  });
});

describe("idempotency + helpers", () => {
  it("isApplicationPurged detects the redaction token", () => {
    expect(isApplicationPurged({ childName: REDACTED_CHILD_NAME })).toBe(true);
    expect(isApplicationPurged({ childName: "Jane Doe" })).toBe(false);
  });

  it("a second run over already-scrubbed data is a no-op by construction", async () => {
    // Simulate the post-purge state: no documents, redacted child name.
    const { tx } = makeTx();
    (tx.document.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });
    (
      tx.applicationSection.deleteMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 0 });
    (tx.contact.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });
    const rerun = await purgeClosedApplication(
      tx as never,
      makeApp({ childName: REDACTED_CHILD_NAME, documents: [] }),
      noStorageFailure
    );
    expect(rerun.counts.documentsDeleted).toBe(0);
    expect(rerun.counts.sectionsDeleted).toBe(0);
    // Re-scrubbing scrubbed fields is harmless; no throw, no storage calls.
    expect(rerun.storageErrors).toEqual([]);
  });
});

describe("append-only audit + scrub-map invariants (source-level)", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "close-purge.ts"),
    "utf8"
  );

  it("never deletes audit rows", () => {
    expect(src).not.toMatch(/auditLog\s*\.\s*delete/);
  });

  it("never deletes the assessment, recommendation or application rows", () => {
    expect(src).not.toMatch(/assessment\s*\.\s*delete\b/);
    expect(src).not.toMatch(/recommendation\s*\.\s*delete\b/);
    expect(src).not.toMatch(/application\s*\.\s*delete\b/);
  });

  it("draws every scrub payload from the shared scrub map", () => {
    for (const token of [
      "APPLICATION_CHILD_SCRUB",
      "ASSESSMENT_FREETEXT_SCRUB",
      "RECOMMENDATION_FREETEXT_SCRUB",
      "CONTACT_SCRUB",
      "BURSARY_ACCOUNT_CHILD_SCRUB",
      "profileScrubData",
    ]) {
      expect(src).toContain(token);
    }
  });

  it("the human-readable summary names the D-2 synopsis caveat", () => {
    expect(CLOSE_PURGE_SUMMARY.retained.join(" ")).toContain("synopsis");
    expect(CLOSE_PURGE_SUMMARY.retained.join(" ")).toContain("D-2");
  });
});
