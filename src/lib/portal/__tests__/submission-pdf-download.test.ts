import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `claimSubmissionPdfDownload` — the compare-and-set behind the ONE-TIME
 * submission PDF (Epic 13 D1, decision D13-4).
 *
 * `@/lib/db/prisma` is mocked with a fake `withUserContext` handing out a tx
 * whose `application.updateMany` MODELS POSTGRES rather than recording calls:
 * a single in-memory row, a mutex that serialises statements (the row lock),
 * and a re-evaluation of the WHERE clause after the lock is acquired (READ
 * COMMITTED's EvalPlanQual re-check). That is what makes the race test
 * meaningful — under this fake, a claim written as a blind write, or one that
 * checked the flag before locking, would let both callers win.
 */

interface FakeRow {
  id: string;
  leadApplicantId: string;
  submissionPdfDownloadedAt: Date | null;
}

const db: { row: FakeRow } = {
  row: {
    id: "app-1",
    leadApplicantId: "user-1",
    submissionPdfDownloadedAt: null,
  },
};

/** Serialises updateMany bodies, so concurrent claims cannot interleave. */
let lock: Promise<unknown> = Promise.resolve();

const updateManySpy = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  withUserContext: async (
    _userId: string,
    _role: string,
    fn: (tx: unknown) => Promise<unknown>
  ) =>
    fn({
      application: {
        updateMany: (args: {
          where: Record<string, unknown>;
          data: { submissionPdfDownloadedAt: Date };
        }) => {
          updateManySpy(args);
          const run = lock.then(async () => {
            // Yield, so a naive implementation that read-then-wrote outside
            // this critical section would be caught by the second caller.
            await Promise.resolve();
            const r = db.row;
            const matches =
              args.where.id === r.id &&
              (args.where.leadApplicantId === undefined ||
                args.where.leadApplicantId === r.leadApplicantId) &&
              // The guard, re-evaluated against the committed row.
              (!("submissionPdfDownloadedAt" in args.where) ||
                (args.where.submissionPdfDownloadedAt === null &&
                  r.submissionPdfDownloadedAt === null));
            if (!matches) return { count: 0 };
            r.submissionPdfDownloadedAt = args.data.submissionPdfDownloadedAt;
            return { count: 1 };
          });
          lock = run.catch(() => undefined);
          return run;
        },
      },
    }),
}));

import { claimSubmissionPdfDownload } from "../submission-pdf-download";

const caller = { id: "user-1", role: "APPLICANT" as const };

beforeEach(() => {
  db.row = {
    id: "app-1",
    leadApplicantId: "user-1",
    submissionPdfDownloadedAt: null,
  };
  lock = Promise.resolve();
  updateManySpy.mockClear();
});

describe("claimSubmissionPdfDownload (Epic 13 D1 / D13-4)", () => {
  it("claims an unspent download and stamps the column", async () => {
    const now = new Date("2026-08-14T10:00:00.000Z");

    await expect(
      claimSubmissionPdfDownload(caller, "app-1", now)
    ).resolves.toBe(true);

    expect(db.row.submissionPdfDownloadedAt).toEqual(now);
  });

  it("refuses a second claim and leaves the ORIGINAL stamp intact", async () => {
    const first = new Date("2026-08-14T10:00:00.000Z");
    const second = new Date("2026-08-14T11:00:00.000Z");

    await claimSubmissionPdfDownload(caller, "app-1", first);

    await expect(
      claimSubmissionPdfDownload(caller, "app-1", second)
    ).resolves.toBe(false);

    // Not merely "returns false": the first download's timestamp is the record
    // of when the one download happened and must not be overwritten.
    expect(db.row.submissionPdfDownloadedAt).toEqual(first);
  });

  it("carries the null guard AND the ownership check in its WHERE", async () => {
    await claimSubmissionPdfDownload(caller, "app-1");

    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy.mock.calls[0][0].where).toMatchObject({
      id: "app-1",
      leadApplicantId: "user-1",
      submissionPdfDownloadedAt: null,
    });
  });

  it("cannot claim another applicant's download", async () => {
    await expect(
      claimSubmissionPdfDownload(
        { id: "someone-else", role: "APPLICANT" },
        "app-1"
      )
    ).resolves.toBe(false);

    expect(db.row.submissionPdfDownloadedAt).toBeNull();
  });

  it("resolves a concurrent double-click to EXACTLY ONE winner", async () => {
    const results = await Promise.all([
      claimSubmissionPdfDownload(caller, "app-1"),
      claimSubmissionPdfDownload(caller, "app-1"),
      claimSubmissionPdfDownload(caller, "app-1"),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(db.row.submissionPdfDownloadedAt).not.toBeNull();
  });
});
