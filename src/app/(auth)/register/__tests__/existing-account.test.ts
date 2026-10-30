import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserById = vi.fn();
const invitationCount = vi.fn();

vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { getUserById } } }),
}));
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) =>
    fn({ invitation: { count: invitationCount }, round: { findUnique: async () => ({ academicYear: "2026/27" }) } }),
}));
vi.mock("@/lib/auth/roles", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/create-profile", () => ({ createProfile: vi.fn() }));
vi.mock("@/lib/db/queries/reassessment", () => ({ createReassessmentApplicationFromInvitation: vi.fn() }));
vi.mock("@/lib/applications/create-from-invitation", () => ({
  canCreateFirstYearApplication: vi.fn(),
  createFirstYearApplicationFromSource: vi.fn(),
}));
vi.mock("@/lib/auth/password-policy", () => ({ validatePasswordStrength: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/db/queries/invitations", () => ({
  getInvitationByToken: async () => ({
    id: "inv-1",
    email: "parent@example.test",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 86_400_000),
    authUserId: "user-1",
    bursaryAccountId: null,
    roundId: "round-1",
    firstName: "A",
    lastName: "Parent",
    childName: "A Child",
    school: "TRINITY",
  }),
  markInvitationAccepted: vi.fn(),
}));

import { validateApplicantInvitationAction } from "../actions";

describe("validateApplicantInvitationAction — existing account (18 Oct 2026)", () => {
  beforeEach(() => {
    getUserById.mockReset();
    invitationCount.mockReset();
  });

  it("an earlier accepted invitation means an existing account", async () => {
    invitationCount.mockResolvedValue(1);
    const r = await validateApplicantInvitationAction("tok");
    expect(r).toMatchObject({ success: true, existingAccount: true });
  });

  it("a migrated login that has signed in is an existing account", async () => {
    invitationCount.mockResolvedValue(0);
    getUserById.mockResolvedValue({ data: { user: { last_sign_in_at: "2026-10-13T10:00:00Z" } }, error: null });
    const r = await validateApplicantInvitationAction("tok");
    expect(r).toMatchObject({ success: true, existingAccount: true });
  });

  it("a migrated login never signed in still registers (sets its password)", async () => {
    invitationCount.mockResolvedValue(0);
    getUserById.mockResolvedValue({ data: { user: { last_sign_in_at: null } }, error: null });
    const r = await validateApplicantInvitationAction("tok");
    expect(r).toMatchObject({ success: true, existingAccount: false });
  });
});
