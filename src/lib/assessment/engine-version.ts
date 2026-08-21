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
 * CALC-14: the single source of truth for the `calculationVersion` every NEW
 * assessment row should be stamped with. CALC-08 cut the primary
 * `beginAssessmentAction` → `createAssessment` path over to v2; this constant
 * lets every OTHER assessment-creation call site (`ensureAssessmentRow` on the
 * app-detail "Begin Review" track, and any future one) share the same default
 * instead of re-declaring the magic number `2`. Bump this — and this alone —
 * when a future engine cutover happens.
 */
export const CURRENT_CALCULATION_VERSION = 2

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
