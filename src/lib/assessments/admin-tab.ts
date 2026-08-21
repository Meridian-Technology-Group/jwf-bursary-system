/**
 * admin-tab.ts — Epic 14 C8 (CG-24): pure helpers for the ASSESSMENT ADMIN
 * tab's year-on-year history table.
 *
 * System years derive from prior COMPLETED assessments' snapshots (the
 * CALC-10 `YoyFinancialsTableRow` read — no new write path). Pre-system
 * years (families that predate the system, LA-7) are manual rows stored in
 * `BursaryAccount.preSystemHistory`. This module merges the two into the
 * workbook's single table, recomputing the change columns as simple deltas
 * across the WHOLE sequence — including the seam between a manual last
 * pre-system year and the first system year. Presentation arithmetic only
 * (the same `current − previous` the CALC-10 lib already defines); never a
 * calculation input (D14-4).
 */

import type { YoyFinancialsTableRow } from '@/lib/assessment/yoy-financials'

/** One manual pre-system history row (LA-7). All value fields optional. */
export interface PreSystemHistoryRow {
  /** e.g. "2023/24" — the row's identity + sort key. */
  academicYear: string
  netIncome?: number | null
  savings?: number | null
  propertyEquity?: number | null
  debtExposure?: number | null
  livingArrangement?: string | null
  lifestyleSqueeze?: string | null
}

/** A unified display row of the workbook's YoY history table. */
export interface YoyHistoryDisplayRow {
  academicYear: string
  source: 'MANUAL' | 'SYSTEM'
  netIncome: number | null
  savings: number | null
  propertyEquity: number | null
  debtExposure: number | null
  deltaNetIncome: number | null
  deltaSavings: number | null
  deltaPropertyEquity: number | null
  deltaDebtExposure: number | null
  livingArrangement: string | null
  lifestyleSqueeze: string | null
}

function n(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null
  return current - previous
}

/** Defensive parse of the stored `preSystemHistory` JSONB. */
export function parsePreSystemHistory(raw: unknown): PreSystemHistoryRow[] {
  if (!Array.isArray(raw)) return []
  const rows: PreSystemHistoryRow[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    if (typeof r.academicYear !== 'string' || !r.academicYear.trim()) continue
    rows.push({
      academicYear: r.academicYear,
      netIncome: n(r.netIncome),
      savings: n(r.savings),
      propertyEquity: n(r.propertyEquity),
      debtExposure: n(r.debtExposure),
      livingArrangement:
        typeof r.livingArrangement === 'string' && r.livingArrangement.trim()
          ? r.livingArrangement
          : null,
      lifestyleSqueeze:
        typeof r.lifestyleSqueeze === 'string' && r.lifestyleSqueeze.trim()
          ? r.lifestyleSqueeze
          : null,
    })
  }
  return rows
}

/**
 * Merge manual pre-system rows with the system rows (oldest first) and
 * recompute every change column across the full sequence. Rows sort by
 * academic year string ("2023/24" sorts correctly lexicographically);
 * a duplicate academic year prefers the SYSTEM row (the snapshot is the
 * record once the system assessed that year).
 */
export function mergeYoyHistory(
  preSystem: readonly PreSystemHistoryRow[],
  systemRows: readonly YoyFinancialsTableRow[],
): YoyHistoryDisplayRow[] {
  const systemYears = new Set(systemRows.map((r) => r.academicYear))

  const manual: YoyHistoryDisplayRow[] = preSystem
    .filter((r) => !systemYears.has(r.academicYear))
    .map((r) => ({
      academicYear: r.academicYear,
      source: 'MANUAL' as const,
      netIncome: r.netIncome ?? null,
      savings: r.savings ?? null,
      propertyEquity: r.propertyEquity ?? null,
      debtExposure: r.debtExposure ?? null,
      deltaNetIncome: null,
      deltaSavings: null,
      deltaPropertyEquity: null,
      deltaDebtExposure: null,
      livingArrangement: r.livingArrangement ?? null,
      lifestyleSqueeze: r.lifestyleSqueeze ?? null,
    }))

  const system: YoyHistoryDisplayRow[] = systemRows.map((r) => ({
    academicYear: r.academicYear,
    source: 'SYSTEM' as const,
    netIncome: r.totalHouseholdNetIncome,
    savings: r.totalCashSavings,
    propertyEquity: r.totalPropertyEquity,
    debtExposure: r.yearlyDebtExposure,
    deltaNetIncome: null,
    deltaSavings: null,
    deltaPropertyEquity: null,
    deltaDebtExposure: null,
    livingArrangement: null,
    lifestyleSqueeze: r.lifestyleSqueezeLabel,
  }))

  const merged = [...manual, ...system].sort((a, b) =>
    a.academicYear.localeCompare(b.academicYear),
  )

  for (let i = 0; i < merged.length; i++) {
    const prev = i > 0 ? merged[i - 1] : null
    merged[i] = {
      ...merged[i],
      deltaNetIncome: delta(merged[i].netIncome, prev?.netIncome ?? null),
      deltaSavings: delta(merged[i].savings, prev?.savings ?? null),
      deltaPropertyEquity: delta(
        merged[i].propertyEquity,
        prev?.propertyEquity ?? null,
      ),
      deltaDebtExposure: delta(merged[i].debtExposure, prev?.debtExposure ?? null),
    }
  }

  return merged
}

/**
 * Epic 15 M7 (CI-13) — the empty-table SCAFFOLD year spine. Charlotte wants
 * the history/schedule infrastructure visible "at a glance" before any data
 * exists: full headers plus one row per academic year, empty cells.
 *
 * The spine starts at the application's round year and runs the account's
 * plausible horizon (default 8 years — the Year 6 entry maximum; pass the
 * remaining-years figure when known to size it exactly).
 */
export function scaffoldAcademicYears(
  roundAcademicYear: string,
  count: number | null | undefined
): string[] {
  const m = roundAcademicYear.match(/^(\d{4})/)
  if (!m) return []
  const start = parseInt(m[1], 10)
  const n = Math.min(Math.max(count ?? 8, 1), 8)
  return Array.from({ length: n }, (_, i) => {
    const y = start + i
    return `${y}/${String((y + 1) % 100).padStart(2, '0')}`
  })
}
