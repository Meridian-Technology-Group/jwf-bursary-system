/**
 * CALC-09 (D4) — reason-code picker options for the recommendation form.
 *
 * `getReasonCodes` only returns active (non-deprecated) codes so a NEW
 * selection can never pick a retired one. But a recommendation saved before
 * a code was deprecated may still link to it, and the assessor re-opening
 * that recommendation should still see which reason was recorded, not a
 * silently-missing checkbox. This merges the active list with any codes
 * already linked to the recommendation being viewed, so historic selections
 * keep rendering their label.
 */

export interface ReasonCodeOptionLike {
  id: string;
  code: number;
  label: string;
}

/**
 * Returns `activeCodes` plus any code from `linkedCodes` not already present
 * (by id) in `activeCodes` — i.e. codes deprecated after this recommendation
 * last saved. Order: active codes first (in their given order), then the
 * historic/deprecated ones.
 */
export function mergeHistoricReasonCodeOptions<T extends ReasonCodeOptionLike>(
  activeCodes: readonly T[],
  linkedCodes: readonly T[]
): T[] {
  const activeIds = new Set(activeCodes.map((rc) => rc.id));
  const historicOnly = linkedCodes.filter((rc) => !activeIds.has(rc.id));
  return [...activeCodes, ...historicOnly];
}
