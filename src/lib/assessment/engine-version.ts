/**
 * CALC-07 — engine-version dispatch.
 *
 * A single pure predicate every call site branches on (the assessment page, the
 * form, the save path) so v1 assessments keep the OLD engine/form/save path and
 * only `calculationVersion: 2` assessments get the full notional model. Kept
 * tiny and DB-free so the dispatch rule is unit-tested directly.
 */

export type AssessmentEngineVersion = 'v1' | 'v2'

/**
 * Chooses the engine for an assessment from its `calculationVersion` stamp
 * (CALC-02). Only an explicit `2` selects v2; everything else (1, null,
 * undefined — pre-CALC-02 rows) stays on v1.
 */
export function selectEngineVersion(
  calculationVersion: number | null | undefined,
): AssessmentEngineVersion {
  return calculationVersion === 2 ? 'v2' : 'v1'
}
