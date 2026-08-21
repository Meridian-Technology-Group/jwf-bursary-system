import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CR-001 edit-on-behalf — APPLICANT provenance reclaim (saveSection /
 * saveSectionDraft).
 *
 * When the applicant re-edits a field an assessor previously entered on their
 * behalf, the assessor stamp for exactly that path must be cleared; untouched
 * stamps survive. When the stored provenance is empty (the overwhelmingly
 * common case) the upsert payload must be byte-identical to the pre-CR-001
 * save — no `assessorProvenance` key at all.
 *
 * Boundary mocks follow the edit-actions test pattern: auth, the RLS context
 * runners and next/cache are mocked; the Zod schemas, query helpers
 * (upsertSection / resolveOwningContributorId), section-diff and
 * refreshFormStatus run for real against a fake Prisma tx.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

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

// Boundary-mock the shared submission core (tested on its own) — importing the
// real module would drag in `server-only` via the gap engine, which vitest
// cannot resolve.
vi.mock("@/lib/applications/submission", () => ({
  submitApplicationCore: vi.fn(),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { saveSection, saveSectionDraft } from "../actions";

// The applicant owns one in-flight application; their PRIMARY contributor
// already exists. refreshFormStatus reads findUniqueOrThrow — returning
// SUBMITTED makes it return early without deriving, keeping the fake minimal
// (the status derivation has its own tests).
function makeFakeTx() {
  return {
    application: {
      findFirst: vi.fn(async () => ({ id: "app-1" })),
      findUniqueOrThrow: vi.fn(async () => ({
        formStatus: "SUBMITTED",
        applicationType: "NEW",
      })),
      update: vi.fn(async () => ({})),
    },
    applicationContributor: {
      findUnique: vi.fn(async () => ({ id: "contrib-1" })),
      upsert: vi.fn(async () => ({ id: "contrib-1" })),
    },
    applicationSection: {
      findUnique: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
      upsert: vi.fn(async (..._args: unknown[]) => ({ id: "sec-row-1" })),
      count: vi.fn(async () => 0),
    },
  };
}

const NARRATIVE_STAMP = {
  editedBy: "assessor-9",
  editedByName: "Ada Assessor",
  editedAt: "2026-06-01T00:00:00.000Z",
};
const DOC_STAMP = {
  editedBy: "assessor-9",
  editedByName: "Ada Assessor",
  editedAt: "2026-06-02T00:00:00.000Z",
};

// Stored ADDITIONAL_INFO row as the assessor left it: both leaf paths stamped.
const STORED_ROW = {
  data: {
    additionalNarrative: "Assessor-typed context.",
    additionalDocumentIds: ["doc-1"],
  },
  assessorProvenance: {
    additionalNarrative: NARRATIVE_STAMP,
    "additionalDocumentIds.0": DOC_STAMP,
  },
};

type UpsertArg = {
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

function upsertArg(): UpsertArg {
  expect(fakeTx.applicationSection.upsert).toHaveBeenCalledTimes(1);
  return fakeTx.applicationSection.upsert.mock.calls[0]![0] as UpsertArg;
}

describe("saveSection — applicant reclaims assessor-stamped fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => APPLICANT_USER);
    fakeTx = makeFakeTx();
  });

  it("clears provenance ONLY for the paths the applicant changed", async () => {
    fakeTx.applicationSection.findUnique.mockResolvedValue(STORED_ROW);

    // The applicant rewrites the narrative (path A) but keeps the doc list
    // (path B) untouched.
    const res = await saveSection(null, "ADDITIONAL_INFO", {
      additionalNarrative: "The applicant's own words.",
      additionalDocumentIds: ["doc-1"],
    });
    expect(res).toEqual({ success: true });

    const arg = upsertArg();
    // Path A reclaimed; path B's assessor stamp survives, byte-identical.
    expect(arg.update.assessorProvenance).toEqual({
      "additionalDocumentIds.0": DOC_STAMP,
    });
    expect(arg.create.assessorProvenance).toEqual({
      "additionalDocumentIds.0": DOC_STAMP,
    });
  });

  it("omits the provenance write when the stored provenance is empty", async () => {
    fakeTx.applicationSection.findUnique.mockResolvedValue({
      data: STORED_ROW.data,
      assessorProvenance: {},
    });

    const res = await saveSection(null, "ADDITIONAL_INFO", {
      additionalNarrative: "The applicant's own words.",
      additionalDocumentIds: ["doc-1"],
    });
    expect(res).toEqual({ success: true });

    // upsertSection was called WITHOUT the 7th arg → the payload carries no
    // assessorProvenance key at all (byte-identical to the pre-CR-001 save).
    const arg = upsertArg();
    expect(arg.update).not.toHaveProperty("assessorProvenance");
    expect(arg.create).not.toHaveProperty("assessorProvenance");
  });

  it("omits the provenance write when the section has never been saved", async () => {
    fakeTx.applicationSection.findUnique.mockResolvedValue(null);

    const res = await saveSection(null, "ADDITIONAL_INFO", {
      additionalNarrative: "First save, straight from the applicant.",
      additionalDocumentIds: [],
    });
    expect(res).toEqual({ success: true });

    const arg = upsertArg();
    expect(arg.update).not.toHaveProperty("assessorProvenance");
    expect(arg.create).not.toHaveProperty("assessorProvenance");
  });
});

describe("saveSectionDraft — draft saves reclaim too", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => APPLICANT_USER);
    fakeTx = makeFakeTx();
  });

  it("clears the stamps for changed paths on a draft save", async () => {
    fakeTx.applicationSection.findUnique.mockResolvedValue(STORED_ROW);

    // The draft removes the assessor-attached document (path B changes);
    // the narrative (path A) is untouched.
    const res = await saveSectionDraft(null, "ADDITIONAL_INFO", {
      additionalNarrative: "Assessor-typed context.",
      additionalDocumentIds: [],
    });
    expect(res).toEqual({ success: true });

    const arg = upsertArg();
    expect(arg.update.isComplete).toBe(false);
    expect(arg.update.assessorProvenance).toEqual({
      additionalNarrative: NARRATIVE_STAMP,
    });
  });
});

/**
 * WP B2 (autosave, CF-29) turns `saveSectionDraft` from a never-called action
 * into one that fires every few seconds while an applicant types — and every
 * one of those calls runs `clearedProvenanceForApplicantSave`. Before wiring
 * the debounced writer we had to know that path could take the traffic:
 *
 *  - **Idempotent** — the reclaim diffs the incoming values against what is
 *    ALREADY STORED, so once a path has been reclaimed, re-saving the same
 *    values diffs to nothing and rewrites the identical map. Repeated autosaves
 *    converge instead of eroding stamps the applicant never touched.
 *  - **Cheap** — one narrow indexed read (`data` + `assessorProvenance` on the
 *    section's unique key), and on the overwhelmingly common no-provenance row
 *    it returns before doing any diffing, leaving the upsert payload
 *    byte-identical to a pre-CR-001 save.
 *
 * These tests hold both properties in place. If someone later moves the reclaim
 * to fire on every write regardless of the stored values, the first one fails.
 */
describe("saveSectionDraft — repeated autosaves do not churn provenance", () => {
  /**
   * A tx whose upsert actually persists, so save N+1 sees what save N wrote —
   * which is the whole point: the diff is against STORED data.
   */
  function makeStatefulTx(initial: {
    data: unknown;
    assessorProvenance: unknown;
  }) {
    let row = { ...initial };
    return {
      application: {
        findFirst: vi.fn(async () => ({ id: "app-1" })),
        findUniqueOrThrow: vi.fn(async () => ({
          formStatus: "SUBMITTED",
          applicationType: "NEW",
        })),
        update: vi.fn(async () => ({})),
      },
      applicationContributor: {
        findUnique: vi.fn(async () => ({ id: "contrib-1" })),
        upsert: vi.fn(async () => ({ id: "contrib-1" })),
      },
      applicationSection: {
        findUnique: vi.fn(async (..._args: unknown[]): Promise<unknown> => row),
        upsert: vi.fn(async (args: { update: Record<string, unknown> }) => {
          row = {
            data: args.update.data,
            assessorProvenance:
              "assessorProvenance" in args.update
                ? args.update.assessorProvenance
                : row.assessorProvenance,
          };
          return { id: "sec-row-1" };
        }),
        count: vi.fn(async () => 0),
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockImplementation(async () => APPLICANT_USER);
  });

  it("reclaims a path once, then leaves the remaining stamps alone", async () => {
    fakeTx = makeStatefulTx(STORED_ROW) as unknown as typeof fakeTx;

    // The applicant is mid-edit of the assessor's narrative. The debounced
    // writer fires three times over the same field, then once more with the
    // final text.
    const drafts = [
      "The applicant's",
      "The applicant's own",
      "The applicant's own words.",
      "The applicant's own words.", // an idle write with nothing new typed
    ];
    for (const additionalNarrative of drafts) {
      const res = await saveSectionDraft(null, "ADDITIONAL_INFO", {
        additionalNarrative,
        additionalDocumentIds: ["doc-1"],
      });
      expect(res).toEqual({ success: true });
    }

    // Every write agrees: the narrative is the applicant's now, the document
    // the assessor attached is still theirs. Four saves, no erosion.
    const calls = fakeTx.applicationSection.upsert.mock.calls;
    expect(calls).toHaveLength(4);
    for (const [arg] of calls as unknown as Array<[UpsertArg]>) {
      expect(arg.update.assessorProvenance).toEqual({
        "additionalDocumentIds.0": DOC_STAMP,
      });
    }
  });

  it("costs one narrow indexed read per save", async () => {
    fakeTx = makeStatefulTx(STORED_ROW) as unknown as typeof fakeTx;

    await saveSectionDraft(null, "ADDITIONAL_INFO", {
      additionalNarrative: "Mine.",
      additionalDocumentIds: ["doc-1"],
    });

    expect(fakeTx.applicationSection.findUnique).toHaveBeenCalledTimes(1);
    const readArg = fakeTx.applicationSection.findUnique.mock
      .calls[0]![0] as { where: unknown; select: Record<string, boolean> };
    // The unique key, and only the two columns the diff needs.
    expect(readArg.where).toEqual({
      applicationId_section_ownerContributorId: {
        applicationId: "app-1",
        section: "ADDITIONAL_INFO",
        ownerContributorId: "contrib-1",
      },
    });
    expect(readArg.select).toEqual({ data: true, assessorProvenance: true });
  });

  it("never touches provenance at all on a section no assessor has edited", async () => {
    // The normal case: no stamps stored, so the diff is skipped entirely.
    fakeTx = makeStatefulTx({
      data: { additionalNarrative: "" },
      assessorProvenance: {},
    }) as unknown as typeof fakeTx;

    for (const additionalNarrative of ["W", "We ", "We moved."]) {
      await saveSectionDraft(null, "ADDITIONAL_INFO", { additionalNarrative });
    }

    const calls = fakeTx.applicationSection.upsert.mock.calls;
    expect(calls).toHaveLength(3);
    for (const [arg] of calls as unknown as Array<[UpsertArg]>) {
      expect(arg.update).not.toHaveProperty("assessorProvenance");
      expect(arg.create).not.toHaveProperty("assessorProvenance");
      expect(arg.update.isComplete).toBe(false);
    }
  });
});
