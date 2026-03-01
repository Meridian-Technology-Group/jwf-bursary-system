/**
 * Round database queries.
 *
 * All functions return plain objects (not Prisma model instances) so they are
 * safe to pass from Server Components to Client Components via props.
 */

import { prisma } from "@/lib/db/prisma";
import { RoundStatus, ApplicationStatus, type Round } from "@prisma/client";

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
}

export interface RoundDetail extends RoundWithCounts {
  schoolBreakdown: Array<{
    school: string;
    count: number;
  }>;
  statusBreakdown: {
    qualifies: number;
    doesNotQualify: number;
  };
}

// ---------------------------------------------------------------------------
// listRounds
// ---------------------------------------------------------------------------

/**
 * Returns all rounds ordered by academic year descending, with application
 * counts broken down by status bucket.
 */
export async function listRounds(): Promise<RoundWithCounts[]> {
  const rounds = await prisma.round.findMany({
    orderBy: { academicYear: "desc" },
    include: {
      applications: {
        select: { status: true },
      },
    },
  });

  return rounds.map((round) => {
    const counts = buildCounts(round.applications.map((a) => a.status));
    const { applications: _apps, ...rest } = round;
    return { ...rest, counts };
  });
}

// ---------------------------------------------------------------------------
// getRound
// ---------------------------------------------------------------------------

/**
 * Returns a single round with full details and application counts.
 * Returns null when the round is not found.
 */
export async function getRound(id: string): Promise<RoundDetail | null> {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      applications: {
        select: { status: true, school: true },
      },
    },
  });

  if (!round) return null;

  const statuses = round.applications.map((a) => a.status);
  const counts = buildCounts(statuses);

  // School breakdown
  const schoolMap = new Map<string, number>();
  for (const app of round.applications) {
    schoolMap.set(app.school, (schoolMap.get(app.school) ?? 0) + 1);
  }
  const schoolBreakdown = Array.from(schoolMap.entries()).map(
    ([school, count]) => ({ school, count })
  );

  const statusBreakdown = {
    qualifies: statuses.filter((s) => s === ApplicationStatus.QUALIFIES).length,
    doesNotQualify: statuses.filter(
      (s) => s === ApplicationStatus.DOES_NOT_QUALIFY
    ).length,
  };

  const { applications: _apps, ...rest } = round;
  return { ...rest, counts, schoolBreakdown, statusBreakdown };
}

// ---------------------------------------------------------------------------
// createRound
// ---------------------------------------------------------------------------

/**
 * Creates a new assessment round with status DRAFT.
 */
export async function createRound(data: {
  academicYear: string;
  openDate: Date;
  closeDate: Date;
  decisionDate?: Date;
}): Promise<Round> {
  return prisma.round.create({
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
  id: string,
  data: Partial<
    Pick<Round, "academicYear" | "openDate" | "closeDate" | "decisionDate" | "status">
  >
): Promise<Round> {
  return prisma.round.update({
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
export async function closeRound(id: string): Promise<Round> {
  return prisma.round.update({
    where: { id },
    data: { status: RoundStatus.CLOSED },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildCounts(statuses: ApplicationStatus[]) {
  const IN_PROGRESS_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.NOT_STARTED,
    ApplicationStatus.PAUSED,
  ];
  const COMPLETE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.COMPLETED,
    ApplicationStatus.QUALIFIES,
    ApplicationStatus.DOES_NOT_QUALIFY,
  ];

  return {
    preSubmission: statuses.filter(
      (s) => s === ApplicationStatus.PRE_SUBMISSION
    ).length,
    submitted: statuses.filter((s) => s === ApplicationStatus.SUBMITTED).length,
    inProgress: statuses.filter((s) => IN_PROGRESS_STATUSES.includes(s)).length,
    complete: statuses.filter((s) => COMPLETE_STATUSES.includes(s)).length,
    total: statuses.length,
  };
}
