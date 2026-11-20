import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit finding 9 — a section save must land on the application the form was
 * rendered for, never on "whichever draft the server picks".
 *
 * Before the fix the save actions ignored the id the section page passed back
 * and re-resolved the application from the active-application cookie, falling
 * back to ANY other draft when that one was submitted or missing. So:
 *
 *  - child A's income open in tab 1, child B opened in tab 2 (which re-points
 *    the cookie at B) → tab 1's autosave wrote A's figures into B;
 *  - A submitted in another tab → tab 1's autosave fell back to B.
 *
 * Boundary mocks match the sibling save tests: auth, the RLS context runners,
 * next/cache and the active-application cookie are mocked; the query helpers
 * run for real against a fake Prisma tx that applies the ownership WHERE.
 */

const APPLICANT_USER = {
  id: "parent-1",
  role: "APPLICANT",
  email: "parent@example.test",
  firstName: "Pat",
  lastName: "Parent",
  phone: null,
};

const getCurrentUserMock = vi.fn(async (): Promise<unknown> => APPLICANT_USER);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
  };
});

// The cookie a second tab re-points by opening another child's application.
const activeIdMock = vi.fn(async (): Promise<string | null> => null);
vi.mock("@/lib/portal/active-application", () => ({
  getActiveApplicationId: () => activeIdMock(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/applications/submission", () => ({
  submitApplicationCore: vi.fn(),
}));

let fakeTx: ReturnType<typeof makeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { saveSection, saveSectionDraft } from "../actions";

interface FakeApp {
  id: string;
  leadApplicantId: string;
  formStatus: string;
  applicationType: string;
}

/** Applies the parts of the ownership WHERE the actions rely on. */
function matches(app: FakeApp, where: Record<string, unknown>): boolean {
  if (where.id !== undefined && where.id !== app.id) return false;
  if (
    where.leadApplicantId !== undefined &&
    where.leadApplicantId !== app.leadApplicantId
  ) {
    return false;
  }
  const fs = where.formStatus as { not?: string } | undefined;
  if (fs?.not !== undefined && app.formStatus === fs.not) return false;
  return true;
}

function makeTx(apps: FakeApp[]) {
  return {
    apps,
    application: {
      // No orderBy, like the old fallback: first match wins.
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const hit = apps.find((a) => matches(a, args.where));
        return hit ? { id: hit.id } : null;
      }),
      findUniqueOrThrow: vi.fn(async (args: { where: { id: string } }) => {
        const app = apps.find((a) => a.id === args.where.id);
        if (!app) throw new Error("not found");
        return { ...app };
      }),
      update: vi.fn(async () => ({})),
    },
    applicationContributor: {
      findUnique: vi.fn(async () => ({ id: "contrib-1" })),
      upsert: vi.fn(async () => ({ id: "contrib-1" })),
    },
    applicationSection: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
  };
}

function writtenApplicationIds(): string[] {
  return fakeTx.applicationSection.upsert.mock.calls.map(
    (call) =>
      (
        call as unknown as [
          { where: { applicationId_section_ownerContributorId: { applicationId: string } } },
        ]
      )[0].where.applicationId_section_ownerContributorId.applicationId
  );
}

const DRAFT = { additionalNarrative: "Child A's figures" };
const COMPLETE = {
  additionalNarrative: "Child A's figures",
  additionalDocumentIds: [],
};

const app = (id: string, over: Partial<FakeApp> = {}): FakeApp => ({
  id,
  leadApplicantId: APPLICANT_USER.id,
  formStatus: "IN_PROGRESS",
  applicationType: "NEW",
  ...over,
});

describe("section saves target the application the form was rendered for", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => APPLICANT_USER);
    activeIdMock.mockImplementation(async () => null);
  });

  it("autosave from tab A writes to A even after tab B re-points the active cookie at B", async () => {
    // B listed first so a "first draft wins" resolution would pick it.
    fakeTx = makeTx([app("app-B"), app("app-A")]);
    activeIdMock.mockImplementation(async () => "app-B");

    const draft = await saveSectionDraft("app-A", "ADDITIONAL_INFO", DRAFT);
    const full = await saveSection("app-A", "ADDITIONAL_INFO", COMPLETE);

    expect(draft).toEqual({ success: true });
    expect(full).toEqual({ success: true });
    expect(writtenApplicationIds()).toEqual(["app-A", "app-A"]);
  });

  it("refuses — and writes nothing — when the form's application has since been submitted", async () => {
    fakeTx = makeTx([app("app-B"), app("app-A", { formStatus: "SUBMITTED" })]);
    activeIdMock.mockImplementation(async () => "app-A");

    const draft = await saveSectionDraft("app-A", "ADDITIONAL_INFO", DRAFT);
    const full = await saveSection("app-A", "ADDITIONAL_INFO", COMPLETE);

    for (const res of [draft, full]) {
      expect(res.success).toBe(false);
      expect(res.errors?.[0]).toMatch(/already have been submitted/);
    }
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
  });

  it("refuses an application id the caller does not own", async () => {
    fakeTx = makeTx([
      app("app-B"),
      app("app-X", { leadApplicantId: "someone-else" }),
    ]);

    const res = await saveSectionDraft("app-X", "ADDITIONAL_INFO", DRAFT);

    expect(res.success).toBe(false);
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
  });

  it("refuses when no application id is supplied rather than guessing one", async () => {
    fakeTx = makeTx([app("app-B")]);
    activeIdMock.mockImplementation(async () => "app-B");

    const res = await saveSectionDraft(null, "ADDITIONAL_INFO", DRAFT);

    expect(res.success).toBe(false);
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
  });
});
