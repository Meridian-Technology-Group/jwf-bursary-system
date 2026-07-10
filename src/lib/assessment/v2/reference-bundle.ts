/**
 * CALC-07 — pure `ReferenceBundle` resolution + completeness check.
 *
 * The DB read (`getReferenceBundleRows`, src/lib/db/queries/reference-tables.ts)
 * fetches the eight CALC-01 reference-table row sets. This module turns those
 * rows into the engine's `ReferenceBundle` and reports which tables (if any) are
 * EMPTY, so the v2 assessor page can render a clear "reference data not seeded"
 * callout instead of crashing — the expected state on nonprod until
 * `seed:reference` has been run (implementation-plan.md §CALC-07 item 2).
 *
 * Pure — no DB, no React — so the resolution/completeness logic is unit-tested
 * without a database.
 */

import type { ReferenceBundle } from './types'

/** The eight row sets the bundle is assembled from (structurally the CALC-01 fetchers' output). */
export interface ReferenceBundleRowsLike {
  notionalCosts: ReferenceBundle['notionalCosts']
  familyCategoryMetas: ReferenceBundle['familyCategoryMetas']
  affordabilityBands: ReferenceBundle['affordabilityBands']
  incomeCategoryBands: ReferenceBundle['incomeCategoryBands']
  propertyEquityBands: ReferenceBundle['propertyEquityBands']
  financialEquityBands: ReferenceBundle['financialEquityBands']
  debtRatioBands: ReferenceBundle['debtRatioBands']
  lifestyleSqueezeBands: ReferenceBundle['lifestyleSqueezeBands']
}

/** Human-readable names for each reference table, keyed by bundle field, for the callout. */
export const REFERENCE_TABLE_LABELS: Record<keyof ReferenceBundleRowsLike, string> = {
  notionalCosts: 'Notional cost config',
  familyCategoryMetas: 'Family category metadata',
  affordabilityBands: 'Affordability grid',
  incomeCategoryBands: 'Income category bands',
  propertyEquityBands: 'Property equity bands',
  financialEquityBands: 'Financial equity bands',
  debtRatioBands: 'Debt ratio bands',
  lifestyleSqueezeBands: 'Lifestyle squeeze bands',
}

export interface ResolvedReferenceBundle {
  /** The assembled bundle (usable even when incomplete — callers gate on `isComplete`). */
  bundle: ReferenceBundle
  /** Human-readable names of every reference table that is EMPTY. */
  missingTables: string[]
  /** True when every reference table has at least one row. */
  isComplete: boolean
}

/**
 * Assembles the `ReferenceBundle` from fetched rows and flags any empty table.
 * A table with zero rows means seed data has not been loaded for it — the v2
 * engine cannot resolve bands/costs, so the page must block with a callout.
 */
export function resolveReferenceBundle(rows: ReferenceBundleRowsLike): ResolvedReferenceBundle {
  const bundle: ReferenceBundle = {
    notionalCosts: rows.notionalCosts,
    familyCategoryMetas: rows.familyCategoryMetas,
    affordabilityBands: rows.affordabilityBands,
    incomeCategoryBands: rows.incomeCategoryBands,
    propertyEquityBands: rows.propertyEquityBands,
    financialEquityBands: rows.financialEquityBands,
    debtRatioBands: rows.debtRatioBands,
    lifestyleSqueezeBands: rows.lifestyleSqueezeBands,
  }

  const missingTables: string[] = []
  ;(Object.keys(REFERENCE_TABLE_LABELS) as (keyof ReferenceBundleRowsLike)[]).forEach((key) => {
    if (rows[key].length === 0) missingTables.push(REFERENCE_TABLE_LABELS[key])
  })

  return { bundle, missingTables, isComplete: missingTables.length === 0 }
}
