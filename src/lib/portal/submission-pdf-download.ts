/**
 * One-time submission-PDF claim (Epic 13, D1 — decision D13-4).
 *
 * The submission PDF is downloadable exactly ONCE, at submission, and never
 * again. `Application.submissionPdfDownloadedAt` is the consumed-flag; this
 * module owns the only write to it.
 *
 * Two properties matter, and both live here rather than in the route so they
 * can be tested directly:
 *
 *  1. **Conditional.** The update carries `submissionPdfDownloadedAt: null` in
 *     its WHERE, so it is a compare-and-set, not a blind write. `updateMany`
 *     (not `update`) is deliberate: it reports how many rows actually matched
 *     instead of throwing, and "0 matched" is the answer we need — someone else
 *     already spent the download.
 *
 *     Under READ COMMITTED (Prisma's default) two concurrent claims serialise
 *     on the row lock; the loser re-evaluates the guard against the winner's
 *     committed row, matches nothing, and gets `count === 0`. So N simultaneous
 *     requests yield exactly one `true` — no advisory lock, no retry loop.
 *
 *  2. **Late.** Callers must invoke this only AFTER the PDF has rendered
 *     successfully. A failed render must leave the column NULL so the applicant
 *     keeps their single download. The ordering is the route's responsibility;
 *     see `app/api/pdf/submission/[applicationId]/route.tsx`.
 *
 * Ownership is re-asserted in the WHERE (`leadApplicantId`) on top of RLS, so a
 * caller can only ever consume their own application's download. The write runs
 * under the applicant's own RLS context — the existing `applications_update`
 * policy permits `lead_applicant_id = current_user_id()`, so no service-role
 * escalation is needed.
 *
 * Deliberately NOT marked `server-only`: it is server code, but the guard would
 * make it unresolvable under vitest, and the race semantics above are exactly
 * what needs a direct unit test.
 */

import { withUserContext, type RlsRole } from "@/lib/db/prisma";

interface Caller {
  id: string;
  role: RlsRole;
}

/**
 * Atomically claims the single submission-PDF download.
 *
 * @returns `true` if this caller won the claim and the bytes may be served;
 *          `false` if the download had already been consumed (respond 410).
 */
export async function claimSubmissionPdfDownload(
  caller: Caller,
  applicationId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { count } = await withUserContext(caller.id, caller.role, (tx) =>
    tx.application.updateMany({
      where: {
        id: applicationId,
        leadApplicantId: caller.id,
        // The guard. Without it this is a blind write and every concurrent
        // request "wins".
        submissionPdfDownloadedAt: null,
      },
      data: { submissionPdfDownloadedAt: now },
    })
  );

  return count === 1;
}
