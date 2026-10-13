/**
 * Epic 21 #2 — re-ranking gap codes from Settings.
 *
 * Ranks are a precedence list (1 = takes the full justification of the gap),
 * so saving a code at a rank another code already holds INSERTS it there and
 * moves the others down one, rather than refusing. That keeps her stated need
 * ("any new gap code going forward will need to be added on, with a gap
 * reference number and a gap ranking number", 11 Oct 2026) to a single edit.
 *
 * Only live (non-deprecated) ranked codes take part. A deprecated code, or a
 * code saved with no rank, drops out and the codes below it move up, so the
 * live ranks stay 1…n with no gaps or ties. Unranked live codes are left alone.
 */

export interface RankableGapReason {
  id: string;
  code: number;
  rank: number | null;
}

export interface RankChange {
  id: string;
  code: number;
  from: number | null;
  to: number | null;
}

/**
 * Plans the rank of every live code after `targetId` is saved at `desired`
 * (null = unranked). `live` is every non-deprecated code, the target included
 * when it is live. Returns only the rows whose rank changes.
 */
export function planGapRanks(
  live: readonly RankableGapReason[],
  target: { id: string; code: number; currentRank: number | null },
  desired: number | null
): RankChange[] {
  const others = live
    .filter((g) => g.id !== target.id && g.rank !== null)
    .sort((a, b) => (a.rank as number) - (b.rank as number) || a.code - b.code);

  const ordered: { id: string; code: number }[] = [...others];
  if (desired !== null) {
    const position = Math.min(Math.max(desired, 1), others.length + 1) - 1;
    ordered.splice(position, 0, { id: target.id, code: target.code });
  }

  const current = new Map(live.map((g) => [g.id, g.rank]));
  current.set(target.id, target.currentRank);

  const changes: RankChange[] = [];
  ordered.forEach((g, i) => {
    const from = current.get(g.id) ?? null;
    if (from !== i + 1) changes.push({ id: g.id, code: g.code, from, to: i + 1 });
  });
  if (desired === null && target.currentRank !== null) {
    changes.push({ id: target.id, code: target.code, from: target.currentRank, to: null });
  }
  return changes;
}
