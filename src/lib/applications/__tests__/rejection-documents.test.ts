import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => undefined) }));

import { createAuditLog } from "@/lib/audit/log";
import { removeDocumentsWithRejection, withoutDocumentIds } from "../rejection-documents";
import type { Tx } from "@/lib/db/prisma";

function fakeTx(
  found: { id: string; slot: string; filename: string; storagePath: string }[],
  sectionRows: { id: string; data: unknown }[] = []
) {
  return {
    document: {
      findMany: vi.fn(async () => found),
      deleteMany: vi.fn(async () => ({ count: found.length })),
    },
    applicationSection: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => sectionRows),
      update: vi.fn(async () => ({})),
    },
  };
}

const base = { applicationId: "app-1", reference: "TS-TEST01", staffId: "staff-1", staffRole: "ADMIN", rejectionId: "rej-1" };

describe("removeDocumentsWithRejection (17 Oct 2026)", () => {
  beforeEach(() => vi.mocked(createAuditLog).mockClear());

  it("does nothing when no document is ticked", async () => {
    const tx = fakeTx([]);
    expect(await removeDocumentsWithRejection(tx as unknown as Tx, { ...base, documentIds: [] })).toEqual({ removed: 0, storagePaths: [] });
    expect(tx.document.findMany).not.toHaveBeenCalled();
  });

  it("only looks at this application's documents", async () => {
    const tx = fakeTx([]);
    await removeDocumentsWithRejection(tx as unknown as Tx, { ...base, documentIds: ["d-other"] });
    expect(tx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["d-other"] }, applicationId: "app-1" } })
    );
    expect(tx.document.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the rows, marks their sections incomplete, audits each, returns the files", async () => {
    const tx = fakeTx([
      { id: "d1", slot: "P60_PARENT_1", filename: "p60.pdf", storagePath: "a/p60.pdf" },
      { id: "d2", slot: "BANK_STATEMENT_CURRENT_PARENT_1", filename: "bank.pdf", storagePath: "a/bank.pdf" },
      { id: "d3", slot: "COUNCIL_TAX", filename: "ct.pdf", storagePath: "a/ct.pdf" },
    ]);
    const result = await removeDocumentsWithRejection(tx as unknown as Tx, { ...base, documentIds: ["d1", "d2", "d3"] });

    expect(result).toEqual({ removed: 3, storagePaths: ["a/p60.pdf", "a/bank.pdf", "a/ct.pdf"] });
    expect(tx.document.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["d1", "d2", "d3"] } } });
    expect(tx.applicationSection.updateMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", section: { in: ["PARENTS_INCOME", "ASSETS_LIABILITIES"] } },
      data: { isComplete: false },
    });
    expect(createAuditLog).toHaveBeenCalledTimes(3);
  });

  it("takes the removed ids out of the section blobs, so completion drops (21 Oct 2026)", async () => {
    const tx = fakeTx(
      [{ id: "d3", slot: "COUNCIL_TAX", filename: "ct.pdf", storagePath: "a/ct.pdf" }],
      [
        { id: "s-assets", data: { councilTaxDocumentId: "d3", propertyOwnership: "RENT" } },
        { id: "s-child", data: { firstName: "Testchild" } },
      ]
    );
    await removeDocumentsWithRejection(tx as unknown as Tx, { ...base, documentIds: ["d3"] });

    expect(tx.applicationSection.findMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1" },
      select: { id: true, data: true },
    });
    expect(tx.applicationSection.update).toHaveBeenCalledTimes(1);
    expect(tx.applicationSection.update).toHaveBeenCalledWith({
      where: { id: "s-assets" },
      data: { data: { propertyOwnership: "RENT" }, isComplete: false },
    });
  });
});

describe("withoutDocumentIds", () => {
  const ids = new Set(["d1", "d2"]);

  it("drops keys holding a removed id and filters arrays, at any depth", () => {
    const blob = {
      councilTaxDocumentId: "d1",
      parent1Income: { employed: { p60DocumentId: "d2", annualSalaryPaye: 30000 } },
      bankStatementDocumentIds: ["d1", "d9"],
      savings: [{ statementDocumentId: "d2", amount: 5 }],
    };
    expect(withoutDocumentIds(blob, ids)).toEqual({
      changed: true,
      value: {
        parent1Income: { employed: { annualSalaryPaye: 30000 } },
        bankStatementDocumentIds: ["d9"],
        savings: [{ amount: 5 }],
      },
    });
  });

  it("returns the same value, unchanged, when no removed id is referenced", () => {
    const blob = { councilTaxDocumentId: "d9", notes: "d1 is mentioned in text" };
    const result = withoutDocumentIds(blob, ids);
    expect(result.changed).toBe(false);
    expect(result.value).toBe(blob);
  });
});
