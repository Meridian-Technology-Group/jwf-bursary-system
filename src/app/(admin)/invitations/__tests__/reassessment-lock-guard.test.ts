import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Epic 18b — her sequencing rule: "I cannot send the next rolling-over
 * applications 8 months later, if the assessments from the previous round are
 * still showing as 'COMPLETE' only, they will need to show as 'LOCKED'."
 *
 * Pins the guard in `runReassessmentInvites` (the choke point all three
 * public reassessment-invite actions share): any earlier-round assessment
 * still stored-as-complete blocks the whole batch before a single send.
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER" },
}));

// Module-scope side effects the action file pulls in but this path never uses.
const sendEmailMock = vi.fn();
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth/provision-applicant", () => ({
  provisionApplicantAuthUser: vi.fn(),
}));
vi.mock("@/lib/auth/create-profile", () => ({ createProfile: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  normaliseBccAddress: (v: unknown) => v,
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => "contrib-1"),
}));
vi.mock("@/lib/db/queries/reassessment", () => ({
  prepopulateReassessment: vi.fn(async () => undefined),
  getPreviousYearApplication: vi.fn(async () => null),
  getPreviousYearReferenceSource: vi.fn(async () => null),
}));

const holdersMock = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("@/lib/db/queries/invitations", () => ({
  createInvitation: vi.fn(),
  generateInvitationToken: vi.fn(() => "token"),
  getActiveBursaryHolders: () => holdersMock(),
}));

let fakeTx: {
  assessment: { count: ReturnType<typeof vi.fn> };
  round: { findUnique: ReturnType<typeof vi.fn> };
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { batchReassessmentInviteAction } from "../actions";

function makeFakeTx(unlockedComplete: number) {
  return {
    assessment: { count: vi.fn(async () => unlockedComplete) },
    round: {
      findUnique: vi.fn(async () => ({
        academicYear: "2027/2028",
        closeDate: new Date("2027-05-21"),
        defaultSubmissionDeadlineNew: null,
        defaultSubmissionDeadlineRolling: null,
        windows: [],
      })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Epic 18b — the rolling-over invitation guard", () => {
  it("refuses the whole batch while earlier-round assessments sit at stored-as-complete", async () => {
    fakeTx = makeFakeTx(3);
    holdersMock.mockResolvedValueOnce([
      { id: "holder-1", childName: "A", leadApplicant: { email: "a@example.test" } },
    ]);

    const result = await batchReassessmentInviteAction("round-1");

    expect(result.sent).toBe(0);
    expect(result.errors.join(" ")).toContain('still "stored as complete"');
    expect(result.errors.join(" ")).toContain("3 assessments are");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("passes the guard when everything is locked (falls through to eligibility)", async () => {
    fakeTx = makeFakeTx(0);
    holdersMock.mockResolvedValueOnce([]);

    const result = await batchReassessmentInviteAction("round-1");

    // Nothing eligible to invite in this fixture — the point is the guard
    // did NOT fire; the batch reached the normal eligibility handling.
    expect(result.errors).toEqual(["No eligible holders selected"]);
  });
});
