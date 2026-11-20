import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit 20 Nov 2026 (finding 8): the manual GDPR delete checks ONE
 * application against retention, but the cascade (`purgeApplication`) erases
 * the whole family — every contact and bursary account of the parent, the
 * accounts' synopsis, the parent's login. It must refuse while any other
 * record of the parent is still inside retention, and go ahead as before when
 * there is none (or when every other record is itself past retention).
 */

const ADMIN_USER = { id: "admin-1", role: "ADMIN", email: "a@x.test", firstName: "A", lastName: "Admin" };

vi.mock("@/lib/auth/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => ADMIN_USER),
    requireApplicationAccess: vi.fn(async () => {}),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => {}) }));

const purgeMock = vi.fn(async (..._args: unknown[]) => ({ storageErrors: [], authDeleteError: null, secondary: null }));
vi.mock("@/lib/retention/purge", async () => {
  const actual = await vi.importActual<typeof import("@/lib/retention/purge")>("@/lib/retention/purge");
  return { ...actual, purgeApplication: (...args: unknown[]) => purgeMock(...args) };
});

let fakeTx: ReturnType<typeof makeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
  withUserContext: vi.fn(),
}));

import { gdprDeleteApplicantAction } from "../actions";

const LONG_AGO = new Date("2015-01-01T00:00:00Z"); // closed > 6 years ago → purgeable

/** Child A: on account acct-a, closed long ago — passes the per-application gate. */
const CHILD_A = {
  id: "app-a",
  reference: "WS-2014-0001",
  submittedAt: new Date("2014-03-01T00:00:00Z"),
  archivedAt: null,
  closedAt: null,
  retentionStage: null,
  retentionStageAt: null,
  leadApplicantId: "lead-1",
  bursaryAccountId: "acct-a",
  documents: [],
  assessment: null,
  bursaryAccount: { status: "CLOSED", closedAt: LONG_AGO },
};

type OtherApp = {
  closedAt: Date | null;
  retentionStage: string | null;
  retentionStageAt: Date | null;
  bursaryAccount: { closedAt: Date | null } | null;
  assessment: null;
};

function makeTx({ otherApps = [] as OtherApp[], otherAccounts = [] as { closedAt: Date | null }[] } = {}) {
  return {
    application: {
      findUnique: vi.fn(async () => CHILD_A),
      count: vi.fn(async () => otherApps.length),
      findMany: vi.fn(async () => otherApps),
    },
    bursaryAccount: {
      count: vi.fn(async () => otherAccounts.length),
      findMany: vi.fn(async () => otherAccounts),
    },
  };
}

describe("gdprDeleteApplicantAction — whole-family guard (audit finding 8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses when the parent's other child has an ACTIVE account (child B inside retention)", async () => {
    fakeTx = makeTx({
      otherApps: [
        { closedAt: null, retentionStage: null, retentionStageAt: null, bursaryAccount: { closedAt: null }, assessment: null },
      ],
      otherAccounts: [{ closedAt: null }],
    });

    const res = await gdprDeleteApplicantAction("app-a");

    expect(res.success).toBe(false);
    expect(res).toMatchObject({ error: expect.stringContaining("erases the whole family") });
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it("goes ahead as before when the parent has no other records", async () => {
    fakeTx = makeTx();

    const res = await gdprDeleteApplicantAction("app-a");

    expect(res).toEqual({ success: true });
    expect(purgeMock).toHaveBeenCalledTimes(1);
  });

  it("goes ahead when every other record is itself past retention (earlier years on the same closed account)", async () => {
    fakeTx = makeTx({
      otherApps: [
        { closedAt: null, retentionStage: null, retentionStageAt: null, bursaryAccount: { closedAt: LONG_AGO }, assessment: null },
      ],
    });

    const res = await gdprDeleteApplicantAction("app-a");

    expect(res).toEqual({ success: true });
    expect(purgeMock).toHaveBeenCalledTimes(1);
  });
});
