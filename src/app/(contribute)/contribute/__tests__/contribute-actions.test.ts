import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit finding 17 — the second parent's /contribute actions.
 *
 *  1. After the second parent submits, an open /contribute tab must not keep
 *     autosaving over the sections the assessor is now reviewing. RLS on their
 *     section rows has no status condition, so the action is the gate.
 *  2. `submitContribution` must RETURN its "not complete" / outstanding-gaps
 *     failures. A thrown message is masked by Next.js in production, so the
 *     parent only ever saw "An error occurred in the Server Components render".
 *
 * Boundary mocks follow the portal save tests: auth, the RLS context runners,
 * the context/query helpers, email, audit and next/* are mocked.
 */

const SECONDARY_USER = {
  id: "second-1",
  role: "APPLICANT",
  email: "second@example.test",
  firstName: "Sam",
  lastName: "Second",
  phone: null,
};

const getCurrentUserMock = vi.fn(async (): Promise<unknown> => SECONDARY_USER);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, getCurrentUser: () => getCurrentUserMock() };
});

const redirectMock = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;replace;${url}`,
  });
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const fakeTx = {
  applicationContributor: { update: vi.fn(async () => ({})) },
};
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

const contextMock = vi.fn(async (): Promise<unknown> => null);
vi.mock("@/lib/db/queries/contributors", () => ({
  getSecondaryContributorContext: () => contextMock(),
}));

const upsertSectionMock = vi.fn(async (..._args: unknown[]) => ({}));
const statusListMock = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("@/lib/db/queries/applications", () => ({
  upsertSection: (...args: unknown[]) => upsertSectionMock(...args),
  getSectionStatusList: () => statusListMock(),
  getSectionData: vi.fn(async () => null),
}));

const gapStatusesMock = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("@/lib/portal/section-gaps", () => ({
  getSectionGapStatuses: () => gapStatusesMock(),
}));

const sendEmailMock = vi.fn(async (..._args: unknown[]) => ({ success: true }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn(async () => {}) }));

// The application's deadline (Brian, 21 Nov 2026). Open unless a test says so.
const deadlinePassedMock = vi.fn(async (_applicationId: string) => false);
vi.mock("@/lib/contributors/second-parent-deadline", () => ({
  applicationDeadlinePassed: (applicationId: string) => deadlinePassedMock(applicationId),
}));

import {
  saveSection,
  saveSectionDraft,
  submitContribution,
} from "../actions";

function contributorCtx(status: string) {
  return {
    applicationId: "app-1",
    contributorId: "contrib-2",
    status,
    childName: "Child",
    school: "WHITGIFT",
    roundYear: "2026/27",
  };
}

const PARTIAL_INCOME = { parent1Income: { grossSalary: 41000 } };

describe("contribute saves stop once the second parent has submitted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => SECONDARY_USER);
  });

  it("refuses an autosave (draft) from a stale tab after submission", async () => {
    contextMock.mockResolvedValue(contributorCtx("SUBMITTED"));

    const res = await saveSectionDraft("app-1", "PARENTS_INCOME", PARTIAL_INCOME);

    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toMatch(/already submitted your details/);
    expect(upsertSectionMock).not.toHaveBeenCalled();
  });

  it("refuses a full save after submission", async () => {
    contextMock.mockResolvedValue(contributorCtx("SUBMITTED"));

    const res = await saveSection("app-1", "PARENTS_INCOME", PARTIAL_INCOME);

    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toMatch(/already submitted your details/);
    expect(upsertSectionMock).not.toHaveBeenCalled();
  });

  it("still autosaves while the second parent is filling in", async () => {
    contextMock.mockResolvedValue(contributorCtx("IN_PROGRESS"));

    const res = await saveSectionDraft("app-1", "PARENTS_INCOME", PARTIAL_INCOME);

    expect(res).toEqual({ success: true });
    expect(upsertSectionMock).toHaveBeenCalledTimes(1);
  });
});

describe("submitContribution returns (never throws) a blocked submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => SECONDARY_USER);
    contextMock.mockResolvedValue(contributorCtx("IN_PROGRESS"));
  });

  it("returns the incomplete sections by name", async () => {
    statusListMock.mockResolvedValue([
      { section: "PARENT_DETAILS", isComplete: true },
      { section: "PARENTS_INCOME", isComplete: false },
      { section: "ASSETS_LIABILITIES", isComplete: true },
    ]);

    const result = await submitContribution();

    expect(result).toEqual({
      success: false,
      error:
        "The following sections are not yet complete: Parents' Income. Please complete them before submitting.",
    });
    expect(fakeTx.applicationContributor.update).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns the outstanding gaps as plain text", async () => {
    statusListMock.mockResolvedValue([
      { section: "PARENT_DETAILS", isComplete: true },
      { section: "PARENTS_INCOME", isComplete: true },
      { section: "ASSETS_LIABILITIES", isComplete: true },
    ]);
    gapStatusesMock.mockResolvedValue([
      {
        sectionType: "PARENTS_INCOME",
        gaps: [
          { id: "g1", sectionType: "PARENTS_INCOME", label: "Upload your P60", severity: "error" },
          { id: "g2", sectionType: "PARENTS_INCOME", label: "Optional note", severity: "warning" },
        ],
      },
    ]);

    const result = await submitContribution();

    expect(result).toEqual({
      success: false,
      error: "Please resolve: Upload your P60",
    });
    expect(fakeTx.applicationContributor.update).not.toHaveBeenCalled();
  });

  it("returns an error when the caller is not a second parent", async () => {
    contextMock.mockResolvedValue(null);

    const result = await submitContribution();

    expect(result).toEqual({
      success: false,
      error: "No active contribution found.",
    });
  });
});

describe("the application's deadline binds the second parent (Brian, 21 Nov 2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => SECONDARY_USER);
    contextMock.mockResolvedValue(contributorCtx("IN_PROGRESS"));
    deadlinePassedMock.mockResolvedValue(true);
  });

  it("refuses an autosave past the deadline, writing nothing", async () => {
    const res = await saveSectionDraft("app-1", "PARENTS_INCOME", PARTIAL_INCOME);
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toMatch(/deadline for this application has passed/);
    expect(upsertSectionMock).not.toHaveBeenCalled();
    expect(deadlinePassedMock).toHaveBeenCalledWith("app-1");
  });

  it("refuses a full save past the deadline", async () => {
    const res = await saveSection("app-1", "PARENTS_INCOME", PARTIAL_INCOME);
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toMatch(/deadline for this application has passed/);
    expect(upsertSectionMock).not.toHaveBeenCalled();
  });

  it("refuses the submit past the deadline, before the completeness check", async () => {
    const res = await submitContribution();
    expect(res).toEqual({
      success: false,
      error: expect.stringMatching(/deadline for this application has passed/),
    });
    expect(statusListMock).not.toHaveBeenCalled();
    expect(fakeTx.applicationContributor.update).not.toHaveBeenCalled();
  });
});
