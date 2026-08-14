import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tx } from "@/lib/db/prisma";

/**
 * C4a / D13-1a Q5 — the reference a ROLLING_OVER application is created with.
 *
 * `resolveRolloverReference` is unit-tested as a pure function in
 * `src/lib/applications/__tests__/reference.test.ts`. This suite pins the
 * WIRING: that `createReassessmentApplicationFromInvitation` reads the prior
 * year's application through `getPreviousYearReferenceSource` and persists
 * whatever the rule returns — i.e. that a human-entered fees-system code
 * actually reaches the new row, and an untouched default actually gets a fresh
 * academic year.
 */

vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => undefined),
  ApplicationContributorRole: { PRIMARY: "PRIMARY" },
}));

import { createReassessmentApplicationFromInvitation } from "../reassessment";

const INVITATION = {
  authUserId: "user-1",
  bursaryAccountId: "account-1",
  roundId: "round-2028",
  school: "TRINITY" as const,
  childName: "Bob Smith",
};

/** The prior year's application as the reference-source query returns it. */
interface PriorRow {
  reference: string;
  childName: string;
  school: string;
  entryYearGroup: string | null;
  round: { academicYear: string };
}

function makeFakeTx(prior: PriorRow | null) {
  const created: Record<string, unknown>[] = [];

  // `application.findFirst` is used three times, in this order:
  //   1. idempotency check for an in-progress application in this round
  //   2. getPreviousYearReferenceSource  (the prior year's reference facts)
  //   3. getPreviousYearApplication      (section pre-population source)
  // Returning null for (3) short-circuits pre-population, which is not what
  // this suite is about.
  const findFirstResults: unknown[] = [null, prior, null];
  let findFirstCall = 0;

  const tx = {
    application: {
      findFirst: vi.fn(async () => findFirstResults[findFirstCall++] ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: "new-app-1", ...data };
      }),
    },
    bursaryAccount: {
      findUnique: vi.fn(async () => ({
        school: "TRINITY",
        childName: "Bob Smith",
        childDob: null,
        entryYear: 2027,
      })),
    },
    round: {
      findUnique: vi.fn(async () => ({ academicYear: "2028/29" })),
    },
  };

  return { tx: tx as unknown as Tx, created };
}

const UNTOUCHED_PRIOR: PriorRow = {
  // Exactly what the generator produces for the prior year's own facts.
  reference: "Bob Smith – Trinity School – Year 6 – 2027-28",
  childName: "Bob Smith",
  school: "TRINITY",
  entryYearGroup: "Y6",
  round: { academicYear: "2027/28" },
};

describe("createReassessmentApplicationFromInvitation — rollover reference (D13-1a Q5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inherits a reference that was edited to the external fees-system code", async () => {
    const { tx, created } = makeFakeTx({
      ...UNTOUCHED_PRIOR,
      reference: "TS-SMITH05-Smith, Bob",
    });

    const result = await createReassessmentApplicationFromInvitation(
      tx,
      INVITATION
    );

    expect(result).toEqual({ id: "new-app-1", created: true });
    expect(created[0].reference).toBe("TS-SMITH05-Smith, Bob");
  });

  it("regenerates for the new year when the prior reference is the untouched default", async () => {
    const { tx, created } = makeFakeTx(UNTOUCHED_PRIOR);

    await createReassessmentApplicationFromInvitation(tx, INVITATION);

    // New academic year, and no year-group segment: this create path persists
    // `entryYear` but not `entryYearGroup`, and the label is built from exactly
    // the fields the row will hold.
    expect(created[0].reference).toBe("Bob Smith – Trinity School – 2028-29");
  });

  it("generates a fresh default when the account has no prior-year application", async () => {
    const { tx, created } = makeFakeTx(null);

    await createReassessmentApplicationFromInvitation(tx, INVITATION);

    expect(created[0].reference).toBe("Bob Smith – Trinity School – 2028-29");
  });

  it("regenerates a pre-Epic-13 sequence reference rather than carrying it forward forever", async () => {
    const { tx, created } = makeFakeTx({
      ...UNTOUCHED_PRIOR,
      reference: "TS-20272028-0001",
    });

    await createReassessmentApplicationFromInvitation(tx, INVITATION);

    expect(created[0].reference).toBe("Bob Smith – Trinity School – 2028-29");
  });

  it("is idempotent: an existing in-progress application short-circuits before any reference work", async () => {
    const { tx, created } = makeFakeTx(UNTOUCHED_PRIOR);
    (tx.application.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      { id: "existing-app" }
    );

    const result = await createReassessmentApplicationFromInvitation(
      tx,
      INVITATION
    );

    expect(result).toEqual({ id: "existing-app", created: false });
    expect(created).toHaveLength(0);
  });
});
