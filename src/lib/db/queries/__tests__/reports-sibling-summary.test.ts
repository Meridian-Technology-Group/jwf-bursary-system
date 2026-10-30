import { describe, it, expect, vi } from "vitest";
import { getSiblingBursarySummary } from "../reports";
import type { Tx } from "@/lib/db/prisma";

/**
 * Sibling bursary summary — a family is the active accounts joined by a
 * sibling link OR a shared lead parent. Migrated Grant Tracker families have
 * no SiblingLink rows (S22), so the lead-parent join is what makes them show.
 */

interface FakeAccountInput {
  id: string;
  lead: string;
  links?: { familyGroupId: string; priorityOrder: number }[];
  dob?: string | null;
  entryYear?: number;
  award?: number | null;
  fees?: number | null;
}

function makeAccount(a: FakeAccountInput) {
  return {
    id: a.id,
    childName: `Child ${a.id}`,
    childDob: a.dob ? new Date(a.dob) : null,
    entryYear: a.entryYear ?? 2024,
    school: "TRINITY",
    leadApplicantId: a.lead,
    leadApplicant: { firstName: "Parent", lastName: a.lead },
    siblingLinks: a.links ?? [],
    recommendations:
      a.award === undefined && a.fees === undefined
        ? []
        : [
            {
              yearlyPayableFees: a.fees ?? null,
              bursaryAward: a.award ?? null,
              createdAt: new Date("2026-01-01"),
            },
          ],
  };
}

function makeFakeTx(accounts: ReturnType<typeof makeAccount>[]) {
  const findMany = vi.fn(async () => accounts);
  const tx = { bursaryAccount: { findMany } } as unknown as Tx;
  return { tx, findMany };
}

describe("getSiblingBursarySummary", () => {
  it("groups unlinked accounts that share a lead parent (migrated families)", async () => {
    const { tx } = makeFakeTx([
      makeAccount({ id: "a", lead: "p1", dob: "2012-05-01", award: 10000, fees: 2000 }),
      makeAccount({ id: "b", lead: "p1", dob: "2010-01-01", award: 5000, fees: 3000 }),
      makeAccount({ id: "c", lead: "p2", award: 9000 }),
    ]);

    const rows = await getSiblingBursarySummary(tx);

    expect(rows).toHaveLength(1);
    expect(rows[0].childrenCount).toBe(2);
    expect(rows[0].combinedBursaryAward).toBe(15000);
    expect(rows[0].combinedYearlyPayableFees).toBe(5000);
    expect(rows[0].leadParentName).toBe("Parent p1");
    // Oldest child first, numbered from 1.
    expect(rows[0].children.map((c) => [c.bursaryAccountId, c.priorityOrder])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("joins linked siblings with different lead parents, in link priority order", async () => {
    const { tx } = makeFakeTx([
      makeAccount({ id: "a", lead: "p1", dob: "2010-01-01", links: [{ familyGroupId: "g", priorityOrder: 2 }] }),
      makeAccount({ id: "b", lead: "p2", dob: "2012-01-01", links: [{ familyGroupId: "g", priorityOrder: 1 }] }),
    ]);

    const rows = await getSiblingBursarySummary(tx);

    expect(rows).toHaveLength(1);
    expect(rows[0].children.map((c) => c.bursaryAccountId)).toEqual(["b", "a"]);
  });

  it("merges a link group with a lead parent's other accounts into one family", async () => {
    const { tx } = makeFakeTx([
      makeAccount({ id: "a", lead: "p1", links: [{ familyGroupId: "g", priorityOrder: 1 }] }),
      makeAccount({ id: "b", lead: "p2", links: [{ familyGroupId: "g", priorityOrder: 2 }] }),
      makeAccount({ id: "c", lead: "p2" }),
    ]);

    const rows = await getSiblingBursarySummary(tx);

    expect(rows).toHaveLength(1);
    expect(rows[0].childrenCount).toBe(3);
  });

  it("leaves out single-child families and sorts by combined award", async () => {
    const { tx } = makeFakeTx([
      makeAccount({ id: "a", lead: "p1", award: 1000 }),
      makeAccount({ id: "b", lead: "p1", award: 1000 }),
      makeAccount({ id: "c", lead: "p2", award: 5000 }),
      makeAccount({ id: "d", lead: "p2", award: null }),
      makeAccount({ id: "e", lead: "p3", award: 99999 }),
    ]);

    const rows = await getSiblingBursarySummary(tx);

    expect(rows.map((r) => r.combinedBursaryAward)).toEqual([5000, 2000]);
  });

  it("reads active accounts only", async () => {
    const { tx, findMany } = makeFakeTx([]);

    await getSiblingBursarySummary(tx);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } })
    );
  });
});
