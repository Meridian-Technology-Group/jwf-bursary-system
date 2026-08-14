import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `saveSectionDraft` — the write the WP B2 autosave makes when the section does
 * not yet pass its schema (Epic 13, CF-29, decision D13-7).
 *
 * Until this sprint the action had no caller outside a test. Now a debounced
 * background writer drives it, which puts two properties on the critical path:
 *
 *  1. It must persist a HALF-FINISHED section verbatim. The applicant lost a
 *     completed income section twice; a background save that rejected partial
 *     input would leave exactly that hole open.
 *  2. It must never make a partial section look done. `isComplete` stays false,
 *     so the stepper keeps the section outstanding and `form_status` is not
 *     promoted by an autosave.
 *
 * Boundary mocks match the sibling provenance test: auth, the RLS context
 * runners and next/cache are mocked; the query helpers and status derivation
 * run for real against a fake Prisma tx.
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/applications/submission", () => ({
  submitApplicationCore: vi.fn(),
}));

let fakeTx: ReturnType<typeof makeStatefulTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import {
  saveSection,
  saveSectionDraft,
  getSection,
  getSectionStatus,
} from "../actions";

interface StoredSection {
  applicationId: string;
  section: string;
  ownerContributorId: string;
  data: unknown;
  isComplete: boolean;
  updatedAt: Date;
  assessorProvenance?: unknown;
}

/**
 * A fake tx that actually STORES what it is given, so a draft can be written
 * and then read back through the real query helpers — the round trip the
 * applicant experiences when they close the tab and come back.
 */
function makeStatefulTx() {
  const rows = new Map<string, StoredSection>();
  const key = (applicationId: string, section: string, owner: string) =>
    `${applicationId}|${section}|${owner}`;
  // A brand-new application: created, nothing complete yet.
  const app = { formStatus: "CREATED", applicationType: "NEW" };

  return {
    rows,
    app,
    application: {
      findFirst: vi.fn(async () => ({ id: "app-1" })),
      findUniqueOrThrow: vi.fn(async () => ({ ...app })),
      update: vi.fn(async (args: { data: { formStatus: string } }) => {
        app.formStatus = args.data.formStatus;
        return {};
      }),
    },
    applicationContributor: {
      findUnique: vi.fn(async () => ({ id: "contrib-1" })),
      upsert: vi.fn(async () => ({ id: "contrib-1" })),
    },
    applicationSection: {
      findUnique: vi.fn(
        async (args: {
          where: {
            applicationId_section_ownerContributorId: {
              applicationId: string;
              section: string;
              ownerContributorId: string;
            };
          };
        }) => {
          const w = args.where.applicationId_section_ownerContributorId;
          return (
            rows.get(key(w.applicationId, w.section, w.ownerContributorId)) ??
            null
          );
        }
      ),
      findMany: vi.fn(async (args: { where: { applicationId: string } }) =>
        Array.from(rows.values()).filter(
          (r) => r.applicationId === args.where.applicationId
        )
      ),
      upsert: vi.fn(
        async (args: {
          where: {
            applicationId_section_ownerContributorId: {
              applicationId: string;
              section: string;
              ownerContributorId: string;
            };
          };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          const w = args.where.applicationId_section_ownerContributorId;
          const id = key(w.applicationId, w.section, w.ownerContributorId);
          const existing = rows.get(id);
          const next = {
            ...(existing ?? {
              applicationId: w.applicationId,
              section: w.section,
              ownerContributorId: w.ownerContributorId,
            }),
            ...(existing ? args.update : args.create),
            updatedAt: new Date("2026-08-14T12:00:00.000Z"),
          } as StoredSection;
          rows.set(id, next);
          return next;
        }
      ),
      count: vi.fn(
        async (args: { where: { applicationId: string; isComplete: boolean } }) =>
          Array.from(rows.values()).filter(
            (r) =>
              r.applicationId === args.where.applicationId &&
              r.isComplete === args.where.isComplete
          ).length
      ),
    },
  };
}

/** A genuinely half-finished ADDITIONAL_INFO section — mid-sentence, no docs. */
const PARTIAL = {
  additionalNarrative: "We had to move house in March and my hours were cut fr",
};

describe("saveSectionDraft — a half-finished section survives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => APPLICANT_USER);
    fakeTx = makeStatefulTx();
  });

  it("persists partial values and restores them on the next visit", async () => {
    const saved = await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    expect(saved).toEqual({ success: true });

    // What the section page loads when the applicant comes back.
    const restored = await getSection(null, "ADDITIONAL_INFO");
    expect(restored.data).toEqual(PARTIAL);
    expect(restored.isComplete).toBe(false);
  });

  it("keeps the stepper showing the section as outstanding", async () => {
    await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);

    const statuses = await getSectionStatus(null);
    expect(statuses).toEqual([
      expect.objectContaining({
        section: "ADDITIONAL_INFO",
        isComplete: false,
      }),
    ]);
    // …and repeated background drafts never promote the form's status.
    await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    expect(fakeTx.app.formStatus).toBe("CREATED");
    expect(fakeTx.application.update).not.toHaveBeenCalled();
  });

  it("writes the newest values on each successive autosave", async () => {
    await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    await saveSectionDraft(null, "ADDITIONAL_INFO", {
      additionalNarrative: "We had to move house in March and my hours were cut from 30 to 18.",
    });

    const restored = await getSection(null, "ADDITIONAL_INFO");
    expect(restored.data).toEqual({
      additionalNarrative:
        "We had to move house in March and my hours were cut from 30 to 18.",
    });
    expect(restored.isComplete).toBe(false);
  });

  it("is superseded by the completing save, not the other way round", async () => {
    // The autosave leaves a draft…
    await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    expect((await getSection(null, "ADDITIONAL_INFO")).isComplete).toBe(false);

    // …then the applicant finishes the section and clicks Save and Continue.
    const complete = {
      additionalNarrative: "We had to move house in March.",
      additionalDocumentIds: [],
    };
    const res = await saveSection(null, "ADDITIONAL_INFO", complete);
    expect(res).toEqual({ success: true });

    const restored = await getSection(null, "ADDITIONAL_INFO");
    expect(restored.data).toEqual(complete);
    expect(restored.isComplete).toBe(true);
    // Only the completing save moves the form on.
    expect(fakeTx.app.formStatus).toBe("IN_PROGRESS");
  });

  it("refuses to write when there is no session", async () => {
    getCurrentUserMock.mockImplementation(async () => null);

    const res = await saveSectionDraft(null, "ADDITIONAL_INFO", PARTIAL);
    expect(res.success).toBe(false);
    expect(fakeTx.applicationSection.upsert).not.toHaveBeenCalled();
  });
});
