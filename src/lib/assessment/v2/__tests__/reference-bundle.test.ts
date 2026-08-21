import { describe, it, expect } from 'vitest'
import { resolveReferenceBundle, type ReferenceBundleRowsLike } from '../reference-bundle'
import {
  notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
} from '../../../../../prisma/seed-data/profiling-reference'

const fullRows: ReferenceBundleRowsLike = {
  notionalCosts: notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
}

const emptyRows: ReferenceBundleRowsLike = {
  notionalCosts: [],
  familyCategoryMetas: [],
  affordabilityBands: [],
  incomeCategoryBands: [],
  propertyEquityBands: [],
  financialEquityBands: [],
  debtRatioBands: [],
  lifestyleSqueezeBands: [],
}

describe('resolveReferenceBundle', () => {
  it('is complete with no missing tables when every table has rows', () => {
    const res = resolveReferenceBundle(fullRows)
    expect(res.isComplete).toBe(true)
    expect(res.missingTables).toEqual([])
    expect(res.bundle.notionalCosts).toBe(notionalCostConfigs)
    expect(res.bundle.affordabilityBands).toBe(affordabilityBands)
  })

  it('reports every empty table by human-readable name (fail-soft on an unseeded env)', () => {
    const res = resolveReferenceBundle(emptyRows)
    expect(res.isComplete).toBe(false)
    expect(res.missingTables).toHaveLength(8)
    expect(res.missingTables).toContain('Notional cost config')
    expect(res.missingTables).toContain('Affordability grid')
    expect(res.missingTables).toContain('Lifestyle squeeze bands')
  })

  it('reports only the tables that are actually empty', () => {
    const res = resolveReferenceBundle({ ...fullRows, debtRatioBands: [] })
    expect(res.isComplete).toBe(false)
    expect(res.missingTables).toEqual(['Debt ratio bands'])
  })
})
