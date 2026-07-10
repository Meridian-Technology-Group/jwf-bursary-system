/**
 * Round database queries.
 *
 * All functions return plain objects (not Prisma model instances) so they are
 * safe to pass from Server Components to Client Components via props.
 */

import type { Tx } from "@/lib/db/prisma";
import { RoundStatus, type Round } from "@prisma/client";
import {
  deriveReviewPhase,
  type ReviewPhase,
} from "@/lib/applications/status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoundWithCounts {
  id: string;
  academicYear: string;
  openDate: Date;
  closeDate: Date;
  decisionDate: Date | null;
  status: RoundStatus;
  createdAt: Date;
  counts: {
    preSubmission: number;
    submitted: number;
    inProgress: number;
    complete: number;
    total: number;
  };
  /**
   * Decided-outcome split for the round (computed the same way as `getRound`).
   * Lets the Season Ledger show qualification % without a richer per-round
   * fetch. Non-breaking additive field.
   */
  statusBreakdown: {
    qualifies: number;
    doesNotQualify: number;
  };
}

export interface RoundDetail extends RoundWithCounts {
  schoolBreakdown: Array<{
    school: string;
    count: number;
  }>;
}

// ---------------------------------------------------------------------------
// listRounds
// ---------------------------------------------------------------------------

/**
 * Returns all rounds ordered by academic year descending, with application
 * counts broken down by status bucket.
 */
export async function listRounds(tx: Tx): Promise<RoundWithCounts[]> {
  const rounds = await tx.round.findMany({
    orderBy: { academicYear: "desc" },
    include: {
      applications: {
        select: {
          formStatus: true,
          closedAt: true,
          assessment: { select: { status: true, outcome: true } },
        },
      },
    },
  });

  return rounds.map((round) => {
    const phases = round.applications.map(reviewPhaseFor);
    const counts = buildCounts(phases);
    const statusBreakdown = buildStatusBreakdown(phases);
    const { applications: _apps, ...rest } = round;
    return { ...rest, counts, statusBreakdown };
  });
}

// ---------------------------------------------------------------------------
// getRound
// ---------------------------------------------------------------------------

/**
 * Returns a single round with full details and application counts.
 * Returns null when the round is not found.
 */
export async function getRound(tx: Tx, id: string): Promise<RoundDetail | null> {
  const round = await tx.round.findUnique({
    where: { id },
    include: {
      applications: {
        select: {
          formStatus: true,
          closedAt: true,
          school: true,
          assessment: { select: { status: true, outcome: true } },
        },
      },
    },
  });

  if (!round) return null;

  const phases = round.applications.map(reviewPhaseFor);
  const counts = buildCounts(phases);

  // School breakdown
  const schoolMap = new Map<string, number>();
  for (const app of round.applications) {
    schoolMap.set(app.school, (schoolMap.get(app.school) ?? 0) + 1);
  }
  const schoolBreakdown = Array.from(schoolMap.entries()).map(
    ([school, count]) => ({ school, count })
  );

  const statusBreakdown = buildStatusBreakdown(phases);

  const { applications: _apps, ...rest } = round;
  return { ...rest, counts, schoolBreakdown, statusBreakdown };
}

// ---------------------------------------------------------------------------
// createRound
// ---------------------------------------------------------------------------

/**
 * Creates a new assessment round with status DRAFT.
 */
export async function createRound(
  tx: Tx,
  data: {
    academicYear: string;
    openDate: Date;
    closeDate: Date;
    decisionDate?: Date;
  }
): Promise<Round> {
  return tx.round.create({
    data: {
      academicYear: data.academicYear,
      openDate: data.openDate,
      closeDate: data.closeDate,
      decisionDate: data.decisionDate ?? null,
      status: RoundStatus.DRAFT,
    },
  });
}

// ---------------------------------------------------------------------------
// updateRound
// ---------------------------------------------------------------------------

/**
 * Updates mutable fields on a round record.
 */
export async function updateRound(
  tx: Tx,
  id: string,
  data: Partial<
    Pick<Round, "academicYear" | "openDate" | "closeDate" | "decisionDate" | "status">
  >
): Promise<Round> {
  return tx.round.update({
    where: { id },
    data,
  });
}

// ---------------------------------------------------------------------------
// closeRound
// ---------------------------------------------------------------------------

/**
 * Sets a round's status to CLOSED.
 */
export async function closeRound(tx: Tx, id: string): Promise<Round> {
  return tx.round.update({
    where: { id },
    data: { status: RoundStatus.CLOSED },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Projects an application's lifecycle columns onto the 7-value review phase
 * (Epic 01 PR-6a) — the single mapping `buildCounts` / `buildStatusBreakdown`
 * bucket on, replacing the deprecated fused applications.status.
 */
function reviewPhaseFor(app: {
  formStatus: import("@prisma/client").ApplicationFormStatus;
  closedAt: Date | null;
  assessment: {
    status: import("@prisma/client").AssessmentStatus;
    outcome: import("@prisma/client").AssessmentOutcome | null;
  } | null;
}): ReviewPhase {
  return deriveReviewPhase({
    formStatus: app.formStatus,
    assessmentStatus: app.assessment?.status ?? null,
    outcome: app.assessment?.outcome ?? null,
    closedAt: app.closedAt,
  });
}

function buildCounts(phases: ReviewPhase[]) {
  // The review-phase vocabulary preserves the old fused-enum bucketing exactly:
  //   inProgress = NOT_STARTED (review in progress) + PAUSED
  //   complete   = COMPLETED + QUALIFIES + DOES_NOT_QUALIFY (decided)
  const IN_PROGRESS: ReviewPhase[] = ["NOT_STARTED", "PAUSED"];
  const COMPLETE: ReviewPhase[] = ["COMPLETED", "QUALIFIES", "DOES_NOT_QUALIFY"];

  return {
    preSubmission: phases.filter((p) => p === "PRE_SUBMISSION").length,
    submitted: phases.filter((p) => p === "SUBMITTED").length,
    inProgress: phases.filter((p) => IN_PROGRESS.includes(p)).length,
    complete: phases.filter((p) => COMPLETE.includes(p)).length,
    total: phases.length,
  };
}

function buildStatusBreakdown(phases: ReviewPhase[]) {
  return {
    qualifies: phases.filter((p) => p === "QUALIFIES").length,
    doesNotQualify: phases.filter((p) => p === "DOES_NOT_QUALIFY").length,
  };
}
