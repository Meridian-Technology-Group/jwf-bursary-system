/**
 * `mig patch-labels` (Charlotte, 17 Oct 2026): brings the stored debt-status and
 * lifestyle-squeeze labels of a loaded run in line with a fresh `mig calc`, after
 * a reference-table change (her debt shortfall split by the sign of NDI, and the
 * no-debt lifestyle "n/a" rows). Labels are display only: no figure moves.
 *
 * - Reads `canonical/<hash>/calc-<env>.json` (run `mig calc --env <e>` first).
 * - Refuses if any stored FIGURE differs from the calc (NDI after notional
 *   spend, household net income, yearly repayments, debt-over-NDI ratio): then
 *   the run and the calc disagree on more than labels, and a label-only patch
 *   would be wrong.
 * - Raw SQL, so no Prisma `@updatedAt` moves (rollback's `assertUntouched` still
 *   sees the rows as the load left them). Each change is guarded on the old
 *   value and logged to `runs/<id>/patch-labels.jsonl` (old + new, fsynced);
 *   `--undo` writes the old values back where the new ones are still there.
 */
import { resolve } from 'node:path'
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs'
import { latestCanonical } from '../calc/run'
import { runDir } from './phases'
import type { LoadContext } from './context'

export const LABEL_COLUMNS = { debtStatusLabel: 'debt_status_label', lifestyleSqueezeLabel: 'lifestyle_squeeze_label' } as const
export type LabelKey = keyof typeof LABEL_COLUMNS

export interface LabelLine {
  op: 'set' | 'undo'
  runId: string
  accountKey: string
  assessmentId: string
  column: (typeof LABEL_COLUMNS)[LabelKey]
  from: string | null
  to: string | null
  at: string
}

export interface StoredRow {
  accountKey: string
  assessmentId: string
  debtStatusLabel: string | null
  lifestyleSqueezeLabel: string | null
  ndi: number | null
  netIncome: number | null
  repayments: number | null
  ratio: number | null
}

export interface CalcOut {
  debtStatusLabel: string | null
  lifestyleSqueezeLabel: string | null
  ndiAfterNotionalSpend: number | null
  householdNetIncome: number | null
  derivedYearlyDebtRepayments: number | null
  debtOverNdiRatio: number | null
}

const r2 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100)
const r4 = (v: number | null | undefined) => (v == null ? 0 : Math.round(v * 10_000) / 10_000)

/** The figures that must already agree for a label-only patch to be right. */
export function figureMismatches(db: StoredRow, calc: CalcOut): string[] {
  const out: string[] = []
  if (r2(db.ndi) !== r2(calc.ndiAfterNotionalSpend)) out.push('ndiAfterNotionalSpend')
  if (r2(db.netIncome) !== r2(calc.householdNetIncome)) out.push('householdNetIncome')
  if (r2(db.repayments) !== r2(calc.derivedYearlyDebtRepayments)) out.push('derivedYearlyDebtRepayments')
  if (r4(db.ratio) !== r4(calc.debtOverNdiRatio)) out.push('debtOverNdiRatio')
  return out
}

/** The label cells that differ between the stored row and the calc. */
export function labelChanges(db: StoredRow, calc: CalcOut): { key: LabelKey; from: string | null; to: string | null }[] {
  return (Object.keys(LABEL_COLUMNS) as LabelKey[])
    .filter((k) => (db[k] ?? null) !== (calc[k] ?? null))
    .map((k) => ({ key: k, from: db[k] ?? null, to: calc[k] ?? null }))
}

/** The set lines no later undo reversed. */
export function liveLabelSets(lines: readonly LabelLine[]): LabelLine[] {
  const live = new Map<string, LabelLine>()
  for (const l of lines) {
    const k = `${l.assessmentId}:${l.column}`
    if (l.op === 'set') live.set(k, l)
    else live.delete(k)
  }
  return Array.from(live.values())
}

function appendLines(path: string, lines: readonly LabelLine[]) {
  if (!lines.length) return
  const fd = openSync(path, 'a')
  try {
    writeSync(fd, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

function readLines(path: string): LabelLine[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LabelLine)
}

export async function patchLabels(ctx: LoadContext, opts: { runId: string; dryRun?: boolean; undo?: boolean }) {
  const logPath = resolve(runDir(opts.runId), 'patch-labels.jsonl')
  const tag = `patch-labels ${opts.undo ? 'UNDO ' : ''}${opts.dryRun ? 'DRY RUN ' : ''}| target: ${ctx.config.env} (${ctx.config.projectRef}) | run: ${opts.runId}`

  if (opts.undo) {
    const lines = liveLabelSets(readLines(logPath))
    console.log(`${tag} | cells: ${lines.length}`)
    if (opts.dryRun) return { PLANNED: lines.length }
    let reverted = 0
    for (const l of lines) {
      const n = await ctx.prisma.$executeRawUnsafe(
        `UPDATE assessments SET ${l.column} = $1 WHERE id = $2::uuid AND ${l.column} IS NOT DISTINCT FROM $3`,
        l.from,
        l.assessmentId,
        l.to,
      )
      if (n) {
        reverted += n
        appendLines(logPath, [{ ...l, op: 'undo', at: new Date().toISOString() }])
      }
    }
    console.log(`result: reverted ${reverted} | left (changed since): ${lines.length - reverted}`)
    return { REVERTED: reverted }
  }

  const { hash, dir } = latestCanonical()
  const calcFile = resolve(dir, `calc-${ctx.config.env}.json`)
  if (!existsSync(calcFile)) throw new Error(`No ${calcFile}: run mig calc --env ${ctx.config.env} first.`)
  const calc = new Map<string, CalcOut>()
  for (const r of JSON.parse(readFileSync(calcFile, 'utf8')).rows as { key: string; status: string; out?: CalcOut }[]) {
    if (r.status === 'CALCULATED' && r.out) calc.set(r.key, r.out)
  }

  const rows = await ctx.prisma.$queryRawUnsafe<
    { account_key: string; id: string; dsl: string | null; lsl: string | null; ndi: string | null; hni: string | null; rep: string | null; ratio: string | null }[]
  >(
    `SELECT l.account_key, s.id::text, s.debt_status_label dsl, s.lifestyle_squeeze_label lsl,
            s.ndi_after_notional_spend::text ndi, s.total_household_net_income::text hni,
            s.derived_yearly_debt_repayments::text rep, s.debt_over_ndi_ratio::text ratio
       FROM data_migration_ledger l JOIN assessments s ON s.id = l.entity_id::uuid
      WHERE l.run_id = $1 AND l.state = 'done' AND l.entity_type = 'Assessment'`,
    opts.runId,
  )
  const num = (v: string | null) => (v == null ? null : Number(v))
  const stored: StoredRow[] = rows.map((r) => ({
    accountKey: r.account_key,
    assessmentId: r.id,
    debtStatusLabel: r.dsl,
    lifestyleSqueezeLabel: r.lsl,
    ndi: num(r.ndi),
    netIncome: num(r.hni),
    repayments: num(r.rep),
    ratio: num(r.ratio),
  }))

  const notCalculated = stored.filter((s) => !calc.has(s.accountKey)).length
  const mismatched = stored.filter((s) => calc.has(s.accountKey) && figureMismatches(s, calc.get(s.accountKey)!).length)
  console.log(`${tag} | canonical: ${hash} | assessments: ${stored.length} | not in calc: ${notCalculated}`)
  if (mismatched.length) {
    throw new Error(
      `Refusing: ${mismatched.length} assessment(s) differ from the calc in a figure, not just a label (first: ${mismatched[0].accountKey}). Reload instead.`,
    )
  }

  const plan = stored.flatMap((s) => {
    const c = calc.get(s.accountKey)
    return c ? labelChanges(s, c).map((ch) => ({ s, ...ch })) : []
  })
  const byColumn = plan.reduce<Record<string, number>>((m, p) => ((m[LABEL_COLUMNS[p.key]] = (m[LABEL_COLUMNS[p.key]] ?? 0) + 1), m), {})
  console.log(`label cells to change: ${plan.length} ${JSON.stringify(byColumn)}`)
  if (opts.dryRun) return { PLANNED: plan.length }

  let written = 0
  let skipped = 0
  for (const p of plan) {
    const column = LABEL_COLUMNS[p.key]
    const n = await ctx.prisma.$executeRawUnsafe(
      `UPDATE assessments SET ${column} = $1 WHERE id = $2::uuid AND ${column} IS NOT DISTINCT FROM $3`,
      p.to,
      p.s.assessmentId,
      p.from,
    )
    if (n) {
      written += n
      appendLines(logPath, [
        { op: 'set', runId: opts.runId, accountKey: p.s.accountKey, assessmentId: p.s.assessmentId, column, from: p.from, to: p.to, at: new Date().toISOString() },
      ])
    } else skipped++
  }
  console.log(`result: written ${written} | skipped (changed meanwhile): ${skipped} | log: ${logPath}`)
  return { WRITTEN: written, SKIPPED: skipped }
}
