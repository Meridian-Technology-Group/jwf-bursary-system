import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Audit finding 19 — characterisation of the three invitation send paths:
 *
 *   - createInvitationAction            (quick invite)
 *   - sendInvitationFromContactAction   (invite from a contact)
 *   - sendReassessmentInviteForHolder   (via batchReassessmentInviteAction)
 *
 * They used to repeat the same email-send + failure-rollback block, and the
 * copies drifted (the re-assessment path once kept its PENDING row, #516).
 * These tests pin EXACTLY what each path writes and sends — the invitation
 * row, the audit entries, the merge fields handed to sendEmail, the login
 * rollback, the revalidated paths and the result shape — on success and on a
 * failed send, so a shared helper cannot change any of it unnoticed.
 *
 * Written against the pre-refactor code; they must pass unchanged after it.
 */

const requireRoleMock = vi.fn(async () => ({ id: "admin-1", role: "ADMIN" }));
vi.mock("@/lib/auth/roles", () => ({
  requireRole: () => requireRoleMock(),
  requireApplicationAccess: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })),
  Role: { ADMIN: "ADMIN", ASSESSOR: "ASSESSOR", VIEWER: "VIEWER", APPLICANT: "APPLICANT" },
}));

const deleteUserMock = vi.fn(async (_id: string) => ({ error: null }));
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser: (id: string) => deleteUserMock(id) } },
  })),
}));

const provisionMock = vi.fn();
const ensureLoginMock = vi.fn();
vi.mock("@/lib/auth/provision-applicant", () => ({
  provisionApplicantAuthUser: (...args: unknown[]) => provisionMock(...args),
  ensureApplicantLogin: (...args: unknown[]) => ensureLoginMock(...args),
}));

const createProfileMock = vi.fn(async (_tx: unknown, _input: unknown) => ({ success: true }));
vi.mock("@/lib/auth/create-profile", () => ({
  createProfile: (tx: unknown, input: unknown) => createProfileMock(tx, input),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email/send", async () => {
  const bccPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    sendEmail: (...args: unknown[]) => sendEmailMock(...args),
    // Same rule as the real normaliseBccAddress (send.ts pulls in Resend).
    normaliseBccAddress: (raw: string | null | undefined) => {
      const trimmed = (raw ?? "").trim();
      if (!trimmed) return { ok: true, bcc: undefined };
      if (!bccPattern.test(trimmed)) return { ok: false };
      return { ok: true, bcc: trimmed };
    },
  };
});
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));
const revalidateMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidateMock(p) }));
const auditMock = vi.fn(async (_tx: unknown, _entry: unknown) => undefined);
vi.mock("@/lib/audit/log", () => ({
  createAuditLog: (tx: unknown, entry: unknown) => auditMock(tx, entry),
}));
vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => "contrib-1"),
}));
vi.mock("@/lib/db/queries/reassessment", () => ({
  prepopulateReassessment: vi.fn(async () => undefined),
  getPreviousYearApplication: vi.fn(async () => null),
  getPreviousYearReferenceSource: vi.fn(async () => null),
}));

const holdersMock = vi.fn(async (): Promise<unknown[]> => []);
const createInvitationMock = vi.fn(async (_tx: unknown, _input: unknown) => ({
  id: "inv-1",
  token: "tok-1",
}));
vi.mock("@/lib/db/queries/invitations", () => ({
  createInvitation: (tx: unknown, input: unknown) => createInvitationMock(tx, input),
  generateInvitationToken: vi.fn(() => "token"),
  getActiveBursaryHolders: () => holdersMock(),
}));

const ROUND = {
  academicYear: "2027/2028",
  status: "OPEN",
  openDate: new Date("2026-12-01T00:00:00.000Z"),
  closeDate: new Date("2027-05-21T00:00:00.000Z"),
  defaultSubmissionDeadlineNew: new Date("2027-01-15T00:00:00.000Z"),
  defaultSubmissionDeadlineRolling: new Date("2027-04-10T00:00:00.000Z"),
  windows: [],
};

const CONTACT = {
  id: "contact-1",
  firstName: "Pat",
  lastName: "Parent",
  email: "pat@example.test",
  childName: "Sam Parent",
  childFirstName: "Sam",
  childLastName: "Parent",
  childDob: new Date("2015-03-04T00:00:00.000Z"),
  school: "TRINITY",
  entryYear: 2027,
  entryYearGroup: "Y7",
  situation: "NEW" as string | null,
  profileId: null as string | null,
  archivedAt: null,
};

const fakeTx = {
  assessment: { count: vi.fn(async () => 0) },
  round: { findUnique: vi.fn(async () => ROUND) },
  contact: {
    findUnique: vi.fn(async () => ({ ...CONTACT })),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  },
  invitation: { delete: vi.fn(async () => ({})) },
};
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { createInvitationAction, batchReassessmentInviteAction } from "../actions";
import { sendInvitationFromContactAction } from "../../contacts/invite-actions";

const ROLLED_BACK = (err: string) =>
  `Email failed to send. The invitation was rolled back — please try again. (${err})`;

function audits(): Array<Record<string, unknown>> {
  return auditMock.mock.calls.map((c) => c[1] as Record<string, unknown>);
}
function revalidated(): string[] {
  return revalidateMock.mock.calls.map((c) => c[0] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));
  fakeTx.contact.findUnique.mockImplementation(async () => ({ ...CONTACT }));
});
afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// createInvitationAction
// ---------------------------------------------------------------------------

function quickInviteForm(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    email: "quick@example.test",
    firstName: "Quinn",
    lastName: "Quick",
    childFirstName: "Kit",
    childLastName: "Quick",
    childDob: "2015-06-07",
    school: "WHITGIFT",
    entryYearGroup: "Y7",
    roundId: "11111111-1111-4111-8111-111111111111",
    situation: "NEW",
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("createInvitationAction — send + rollback (characterisation)", () => {
  it("success: writes the row + audit and sends the resolved template with the shared merge fields", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const result = await createInvitationAction(
      quickInviteForm({ bcc: " bursary@example.test ", submitBy: "2027-02-01" })
    );

    expect(result).toEqual({ success: true });
    expect(createInvitationMock).toHaveBeenCalledTimes(1);
    expect(createInvitationMock.mock.calls[0][1]).toEqual({
      email: "quick@example.test",
      firstName: "Quinn",
      lastName: "Quick",
      childName: "Kit Quick",
      childFirstName: "Kit",
      childLastName: "Quick",
      childDob: new Date("2015-06-07T00:00:00.000Z"),
      school: "WHITGIFT",
      entryYearGroup: "Y7",
      roundId: "11111111-1111-4111-8111-111111111111",
      situation: "NEW",
      submissionDeadlineAt: expect.any(Date),
      authUserId: "auth-new",
      createdBy: "admin-1",
      expiresAt: new Date("2026-12-20T10:00:00.000Z"),
    });
    const submitBy = (createInvitationMock.mock.calls[0][1] as { submissionDeadlineAt: Date })
      .submissionDeadlineAt;

    expect(audits()).toEqual([
      {
        userId: "admin-1",
        action: "CREATE_INVITATION",
        entityType: "Invitation",
        entityId: "inv-1",
        context: "Sent invitation to quick@example.test",
        metadata: {
          email: "quick@example.test",
          roundId: "11111111-1111-4111-8111-111111111111",
          authUserId: "auth-new",
          submitBy: submitBy.toISOString(),
        },
      },
    ]);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0]).toEqual([
      "quick@example.test",
      "INVITATION_NEW_WS",
      {
        applicant_name: "Quinn Quick",
        child_name: "Kit Quick",
        school: "Whitgift School",
        round_year: "2027/2028",
        registration_link: "https://example.test/register?token=tok-1",
        opening_date: "01/12/2026",
        deadline: "01/02/2027",
        link_expiry: "20/12/2026",
      },
      { bcc: "bursary@example.test" },
    ]);

    expect(fakeTx.invitation.delete).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual(["/invitations"]);
  });

  it("success without submit-by or BCC: round deadline, no options argument, email as name fallback", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const fd = quickInviteForm();
    fd.delete("firstName");
    const result = await createInvitationAction(fd);

    expect(result).toEqual({ success: true });
    expect(sendEmailMock.mock.calls[0]).toEqual([
      "quick@example.test",
      "INVITATION_NEW_WS",
      {
        applicant_name: "Quick",
        child_name: "Kit Quick",
        school: "Whitgift School",
        round_year: "2027/2028",
        registration_link: "https://example.test/register?token=tok-1",
        opening_date: "01/12/2026",
        deadline: "15/01/2027",
        link_expiry: "20/12/2026",
      },
      undefined,
    ]);
    expect(audits()[0].metadata).toEqual({
      email: "quick@example.test",
      roundId: "11111111-1111-4111-8111-111111111111",
      authUserId: "auth-new",
      submitBy: null,
    });
  });

  it("email failure: deletes the row, audits CREATE_INVITATION_FAILED and removes the login it created", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await createInvitationAction(quickInviteForm());

    expect(result).toEqual({ success: false, error: ROLLED_BACK("bounced") });
    expect(fakeTx.invitation.delete).toHaveBeenCalledTimes(1);
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(audits().map((a) => a.action)).toEqual([
      "CREATE_INVITATION",
      "CREATE_INVITATION_FAILED",
    ]);
    expect(audits()[1]).toEqual({
      userId: "admin-1",
      action: "CREATE_INVITATION_FAILED",
      entityType: "Invitation",
      entityId: "inv-1",
      context: "Invitation to quick@example.test rolled back — email failed to send",
      metadata: {
        email: "quick@example.test",
        roundId: "11111111-1111-4111-8111-111111111111",
        authUserId: "auth-new",
        emailError: "bounced",
      },
    });
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("auth-new");
    expect(revalidated()).toEqual(["/invitations"]);
  });

  it("email failure with no error text: emailError null, message keeps 'undefined'", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false });

    const result = await createInvitationAction(quickInviteForm());

    expect(result).toEqual({ success: false, error: ROLLED_BACK("undefined") });
    expect((audits()[1].metadata as { emailError: unknown }).emailError).toBeNull();
  });

  it("email failure keeps a REUSED login", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-existing", created: false });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await createInvitationAction(quickInviteForm());

    expect(result.success).toBe(false);
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("a failed rollback transaction is swallowed; the login is still removed", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });
    auditMock
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => {
        throw new Error("audit down");
      });

    const result = await createInvitationAction(quickInviteForm());

    expect(result).toEqual({ success: false, error: ROLLED_BACK("bounced") });
    expect(deleteUserMock).toHaveBeenCalledWith("auth-new");
  });

  it("skipEmail: no send, returns the registration link", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });

    const result = await createInvitationAction(
      quickInviteForm({ skipEmail: "1", bcc: "bursary@example.test" })
    );

    expect(result).toEqual({
      success: true,
      registrationLink: "https://example.test/register?token=tok-1",
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual(["/invitations"]);
  });
});

// ---------------------------------------------------------------------------
// sendInvitationFromContactAction
// ---------------------------------------------------------------------------

describe("sendInvitationFromContactAction — send + rollback (characterisation)", () => {
  it("success: binds the contact, writes the row + audit and sends with the shared merge fields", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const result = await sendInvitationFromContactAction("contact-1", "round-1", {
      bcc: "bursary@example.test",
      submitBy: "2027-02-01",
    });

    expect(result).toEqual({ success: true });
    expect(provisionMock).toHaveBeenCalledWith(expect.anything(), "pat@example.test");
    expect(fakeTx.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { profileId: "auth-new" },
    });
    expect(createInvitationMock.mock.calls[0][1]).toEqual({
      email: "pat@example.test",
      firstName: "Pat",
      lastName: "Parent",
      childName: "Sam Parent",
      childFirstName: "Sam",
      childLastName: "Parent",
      childDob: CONTACT.childDob,
      school: "TRINITY",
      entryYear: 2027,
      entryYearGroup: "Y7",
      roundId: "round-1",
      contactId: "contact-1",
      situation: "NEW",
      submissionDeadlineAt: expect.any(Date),
      authUserId: "auth-new",
      createdBy: "admin-1",
      expiresAt: new Date("2026-12-20T10:00:00.000Z"),
    });
    const submitBy = (createInvitationMock.mock.calls[0][1] as { submissionDeadlineAt: Date })
      .submissionDeadlineAt;

    expect(audits()).toEqual([
      {
        userId: "admin-1",
        action: "INVITE_FROM_CONTACT",
        entityType: "Invitation",
        entityId: "inv-1",
        context: "Invited pat@example.test from contact (Sam Parent)",
        metadata: {
          contactId: "contact-1",
          email: "pat@example.test",
          roundId: "round-1",
          school: "TRINITY",
          entryYear: 2027,
          authUserId: "auth-new",
          submitBy: submitBy.toISOString(),
        },
      },
    ]);

    expect(sendEmailMock.mock.calls[0]).toEqual([
      "pat@example.test",
      "INVITATION_NEW_TS",
      {
        applicant_name: "Pat Parent",
        child_name: "Sam Parent",
        school: "Trinity School",
        round_year: "2027/2028",
        registration_link: "https://example.test/register?token=tok-1",
        opening_date: "01/12/2026",
        deadline: "01/02/2027",
        link_expiry: "20/12/2026",
      },
      { bcc: "bursary@example.test" },
    ]);
    expect(fakeTx.invitation.delete).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual(["/contacts", "/invitations"]);
  });

  it("success, legacy contact (no situation) and no BCC: generic template, round default, no options", async () => {
    fakeTx.contact.findUnique.mockImplementation(async () => ({ ...CONTACT, situation: null }));
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const result = await sendInvitationFromContactAction("contact-1", "round-1");

    expect(result).toEqual({ success: true });
    expect(sendEmailMock.mock.calls[0]).toEqual([
      "pat@example.test",
      "INVITATION",
      {
        applicant_name: "Pat Parent",
        child_name: "Sam Parent",
        school: "Trinity School",
        round_year: "2027/2028",
        registration_link: "https://example.test/register?token=tok-1",
        opening_date: "01/12/2026",
        deadline: "15/01/2027",
        link_expiry: "20/12/2026",
      },
      undefined,
    ]);
  });

  it("email failure: deletes the row, audits INVITE_FROM_CONTACT_FAILED and removes the login it created", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await sendInvitationFromContactAction("contact-1", "round-1");

    expect(result).toEqual({ success: false, error: ROLLED_BACK("bounced") });
    expect(fakeTx.invitation.delete).toHaveBeenCalledTimes(1);
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(audits().map((a) => a.action)).toEqual([
      "INVITE_FROM_CONTACT",
      "INVITE_FROM_CONTACT_FAILED",
    ]);
    expect(audits()[1]).toEqual({
      userId: "admin-1",
      action: "INVITE_FROM_CONTACT_FAILED",
      entityType: "Invitation",
      entityId: "inv-1",
      context: "Invite from contact to pat@example.test rolled back — email failed to send",
      // No authUserId on this path's failure entry (unlike the other two).
      metadata: {
        contactId: "contact-1",
        email: "pat@example.test",
        roundId: "round-1",
        emailError: "bounced",
      },
    });
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("auth-new");
    // Only /contacts on the failure path.
    expect(revalidated()).toEqual(["/contacts"]);
  });

  it("email failure on a contact already bound to a login: login checked, never deleted", async () => {
    fakeTx.contact.findUnique.mockImplementation(async () => ({
      ...CONTACT,
      profileId: "auth-bound",
    }));
    ensureLoginMock.mockResolvedValue({ ok: true, recreated: false });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await sendInvitationFromContactAction("contact-1", "round-1");

    expect(result).toEqual({ success: false, error: ROLLED_BACK("bounced") });
    expect(ensureLoginMock).toHaveBeenCalledWith(
      expect.anything(),
      "auth-bound",
      "pat@example.test"
    );
    expect(provisionMock).not.toHaveBeenCalled();
    expect(fakeTx.contact.update).not.toHaveBeenCalled();
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("email failure keeps a REUSED login", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-existing", created: false });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    await sendInvitationFromContactAction("contact-1", "round-1");

    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("skipEmail: no send, returns the registration link", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });

    const result = await sendInvitationFromContactAction("contact-1", "round-1", {
      skipEmail: true,
    });

    expect(result).toEqual({
      success: true,
      registrationLink: "https://example.test/register?token=tok-1",
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual(["/contacts", "/invitations"]);
  });

  it("an invalid BCC is rejected BEFORE any write: no login, no invitation, no send", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });

    const result = await sendInvitationFromContactAction("contact-1", "round-1", {
      bcc: "not-an-email",
    });

    expect(result).toEqual({ success: false, error: "That BCC address is not a valid email." });
    expect(provisionMock).not.toHaveBeenCalled();
    expect(ensureLoginMock).not.toHaveBeenCalled();
    expect(createProfileMock).not.toHaveBeenCalled();
    expect(fakeTx.contact.update).not.toHaveBeenCalled();
    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual([]);
  });

  it("skipEmail ignores the BCC, even an invalid one: the invitation is still created", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });

    const result = await sendInvitationFromContactAction("contact-1", "round-1", {
      skipEmail: true,
      bcc: "not-an-email",
    });

    expect(result).toEqual({
      success: true,
      registrationLink: "https://example.test/register?token=tok-1",
    });
    expect(createInvitationMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sendReassessmentInviteForHolder (through batchReassessmentInviteAction)
// ---------------------------------------------------------------------------

const HOLDER = {
  id: "acct-1",
  childName: "Robin Holder",
  school: "WHITGIFT",
  leadApplicant: { email: "holder@example.test", firstName: null, lastName: "Holder" },
};

describe("re-assessment invite — send + rollback (characterisation)", () => {
  beforeEach(() => {
    holdersMock.mockResolvedValue([HOLDER]);
  });

  it("success: REASSESSMENT template, rolling deadline, no opening_date, no options argument", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
    expect(createInvitationMock.mock.calls[0][1]).toEqual({
      email: "holder@example.test",
      firstName: undefined,
      lastName: "Holder",
      childName: "Robin Holder",
      school: "WHITGIFT",
      roundId: "round-1",
      bursaryAccountId: "acct-1",
      submissionDeadlineAt: null,
      authUserId: "auth-new",
      createdBy: "admin-1",
      expiresAt: new Date("2026-12-20T10:00:00.000Z"),
    });
    expect(audits()).toEqual([
      {
        userId: "admin-1",
        action: "BATCH_REASSESSMENT_INVITE",
        entityType: "Invitation",
        entityId: "inv-1",
        context: "Sent reassessment invitation to holder@example.test",
        metadata: {
          email: "holder@example.test",
          roundId: "round-1",
          bursaryAccountId: "acct-1",
          authUserId: "auth-new",
          submitBy: null,
        },
      },
    ]);
    expect(sendEmailMock.mock.calls[0]).toEqual([
      "holder@example.test",
      "REASSESSMENT",
      {
        applicant_name: "Holder",
        child_name: "Robin Holder",
        school: "Whitgift School",
        round_year: "2027/2028",
        registration_link: "https://example.test/register?token=tok-1",
        deadline: "10/04/2027",
        link_expiry: "20/12/2026",
      },
    ]);
    expect(fakeTx.invitation.delete).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(revalidated()).toEqual(["/invitations"]);
  });

  it("success with a batch submit-by: the date wins over the rolling default", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: true });

    await batchReassessmentInviteAction("round-1", "2027-02-01");

    const mergeData = sendEmailMock.mock.calls[0][2] as Record<string, string>;
    expect(mergeData.deadline).toBe("01/02/2027");
  });

  it("email failure: deletes the row, audits CREATE_INVITATION_FAILED, removes the login, counts the failure", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-new", created: true });
    sendEmailMock.mockResolvedValue({ success: false, error: "bounced" });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result).toEqual({ sent: 0, failed: 1, errors: ["holder@example.test: bounced"] });
    expect(fakeTx.invitation.delete).toHaveBeenCalledTimes(1);
    expect(fakeTx.invitation.delete).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    expect(audits()[1]).toEqual({
      userId: "admin-1",
      action: "CREATE_INVITATION_FAILED",
      entityType: "Invitation",
      entityId: "inv-1",
      context: "Reassessment invitation to holder@example.test rolled back — email failed to send",
      metadata: {
        email: "holder@example.test",
        roundId: "round-1",
        bursaryAccountId: "acct-1",
        authUserId: "auth-new",
        emailError: "bounced",
      },
    });
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("auth-new");
    expect(revalidated()).toEqual(["/invitations"]);
  });

  it("email failure with no error text: counted as 'Email failed to send'", async () => {
    provisionMock.mockResolvedValue({ ok: true, authUserId: "auth-existing", created: false });
    sendEmailMock.mockResolvedValue({ success: false });

    const result = await batchReassessmentInviteAction("round-1");

    expect(result).toEqual({
      sent: 0,
      failed: 1,
      errors: ["holder@example.test: Email failed to send"],
    });
    expect((audits()[1].metadata as { emailError: unknown }).emailError).toBeNull();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
