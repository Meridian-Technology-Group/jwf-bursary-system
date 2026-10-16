/**
 * `mig patch-dob` (Epic 23 T2, D-3): puts the recipient's date of birth on
 * accounts a run loaded before the plan carried it (every load before 16 Oct
 * 2026 wrote NULL). New loads get it natively from `planAll`.
 *
 * For every account the run ledgered (BursaryAccount, state done) whose GT
 * Recurring forms agree on one date (D-2), one transaction sets `child_dob`
 * on that account's Contact, BursaryAccount and migrated Application, and on
 * any Invitation for that contact/account, ONLY where it is still NULL. A
 * rerun is a no-op.
 *
 * - Raw SQL, so no Prisma `@updatedAt` moves: rollback's `assertUntouched`
 *   still sees the rows as the load left them.
 * - Not written to the DB ledger: that ledger lists rows a run CREATED and
 *   rollback deletes them. An update is logged instead to
 *   `runs/<id>/patch-dob.jsonl` (table, id, value; fsynced), which `--undo`
 *   replays to set exactly those cells back to NULL.
 * - `--blank-list <csv>` writes the accounts left blank, by family code,
 *   school, current school year and reason (D-4). No names, no dates.
 */
import { resolve } from 'node:path'
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs'
import type { School } from '@prisma/client'
import { currentSchoolYear } from '../../../src/lib/portal/current-school-year'
import { EXTRACT_DIR } from '../config'
import { latestCanonical } from '../calc/run'
import { dobAsDate, dobCollisions, readGtDobs, type DobVerdict } from '../build/gt-dob'
import { runDir } from './phases'
import type { LoadAccount } from './plan'
import type { LoadContext } from './context'

export interface PatchDobOptions {
  runId: string
  only?: string[]
  dryRun?: boolean
  undo?: boolean
  blankList?: string
}

export const DOB_TABLES = ['contacts', 'bursary_accounts', 'applications', 'invitations'] as const
export type DobTable = (typeof DOB_TABLES)[number]

export interface PatchLine {
  op: 'set' | 'undo'
  runId: string
  accountKey: string
  table: DobTable
  id: string
  value: string
  at: string
}

type Outcome = 'WRITTEN' | 'PLANNED' | 'ALREADY_SET' | 'BLANK_NO_FORM' | 'BLANK_CONFLICT' | 'BLANK_TWIN' | 'FAILED'

/** "TS - NOWS01 - Surname, First" → "TS-NOWS01"; null when the reference has no family code. */
export function familyCodeOf(reference: string | null | undefined): string | null {
  const m = (reference ?? '').match(/^\s*([A-Z]{2})\s*-\s*([A-Z]{2,4}\d{2})\b/)
  return m ? `${m[1]}-${m[2]}` : null
}

/** The blank-list reason for a verdict that set nothing (D-4). */
export function blankReason(v: DobVerdict | undefined, twin: boolean): string | null {
  if (twin) return 'same name and date as a sibling'
  if (!v || v.status === 'NONE') return 'new award, no GT annual form'
  if (v.status === 'CONFLICT') return 'dates differ across years'
  return null
}

/** The set lines of a patch log that no later undo line reversed. */
export function liveSets(lines: readonly PatchLine[]): PatchLine[] {
  const live = new Map<string, PatchLine>()
  for (const l of lines) {
    const k = `${l.table}:${l.id}`
    if (l.op === 'set') live.set(k, l)
    else live.delete(k)
  }
  return Array.from(live.values())
}

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function appendLines(path: string, lines: readonly PatchLine[]) {
  if (!lines.length) return
  const fd = openSync(path, 'a')
  try {
    writeSync(fd, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

function readLines(path: string): PatchLine[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as PatchLine)
}

async function undo(ctx: LoadContext, opts: PatchDobOptions, logPath: string) {
  const lines = liveSets(readLines(logPath)).filter((l) => !opts.only?.length || opts.only.includes(l.accountKey))
  console.log(`patch-dob UNDO ${opts.dryRun ? 'DRY RUN ' : ''}| target: ${ctx.config.env} (${ctx.config.projectRef}) | run: ${opts.runId} | cells: ${lines.length}`)
  if (opts.dryRun) return { PLANNED: lines.length }
  let reverted = 0
  let changed = 0
  for (const l of lines) {
    // Only a cell still holding exactly what the patch wrote goes back to NULL.
    const n = await ctx.prisma.$executeRawUnsafe(
      `UPDATE ${l.table} SET child_dob = NULL WHERE id = $1::uuid AND child_dob = $2::date`,
      l.id,
      l.value,
    )
    if (n) {
      reverted += n
      appendLines(logPath, [{ ...l, op: 'undo', at: new Date().toISOString() }])
    } else changed++
  }
  console.log(`result: reverted ${reverted} | left (changed since the patch or gone): ${changed}`)
  return { REVERTED: reverted, LEFT: changed }
}

export async function patchDob(ctx: LoadContext, opts: PatchDobOptions) {
  const logPath = resolve(runDir(opts.runId), 'patch-dob.jsonl')
  if (opts.undo) return undo(ctx, opts, logPath)

  const { hash, dir } = latestCanonical()
  const accounts: LoadAccount[] = JSON.parse(readFileSync(resolve(dir, 'accounts.json'), 'utf8')).accounts
  const byKey = new Map(accounts.map((a) => [a.key, a]))

  const ledgered = await ctx.prisma.dataMigrationLedger.findMany({
    where: {
      runId: opts.runId,
      state: 'done',
      entityType: { in: ['Contact', 'BursaryAccount', 'Application'] },
      ...(opts.only?.length ? { accountKey: { in: opts.only } } : {}),
    },
    select: { accountKey: true, entityType: true, entityId: true },
  })
  const rows = new Map<string, { contacts: string[]; accounts: string[]; applications: string[] }>()
  for (const r of ledgered) {
    const e = rows.get(r.accountKey) ?? { contacts: [], accounts: [], applications: [] }
    if (r.entityType === 'Contact') e.contacts.push(r.entityId)
    else if (r.entityType === 'BursaryAccount') e.accounts.push(r.entityId)
    else e.applications.push(r.entityId)
    rows.set(r.accountKey, e)
  }
  const keys = Array.from(rows.keys()).filter((k) => rows.get(k)!.accounts.length).sort()

  const grantIds = new Set(keys.map((k) => byKey.get(k)?.gt?.id).filter((g): g is string => Boolean(g)))
  const verdicts = await readGtDobs(resolve(EXTRACT_DIR, 'gt_progress.tsv'), resolve(EXTRACT_DIR, 'gt_forms.tsv'), grantIds)
  const verdictOf = (k: string) => {
    const g = byKey.get(k)?.gt?.id
    return g ? verdicts.get(g) : undefined
  }

  // What each application is, from the DB (the key the unique indexes use).
  const apps = await ctx.prisma.application.findMany({
    where: { id: { in: keys.flatMap((k) => rows.get(k)!.applications) } },
    select: { id: true, leadApplicantId: true, childName: true, school: true, entryYearGroup: true, reference: true, childDob: true },
  })
  const appOf = (k: string) => apps.find((a) => rows.get(k)!.applications.includes(a.id))
  const twins = new Set(
    dobCollisions(
      keys.map((k) => {
        const v = verdictOf(k)
        const a = appOf(k)
        return { key: k, leadEmail: a?.leadApplicantId ?? k, childName: a?.childName ?? k, dob: v?.status === 'CONSISTENT' ? v.dob : null }
      }),
    ).flat(),
  )

  console.log(
    `patch-dob ${opts.dryRun ? 'DRY RUN ' : ''}| target: ${ctx.config.env} (${ctx.config.projectRef}) | canonical: ${hash} | run: ${opts.runId}` +
      ` | ledgered accounts: ${keys.length}`,
  )

  const outcomes: { key: string; status: Outcome; cells?: number; reason?: string }[] = []
  const blanks: { code: string | null; school: School | null; year: string; reason: string }[] = []
  const today = new Date()
  for (const key of keys) {
    const v = verdictOf(key)
    const app = appOf(key)
    const reason = blankReason(v, twins.has(key))
    if (reason || v?.status !== 'CONSISTENT') {
      outcomes.push({ key, status: twins.has(key) ? 'BLANK_TWIN' : v?.status === 'CONFLICT' ? 'BLANK_CONFLICT' : 'BLANK_NO_FORM' })
      const cy = currentSchoolYear({ entryYearGroup: app?.entryYearGroup, firstAssessmentYear: '2026-27', school: app?.school, today })
      blanks.push({
        code: familyCodeOf(app?.reference) ?? `no family code (GT reference ending ${(app?.reference ?? '').trim().slice(-4)})`,
        school: app?.school ?? null,
        year: cy ? `Year ${cy.year}` : '',
        reason: reason ?? 'new award, no GT annual form',
      })
      continue
    }
    const r = rows.get(key)!
    const value = v.dob
    const date = dobAsDate(value)
    if (opts.dryRun) {
      const pending = await ctx.prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT (SELECT count(*) FROM contacts WHERE id = ANY($1::uuid[]) AND child_dob IS NULL)
              + (SELECT count(*) FROM bursary_accounts WHERE id = ANY($2::uuid[]) AND child_dob IS NULL)
              + (SELECT count(*) FROM applications WHERE id = ANY($3::uuid[]) AND child_dob IS NULL)
              + (SELECT count(*) FROM invitations WHERE child_dob IS NULL AND (contact_id = ANY($1::uuid[]) OR bursary_account_id = ANY($2::uuid[]))) AS n`,
        r.contacts,
        r.accounts,
        r.applications,
      )
      const n = Number(pending[0]?.n ?? 0)
      outcomes.push({ key, status: n ? 'PLANNED' : 'ALREADY_SET', cells: n })
      continue
    }
    try {
      const lines = await ctx.prisma.$transaction(async (tx) => {
        const out: PatchLine[] = []
        const at = new Date().toISOString()
        const set = async (table: DobTable, sql: string, ...params: unknown[]) => {
          const ids = await tx.$queryRawUnsafe<{ id: string }[]>(sql, date, ...params)
          for (const { id } of ids) out.push({ op: 'set', runId: opts.runId, accountKey: key, table, id, value, at })
        }
        await set('contacts', `UPDATE contacts SET child_dob = $1 WHERE id = ANY($2::uuid[]) AND child_dob IS NULL RETURNING id::text`, r.contacts)
        await set('bursary_accounts', `UPDATE bursary_accounts SET child_dob = $1 WHERE id = ANY($2::uuid[]) AND child_dob IS NULL RETURNING id::text`, r.accounts)
        await set('applications', `UPDATE applications SET child_dob = $1 WHERE id = ANY($2::uuid[]) AND child_dob IS NULL RETURNING id::text`, r.applications)
        await set(
          'invitations',
          `UPDATE invitations SET child_dob = $1 WHERE child_dob IS NULL AND (contact_id = ANY($2::uuid[]) OR bursary_account_id = ANY($3::uuid[])) RETURNING id::text`,
          r.contacts,
          r.accounts,
        )
        return out
      })
      appendLines(logPath, lines)
      outcomes.push({ key, status: lines.length ? 'WRITTEN' : 'ALREADY_SET', cells: lines.length })
    } catch (err) {
      const reason = err instanceof Error ? err.message.split('\n')[0] : String(err)
      outcomes.push({ key, status: 'FAILED', reason })
      console.log(`  FAILED ${key}: ${reason}`)
    }
  }

  const counts = outcomes.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})
  const cells = outcomes.reduce((n, o) => n + (o.cells ?? 0), 0)
  const file = resolve(runDir(opts.runId), `patch-dob${opts.dryRun ? '-dry' : ''}.json`)
  writeFileSync(file, JSON.stringify({ runId: opts.runId, env: ctx.config.env, canonical: hash, at: new Date().toISOString(), counts, cells, outcomes }, null, 1))
  if (opts.blankList) {
    const csv = ['family_code,school,current_school_year,reason']
      .concat(
        blanks
          .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
          .map((b) => [b.code, b.school, b.year, b.reason].map(csvCell).join(',')),
      )
      .join('\n')
    writeFileSync(opts.blankList, csv + '\n', { mode: 0o600 })
    console.log(`blank list: ${blanks.length} rows | ${opts.blankList}`)
  }
  console.log(`result: ${JSON.stringify(counts)} | cells ${opts.dryRun ? 'to set' : 'set'}: ${cells} | ${file}`)
  if (counts.FAILED) process.exitCode = 2
  return counts
}
