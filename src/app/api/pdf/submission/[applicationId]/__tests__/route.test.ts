import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/pdf/submission/[applicationId] — the ONE-TIME download route
 * (Epic 13 D1, decision D13-4).
 *
 * The point of these tests is ORDERING. Everything the route touches is mocked
 * except one thing that is modelled rather than stubbed: a fake
 * `submissionPdfDownloadedAt` column, with `claimSubmissionPdfDownload`
 * implemented over it as a real compare-and-set. That way "a failed render must
 * not consume the download" is asserted against the flag itself, not against a
 * call count — the route cannot pass by calling the claim in a try/catch or by
 * stamping optimistically and rolling back.
 *
 * `submission-loader` is mocked because it is `server-only` (unresolvable under
 * vitest) and `@react-pdf/renderer` because the renderer is the thing whose
 * failure we are simulating.
 */

// ── The fake column ───────────────────────────────────────────────────────────
const column: { downloadedAt: Date | null } = { downloadedAt: null };

const claimSubmissionPdfDownload = vi.fn(async () => {
  if (column.downloadedAt) return false;
  column.downloadedAt = new Date("2026-08-14T12:00:00.000Z");
  return true;
});

const getCurrentUser = vi.fn(async () => ({
  id: "user-1",
  role: "APPLICANT" as const,
}));

const renderToBuffer = vi.fn(async () => Buffer.from("%PDF-1.7 fake"));

vi.mock("@/lib/auth/roles", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/portal/submission-pdf-download", () => ({
  claimSubmissionPdfDownload: (...args: unknown[]) =>
    claimSubmissionPdfDownload(...(args as [])),
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: (...args: unknown[]) => renderToBuffer(...(args as [])),
}));

vi.mock("@/lib/pdf/submission-pdf", () => ({
  SubmissionPDF: () => null,
}));

vi.mock("@/lib/portal/submission-loader", () => ({
  loadSubmittedApplication: async (
    _caller: unknown,
    applicationId: string
  ) => {
    if (applicationId !== "app-1") return null;
    return {
      id: "app-1",
      reference: "TS-SMITH05-Smith, Bob",
      childName: "Bob Smith",
      school: "TRINITY",
      applicationType: "NEW",
      academicYear: "2025/2026",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
      termsAcceptedAt: new Date("2026-08-01T09:00:00.000Z"),
      termsVersion: "v1",
      // The loader reads the live column, so the route's fast path sees
      // whatever a previous request in this test left behind.
      submissionPdfDownloadedAt: column.downloadedAt,
      summary: { sections: [] },
    };
  },
}));

import { GET } from "../route";

function get(applicationId = "app-1") {
  return GET({} as never, {
    params: Promise.resolve({ applicationId }),
  });
}

beforeEach(() => {
  column.downloadedAt = null;
  claimSubmissionPdfDownload.mockClear();
  renderToBuffer.mockClear();
  getCurrentUser.mockClear();
  renderToBuffer.mockImplementation(async () => Buffer.from("%PDF-1.7 fake"));
});

describe("GET /api/pdf/submission/[applicationId] (Epic 13 D1 / D13-4)", () => {
  it("serves the PDF on the first download and stamps the column", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      "bursary-application-TS-SMITH05-Smith--Bob.pdf"
    );
    expect(await res.text()).toContain("%PDF-1.7");

    expect(column.downloadedAt).not.toBeNull();
  });

  it("returns 410 Gone on the second download, without re-rendering", async () => {
    await get();
    renderToBuffer.mockClear();

    const res = await get();

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      code: "SUBMISSION_PDF_ALREADY_DOWNLOADED",
    });
    // Fast path: a spent download costs no render.
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it("does NOT consume the download when the render fails", async () => {
    renderToBuffer.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const res = await get();

    expect(res.status).toBe(500);
    // The whole correctness of the feature: the stamp is written after the
    // render, so a broken render leaves the applicant's one download intact.
    expect(column.downloadedAt).toBeNull();
    expect(claimSubmissionPdfDownload).not.toHaveBeenCalled();

    // …and the retry then succeeds.
    const retry = await get();
    expect(retry.status).toBe(200);
    expect(column.downloadedAt).not.toBeNull();
  });

  it("withholds the bytes when the claim loses a concurrent race", async () => {
    // The flag was NULL when the loader read it (so the fast path let us
    // through) but a parallel request claimed it while we were rendering.
    claimSubmissionPdfDownload.mockImplementationOnce(async () => false);

    const res = await get();

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(410);
    expect(res.headers.get("Content-Type")).not.toBe("application/pdf");
  });

  it("claims only AFTER rendering, never before", async () => {
    await get();

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    expect(claimSubmissionPdfDownload).toHaveBeenCalledTimes(1);
    expect(
      renderToBuffer.mock.invocationCallOrder[0]
    ).toBeLessThan(claimSubmissionPdfDownload.mock.invocationCallOrder[0]);
  });

  it("401s with no session and never touches the column", async () => {
    getCurrentUser.mockResolvedValueOnce(null as never);

    const res = await get();

    expect(res.status).toBe(401);
    expect(column.downloadedAt).toBeNull();
  });

  it("404s for an application that is not the caller's submitted one", async () => {
    const res = await get("not-mine");

    expect(res.status).toBe(404);
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(column.downloadedAt).toBeNull();
  });
});
