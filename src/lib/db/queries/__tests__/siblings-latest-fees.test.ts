import { describe, it, expect, vi } from "vitest";
import { getSiblingLinks } from "../siblings";
import type { Tx } from "@/lib/db/prisma";

/**
 * CALC-08 regression — sibling sequential income absorption must not drop a
 * v2-assessed sibling. The v2 pipeline leaves the legacy
 * `assessment.yearlyPayableFees` null and records the figure on the
 * Recommendation instead; `getSiblingLinks` must walk
 * recommendation.confirmedPayableFees → recommendation.recommendedPayableFees
 * → legacy assessment.yearlyPayableFees (mirroring `selectLastPayableFees`)
 * so the younger child's actual leg still absorbs the sibling's fees.
 */

interface FakeAssessment {
  yearlyPayableFees: number | null;
  recommendation: {
    confirmedPayableFees: number | null;
    recommendedPayableFees: number | null;
  } | null;
}

function makeLink(id: string, assessment: FakeAssessment | null) {
  return {
    id,
    familyGroupId: "family-1",
    bursaryAccountId: `account-${id}`,
    priorityOrder: 1,
    createdAt: new Date("2026-01-01"),
    bursaryAccount: {
      id: `account-${id}`,
      childName: `Child ${id}`,
      school: "TRINITY",
      reference: `BA-${id}`,
      applications: assessment === null ? [] : [{ assessment }],
    },
  };
}

function makeFakeTx(links: ReturnType<typeof makeLink>[]): Tx {
  return {
    siblingLink: {
      findFirst: vi.fn(async () => ({ familyGroupId: "family-1" })),
      findMany: vi.fn(async () => links),
    },
  } as unknown as Tx;
}

describe("getSiblingLinks — latestPayableFees fallback walk (CALC-08)", () => {
  it("uses the recommendation's confirmedPayableFees for a v2-assessed sibling (legacy column null)", async () => {
    const tx = makeFakeTx([
      makeLink("v2", {
        yearlyPayableFees: null,
        recommendation: {
          confirmedPayableFees: 15676,
          recommendedPayableFees: 12000,
        },
      }),
    ]);

    const rows = await getSiblingLinks(tx, "account-v2");
    expect(rows[0].bursaryAccount.latestPayableFees).toBe(15676);
  });

  it("falls back to the recommendation's recommendedPayableFees when no confirmed figure exists", async () => {
    const tx = makeFakeTx([
      makeLink("v2b", {
        yearlyPayableFees: null,
        recommendation: {
          confirmedPayableFees: null,
          recommendedPayableFees: 12000,
        },
      }),
    ]);

    const rows = await getSiblingLinks(tx, "account-v2b");
    expect(rows[0].bursaryAccount.latestPayableFees).toBe(12000);
  });

  it("falls back to the legacy assessment.yearlyPayableFees for v1 siblings", async () => {
    const tx = makeFakeTx([
      makeLink("v1", {
        yearlyPayableFees: 9000,
        recommendation: null,
      }),
    ]);

    const rows = await getSiblingLinks(tx, "account-v1");
    expect(rows[0].bursaryAccount.latestPayableFees).toBe(9000);
  });

  it("prefers the recommendation's confirmed figure over a stale legacy column", async () => {
    const tx = makeFakeTx([
      makeLink("both", {
        yearlyPayableFees: 9000,
        recommendation: {
          confirmedPayableFees: 15676,
          recommendedPayableFees: 12000,
        },
      }),
    ]);

    const rows = await getSiblingLinks(tx, "account-both");
    expect(rows[0].bursaryAccount.latestPayableFees).toBe(15676);
  });

  it("returns null when the sibling has no assessed application at all", async () => {
    const tx = makeFakeTx([makeLink("none", null)]);

    const rows = await getSiblingLinks(tx, "account-none");
    expect(rows[0].bursaryAccount.latestPayableFees).toBeNull();
  });
});
