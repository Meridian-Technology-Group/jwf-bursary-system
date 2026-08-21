/**
 * CF-25 — what the applicant is shown when submit fails, and what is recorded.
 *
 * `submitApplication` throws and the portal's submit handler renders the thrown
 * message verbatim into the form's error banner, so this action is the last
 * place the diagnostic can be stopped. Two things must both hold: the applicant
 * gets the plain message, and the real error still reaches `logError`.
 *
 * Boundary mocks follow save-section-provenance.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const APPLICANT_USER = {
  id: "parent-1",
  role: "APPLICANT",
  email: "parent@example.test",
  firstName: "Pat",
  lastName: "Parent",
  phone: null,
};

vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, getCurrentUser: async () => APPLICANT_USER };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const submitApplicationCoreMock = vi.fn();
vi.mock("@/lib/applications/submission", () => ({
  submitApplicationCore: (...args: unknown[]) =>
    submitApplicationCoreMock(...args),
}));

const logErrorMock = vi.fn();
vi.mock("@/lib/log", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
  logInfo: vi.fn(),
  hashEmail: () => "hash",
}));

const fakeTx = {
  applicationContributor: {
    findUnique: vi.fn(async () => ({ id: "contrib-1" })),
    upsert: vi.fn(async () => ({ id: "contrib-1" })),
  },
};
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

import { submitApplication } from "../actions";
import { SUBMISSION_BLOCKED_MESSAGE } from "@/lib/applications/submission-error";

/** The gap payload the submit gate throws — the blob Charlotte was shown. */
const GAP_BLOB = JSON.stringify({
  code: "GAPS_BLOCKING_SUBMISSION",
  gaps: [
    {
      id: "income-p60-missing",
      sectionType: "PARENTS_INCOME",
      label: "P60 (dated April 2025) is required",
      fieldRef: "parent1Income.employed.p60DocumentId",
    },
  ],
});

describe("submitApplication — the applicant never sees the diagnostic", () => {
  beforeEach(() => {
    submitApplicationCoreMock.mockReset();
    logErrorMock.mockReset();
  });

  it("turns the gap payload into the plain message plus the section to finish", async () => {
    submitApplicationCoreMock.mockRejectedValue(new Error(GAP_BLOB));

    await expect(submitApplication("app-1")).rejects.toThrow(
      "Your application can't be submitted yet. Please finish these sections and try again: Parents' Income."
    );
  });

  it("still logs the real error, in full, with the application it belongs to", async () => {
    const real = new Error(GAP_BLOB);
    submitApplicationCoreMock.mockRejectedValue(real);

    await expect(submitApplication("app-1")).rejects.toThrow();

    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [event, err, fields] = logErrorMock.mock.calls[0];
    expect(event).toBe("submitApplication");
    expect(err).toBe(real);
    expect((err as Error).message).toBe(GAP_BLOB);
    expect(fields).toEqual({ applicationId: "app-1" });
  });

  it("says nothing about an unexpected infrastructure failure", async () => {
    submitApplicationCoreMock.mockRejectedValue(
      new Error('relation "applications" does not exist')
    );

    await expect(submitApplication("app-1")).rejects.toThrow(
      SUBMISSION_BLOCKED_MESSAGE
    );
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
