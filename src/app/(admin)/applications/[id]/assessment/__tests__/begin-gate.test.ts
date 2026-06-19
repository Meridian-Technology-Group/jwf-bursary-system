import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * B1 — assessment-begin gate. `beginAssessmentAction` and
 * `proceedWithoutSecondParentAction` must NOT create an assessment row for an
 * application whose form has not been submitted (review phase PRE_SUBMISSION),
 * and the pre-existing second-parent gate behaviour must be unchanged.
 *
 * Boundary-mock pattern (see ../../__tests__/schedule-actions.test.ts):
 * requireRole→ADMIN, requireApplicationAccess→noop, withUserContext runs the
 * callback against a hand-built fake tx, and createAssessment / audit /
 * revalidatePath are stubbed so we can assert whether a row was created.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return {
    ...actual,
    requireRole: vi.fn(async () => ({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.test",
      firstName: "Al",
      lastName: "Admin",
    })),
    requireApplicationAccess: vi.fn(async () => {}),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit/log", () => ({ createAuditLog: () => auditMock() }));

// createAssessment is the row-creation side effect the gate must prevent on a
// draft. Spy so we can assert it is (not) called.
const createAssessmentMock = vi.fn(
  async (..._args: unknown[]) => ({ id: "asmt-new" })
);
vi.mock("@/lib/db/queries/assessments", () => ({
  createAssessment: (...args: unknown[]) => createAssessmentMock(...args),
}));

// Second-parent gate dependency. Defaults to "no secondary" (single-parent),
// overridable per-test.
let secondaryContributor: { status: string } | null = null;
vi.mock("@/lib/db/queries/contributors", () => ({
  getSecondaryContributor: vi.fn(async () => secondaryContributor),
}));

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
}));

import {
  beginAssessmentAction,
  proceedWithoutSecondParentAction,
  NOT_SUBMITTED_GATE_MESSAGE,
} from "../actions";

function makeFakeTx(
  app: {
    formStatus: string;
    assessment?: { status: string | null; outcome: string | null } | null;
  } | null = { formStatus: "SUBMITTED", assessment: null }
) {
  return {
    application: {
      findUnique: vi.fn(async () => app),
    },
    assessment: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
  };
}

describe("beginAssessmentAction — submitted gate (B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secondaryContributor = null;
  });

  it.each(["CREATED", "NOT_STARTED", "IN_PROGRESS", "FILLED_IN"])(
    "BLOCKS begin on a %s (draft) form and creates no assessment row",
    async (formStatus) => {
      fakeTx = makeFakeTx({ formStatus, assessment: null });
      const res = await beginAssessmentAction("app-1");
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toBe(NOT_SUBMITTED_GATE_MESSAGE);
      expect(createAssessmentMock).not.toHaveBeenCalled();
    }
  );

  it("ALLOWS begin on a SUBMITTED form and creates the assessment row", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED", assessment: null });
    const res = await beginAssessmentAction("app-1");
    expect(res).toEqual({ success: true, assessmentId: "asmt-new" });
    expect(createAssessmentMock).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when the application is missing (no row created)", async () => {
    fakeTx = makeFakeTx(null);
    const res = await beginAssessmentAction("app-1");
    expect(res.success).toBe(false);
    expect(createAssessmentMock).not.toHaveBeenCalled();
  });

  it("preserves the second-parent gate: SUBMITTED form but unsubmitted secondary still blocks", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED", assessment: null });
    secondaryContributor = { status: "INVITED" };
    const res = await beginAssessmentAction("app-1");
    expect(res.success).toBe(false);
    // The block is the second-parent gate, NOT the submitted gate.
    if (!res.success) expect(res.error).not.toBe(NOT_SUBMITTED_GATE_MESSAGE);
    expect(createAssessmentMock).not.toHaveBeenCalled();
  });

  it("preserves the second-parent gate: SUBMITTED form + SUBMITTED secondary proceeds", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED", assessment: null });
    secondaryContributor = { status: "SUBMITTED" };
    const res = await beginAssessmentAction("app-1");
    expect(res).toEqual({ success: true, assessmentId: "asmt-new" });
    expect(createAssessmentMock).toHaveBeenCalledTimes(1);
  });
});

describe("proceedWithoutSecondParentAction — submitted gate (B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secondaryContributor = { status: "INVITED" };
  });

  it("BLOCKS override on a draft (IN_PROGRESS) form and creates no assessment row", async () => {
    fakeTx = makeFakeTx({ formStatus: "IN_PROGRESS", assessment: null });
    const res = await proceedWithoutSecondParentAction("app-1", "no response");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe(NOT_SUBMITTED_GATE_MESSAGE);
    expect(createAssessmentMock).not.toHaveBeenCalled();
  });

  it("ALLOWS override on a SUBMITTED form with an unsubmitted secondary", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED", assessment: null });
    secondaryContributor = { status: "INVITED" };
    const res = await proceedWithoutSecondParentAction("app-1", "no response");
    expect(res).toEqual({ success: true, assessmentId: "asmt-new" });
    expect(createAssessmentMock).toHaveBeenCalledTimes(1);
  });
});
