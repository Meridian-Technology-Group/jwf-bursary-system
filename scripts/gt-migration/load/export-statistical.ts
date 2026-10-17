/**
 * `mig export-statistical` (Epic 23 T5, her 16 Oct decision 2): the pre-live
 * spreadsheet of the migrated accounts — Export Section 3 (statistical), every
 * column, built by the app's own Section 3 select, row mapping, column
 * registry and XLSX builder, so it is exactly what /exports will download.
 *
 * Read-only. Writes the file to ../data/migration/exports/ (0600, never
 * committed) and prints the debt-status counts she asked about (15 Oct: how
 * many read "IN A DEBT SPIRAL…", and how many of those declared no debt).
 * Password protection is a separate step (ExcelJS cannot encrypt).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { STATISTICAL_COLUMNS } from '../../../src/lib/export/sections/statistical-columns'
import { STATISTICAL_SELECT, mapStatisticalRow } from '../../../src/lib/export/sections/statistical'
import { buildSheetXlsx, toSheetColumns } from '../../../src/lib/export/build'
import { totalPersonalDebt } from '../../../src/lib/assessment/v2/debt'
import type { DebtsRecord } from '../../../src/types/assessment-v2'
import { DATA_DIR } from '../config'
import { ROUND_ACADEMIC_YEAR, type LoadContext } from './context'

export async function exportStatistical(ctx: LoadContext, opts: { out?: string } = {}) {
  const where = {
    application: { migrationSource: { not: null }, round: { academicYear: ROUND_ACADEMIC_YEAR } },
  }
  const assessments = await ctx.prisma.assessment.findMany({
    where,
    select: { ...STATISTICAL_SELECT, property: { select: { schoolAgeChildrenCount: true, debts: true } } },
    orderBy: [{ application: { reference: 'asc' } }, { id: 'asc' }],
  })
  // Postcode areas so the sheet shows SW19-WIMBLEDON, as /exports does (17 Oct 2026).
  const areas = await ctx.prisma.postcodeArea.findMany({ select: { district: true, area: true } })
  const rows = assessments.map((a) => mapStatisticalRow(a, areas))

  const date = new Date().toISOString().slice(0, 10)
  const dir = resolve(DATA_DIR, 'exports')
  mkdirSync(dir, { recursive: true })
  const file = opts.out ?? resolve(dir, `${date}-statistical-${rows.length}.xlsx`)
  const buffer = await buildSheetXlsx(toSheetColumns(STATISTICAL_COLUMNS), rows, 'Statistical')
  writeFileSync(file, buffer, { mode: 0o600 })

  const byStatus = new Map<string, { n: number; noDebt: number }>()
  for (const a of assessments) {
    const label = a.debtStatusLabel ?? '(none)'
    const debt = totalPersonalDebt((a.property?.debts ?? {}) as DebtsRecord)
    const e = byStatus.get(label) ?? { n: 0, noDebt: 0 }
    e.n += 1
    if (debt === 0) e.noDebt += 1
    byStatus.set(label, e)
  }
  console.log(
    `export-statistical | target: ${ctx.config.env} (${ctx.config.projectRef}) | ${ROUND_ACADEMIC_YEAR} migrated assessments: ${rows.length}` +
      ` | columns: ${STATISTICAL_COLUMNS.length}`,
  )
  console.log('debt status (count | of which no declared debt):')
  for (const [label, e] of Array.from(byStatus.entries()).sort((x, y) => y[1].n - x[1].n)) {
    console.log(`  ${e.n} | ${e.noDebt}  ${label}`)
  }
  console.log(`file: ${file}`)
  return { file, rows: rows.length }
}
