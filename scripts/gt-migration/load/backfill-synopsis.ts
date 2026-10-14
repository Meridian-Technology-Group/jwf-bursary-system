/**
 * `mig backfill-synopsis` (Epic 21 #6; R1 rework, 14 Oct 2026): gives accounts
 * loaded before the Main synopsis existed their MAIN entry, as the load now
 * writes it.
 *
 * For every assessment the run ledgered (state done): one transaction writes
 * the account's MAIN entry from the assessment's synopsis as it stands now and
 * ledgers it under the same run, phase `assessments` and account key, so
 * `rollback` removes exactly what this added. An account that already has a
 * MAIN (from an earlier backfill, the in-place YEAR -> MAIN conversion of
 * migration 20261014130100, or staff) is skipped, so a rerun is a no-op and the
 * one-MAIN-per-account index is never tripped. Nothing else moves: the account,
 * assessment and recommendation are only read.
 */
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { Ledger } from './ledger'
import { runDir } from './phases'
import { findMainSynopsis, writeMainSynopsis } from './main-synopsis'
import type { LoadContext } from './context'

export interface BackfillOptions {
  runId: string
  only?: string[]
  dryRun?: boolean
}

type Outcome = 'WRITTEN' | 'PLANNED' | 'SKIPPED_HAS_MAIN' | 'SKIPPED_NOT_MIGRATED' | 'FAILED'

export async function backfillSynopsis(ctx: LoadContext, opts: BackfillOptions) {
  const ledger = new Ledger(ctx.prisma, opts.runId, resolve(runDir(opts.runId), 'ledger.jsonl'))
  const assessments = await ctx.prisma.dataMigrationLedger.findMany({
    where: {
      runId: opts.runId,
      entityType: 'Assessment',
      state: 'done',
      ...(opts.only?.length ? { accountKey: { in: opts.only } } : {}),
    },
    select: { accountKey: true, entityId: true },
    orderBy: { accountKey: 'asc' },
  })
  console.log(
    `backfill-synopsis ${opts.dryRun ? 'DRY RUN ' : ''}| target: ${ctx.config.env} (${ctx.config.projectRef}) | run: ${opts.runId}` +
      ` | ledgered assessments: ${assessments.length}`,
  )

  const outcomes: { key: string; status: Outcome; reason?: string }[] = []
  for (const row of assessments) {
    const a = await ctx.prisma.assessment.findUnique({
      where: { id: row.entityId },
      select: {
        id: true,
        synopsis: true,
        application: { select: { migrationSource: true, bursaryAccountId: true } },
      },
    })
    if (!a || !a.application.migrationSource || !a.application.bursaryAccountId) {
      outcomes.push({ key: row.accountKey, status: 'SKIPPED_NOT_MIGRATED' })
      continue
    }
    const accountId = a.application.bursaryAccountId
    if (await findMainSynopsis(ctx.prisma, accountId)) {
      outcomes.push({ key: row.accountKey, status: 'SKIPPED_HAS_MAIN' })
      continue
    }
    if (opts.dryRun) {
      outcomes.push({ key: row.accountKey, status: 'PLANNED' })
      continue
    }
    try {
      await ctx.prisma.$transaction(async (tx) => {
        // Re-checked inside the transaction: null means a MAIN arrived meanwhile.
        const entryId = await writeMainSynopsis(tx, accountId, a.synopsis)
        if (!entryId) throw new Error('account gained a main synopsis meanwhile')
        await ledger.record(tx, 'assessments', row.accountKey, [{ entityType: 'AccountSynopsisEntry', entityId: entryId }])
      })
      ledger.commit()
      outcomes.push({ key: row.accountKey, status: 'WRITTEN' })
    } catch (err) {
      ledger.discard()
      const reason = err instanceof Error ? err.message : String(err)
      outcomes.push({ key: row.accountKey, status: 'FAILED', reason })
      console.log(`  FAILED ${row.accountKey}: ${reason}`)
    }
  }

  const counts = outcomes.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})
  // Not named manifest-*.json: verify reads those as load phases.
  const file = resolve(runDir(opts.runId), `backfill-synopsis${opts.dryRun ? '-dry' : ''}.json`)
  writeFileSync(file, JSON.stringify({ runId: opts.runId, env: ctx.config.env, at: new Date().toISOString(), counts, outcomes }, null, 1))
  console.log(`result: ${JSON.stringify(counts)} | ${file}`)
  if (counts.FAILED) process.exitCode = 2
  return counts
}
