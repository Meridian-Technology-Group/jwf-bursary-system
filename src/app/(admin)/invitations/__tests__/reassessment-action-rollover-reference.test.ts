import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C4b / D13-1a Q5 — the reference `createReassessmentApplicationAction` creates
 * a ROLLING_OVER application with.
 *
 * This is a SECOND, independent rollover-creation path. C4a wired the rule into
 * `createReassessmentApplicationFromInvitation` (the applicant-side register /
 * "Begin re-assessment" entry points) and covered it in
 * `src/lib/db/queries/__tests__/reassessment-rollover-reference.test.ts`; this
 * one is the ADMIN-triggered action. Nothing pinned it, which is how it kept
 * building `REA-{account.reference}-{roundId}` off a column C4b drops — so the
 * gap is closed here.
 *
 * `resolveRolloverReference` is unit-tested as a pure function in
 * `src/lib/applications/__tests__/reference.test.ts`. This suite pins only the
 * WIRING: that the action reads the prior year through
 * `getPreviousYearReferenceSource` and persists whatever the shared rule
 * returns.
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER" },
}));

// Module-scope side effects the action file pulls in but this path never uses.
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth/create-profile", () => ({ createProfile: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => "contrib-1"),
}));

// `getPreviousYearApplication` returning null short-circuits section
// pre-population, which is not what this suite is about.
// `getPreviousYearReferenceSource` is the real subject and is driven per-test.
const referenceSourceMock = vi.fn();
vi.mock("@/lib/db/queries/reassessment", () => ({
  prepopulateReassessment: vi.fn(async () => undefined),
  getPreviousYearApplication: vi.fn(async () => null),
  getPreviousYearReferenceSource: () => referenceSourceMock(),
}));

let fakeTx: ReturnType<typeof makeFakeTx>["tx"];
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { createReassessmentApplicationAction } from "../actions";

// The Zod schema rejects anything that is not a UUID.
const ACCOUNT_ID = "00000000-0000-4000-a000-000000000001";
const ROUND_ID = "00000000-0000-4000-b000-000000000002";

function makeFakeTx() {
  const created: Record<string, unknown>[] = [];

  const tx = {
    bursaryAccount: {
      findUnique: vi.fn(async () => ({
        id: ACCOUNT_ID,
        leadApplicantId: "lead-1",
        school: "TRINITY",
        childName: "Bob Smith",
        childDob: null,
        entryYear: 2027,
        entryYearGroup: "Y6",
        leadApplicant: { id: "lead-1", email: "parent@example.test" },
      })),
    },
    round: {
      findUnique: vi.fn(async () => ({ academicYear: "2028/29" })),
    },
    application: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: "new-app-1", ...data };
      }),
    },
  };

  return { tx, created };
}

/** The prior year's application exactly as the reference-source query returns it. */
const UNTOUCHED_PRIOR = {
  // Byte-identical to what the generator produces for the prior year's facts.
  reference: "Bob Smith – Trinity School – Year 6 – 2027-28",
  childName: "Bob Smith",
  school: "TRINITY",
  entryYearGroup: "Y6",
  academicYear: "2027/28",
};

/**
 * This create path persists `entryYearGroup`, so the regenerated default keeps
 * its year-group segment — unlike the invitation path, which does not.
 */
const REGENERATED = "Bob Smith – Trinity School – Year 6 – 2028-29";

describe("createReassessmentApplicationAction — rollover reference (D13-1a Q5)", () => {
  let created: Record<string, unknown>[];

  beforeEach(() => {
    vi.clearAllMocks();
    const fake = makeFakeTx();
    fakeTx = fake.tx;
    created = fake.created;
  });

  it("inherits a reference edited to the external fees-system code", async () => {
    // The whole point of Q5: once the reference is the fees-system code, that
    // code is what reconciliation depends on and MUST survive the rollover.
    referenceSourceMock.mockResolvedValue({
      ...UNTOUCHED_PRIOR,
      reference: "TS-SMITH05-Smith, Bob",
    });

    const result = await createReassessmentApplicationAction(
      ACCOUNT_ID,
      ROUND_ID
    );

    expect(result.success).toBe(true);
    expect(created[0].reference).toBe("TS-SMITH05-Smith, Bob");
  });

  it("regenerates for the new year when the prior reference is the untouched default", async () => {
    // Inheriting verbatim would drag `… – 2027-28` onto a 2028-29 application.
    referenceSourceMock.mockResolvedValue(UNTOUCHED_PRIOR);

    await createReassessmentApplicationAction(ACCOUNT_ID, ROUND_ID);

    expect(created[0].reference).toBe(REGENERATED);
  });

  it("generates a fresh default when there is no prior-year application", async () => {
    referenceSourceMock.mockResolvedValue(null);

    await createReassessmentApplicationAction(ACCOUNT_ID, ROUND_ID);

    expect(created[0].reference).toBe(REGENERATED);
  });

  it("regenerates a pre-Epic-13 sequence reference instead of carrying it forward forever", async () => {
    referenceSourceMock.mockResolvedValue({
      ...UNTOUCHED_PRIOR,
      reference: "TS-20272028-0001",
    });

    await createReassessmentApplicationAction(ACCOUNT_ID, ROUND_ID);

    expect(created[0].reference).toBe(REGENERATED);
  });

  it("never emits the dropped account reference format (REA-BA-…)", async () => {
    // Regression pin for C4b: the reference used to be
    // `REA-${account.reference}-${roundId.slice(0,8)}`, built off
    // `bursary_accounts.reference` — a column that no longer exists.
    referenceSourceMock.mockResolvedValue(null);

    await createReassessmentApplicationAction(ACCOUNT_ID, ROUND_ID);

    expect(created[0].reference).not.toMatch(/^REA-/);
    expect(created[0].reference).not.toMatch(/BA-/);
  });
});
