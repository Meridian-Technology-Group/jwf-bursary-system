import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit 20 Nov 2026: adding a second parent reuses any profile that already
 * has the email. A staff profile must never be linked: the second parent's
 * login would carry the staff role (profiles.role is synced into the JWT).
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
const requireAccessMock = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  requireApplicationAccess: (...args: unknown[]) => requireAccessMock(...args),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER", APPLICANT: "APPLICANT" },
}));

const createUserMock = vi.fn();
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { createUser: createUserMock } },
  })),
}));
vi.mock("@/lib/auth/provision-applicant", () => ({
  provisionApplicantAuthUser: vi.fn(),
}));
vi.mock("@/lib/auth/create-profile", () => ({ createProfile: vi.fn() }));
const sendEmailMock = vi.fn();
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
vi.mock("@/lib/db/queries/invitations", () => ({
  createInvitation: vi.fn(),
  generateInvitationToken: vi.fn(() => "token"),
  getActiveBursaryHolders: vi.fn(async () => []),
}));

const APP_ID = "11111111-1111-4111-8111-111111111111";

let profileRow: { id: string; role: string } | null;
const fakeTx = {
  application: {
    findUnique: vi.fn(async () => ({
      id: APP_ID,
      roundId: "round-1",
      school: "WHITGIFT",
      childName: "Child",
      applicationType: "NEW",
      submissionDeadlineAt: null,
      round: {
        academicYear: "2026/27",
        closeDate: new Date("2099-01-01"),
        defaultSubmissionDeadlineNew: null,
        defaultSubmissionDeadlineRolling: null,
        windows: [],
      },
      contributors: [],
    })),
  },
  profile: { findUnique: vi.fn(async () => profileRow) },
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { addSecondParentAction } from "../actions";

describe("addSecondParentAction — staff email guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["ADMIN", "ASSESSOR", "VIEWER"])(
    "refuses an email that belongs to a %s profile, before any login or email",
    async (role) => {
      profileRow = { id: "staff-1", role };
      const result = await addSecondParentAction(APP_ID, "staff@example.test");
      expect(result).toEqual({
        success: false,
        error:
          "This email address belongs to a staff account and cannot be added as a second parent.",
      });
      expect(createUserMock).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    }
  );
});

describe("addSecondParentAction — assessor scoping (audit finding 7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an assessor not assigned to the application is refused before any read, login or email", async () => {
    const assessor = { id: "assessor-a", role: "ASSESSOR" };
    requireRoleMock.mockResolvedValueOnce(assessor);
    requireAccessMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    profileRow = null;

    await expect(
      addSecondParentAction(APP_ID, "parent2@example.test")
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(requireAccessMock).toHaveBeenCalledWith(assessor, APP_ID);
    expect(fakeTx.application.findUnique).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
