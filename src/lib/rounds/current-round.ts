/**
 * Which OPEN round is the "current" one when several are open at once.
 *
 * The Foundation runs overlapping intakes (Epic 03): the next academic year's
 * round is opened in November so winter new applicants can be invited, while
 * the current year's round is still live. The current round is the one that
 * has been running longest — the EARLIEST-opened OPEN round. Every later OPEN
 * round is a future round. When the current round is closed, the next one
 * becomes current automatically.
 *
 * Earlier behaviour picked the most-recently-opened round, so opening 2027/28
 * (Nov 2026) displaced 2026/27 as "current" on the dashboard, the reports
 * default, the Current Round shortcut and the Rounds page hero.
 */

export interface OpenRoundLike {
  status: string;
  openDate: Date;
  academicYear: string;
}

function compareByOpenDateAsc(a: OpenRoundLike, b: OpenRoundLike): number {
  const diff = a.openDate.getTime() - b.openDate.getTime();
  if (diff !== 0) return diff;
  // Same open date: the earlier academic year is the current one.
  return a.academicYear.localeCompare(b.academicYear);
}

/**
 * Splits the OPEN rounds in `rounds` into the current one and the future ones
 * (soonest first). Non-OPEN rounds are ignored.
 */
export function splitOpenRounds<T extends OpenRoundLike>(
  rounds: readonly T[]
): { current: T | null; future: T[] } {
  const open = rounds
    .filter((r) => r.status === "OPEN")
    .sort(compareByOpenDateAsc);
  return { current: open[0] ?? null, future: open.slice(1) };
}
