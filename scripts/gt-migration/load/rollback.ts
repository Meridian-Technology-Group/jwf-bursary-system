/**
 * Ledger-driven rollback (06-checks-and-rollback.md §4).
 *
 * Deletes ONLY rows the ledger lists for the run, per account in one
 * transaction, in reverse dependency order. Before deleting, re-checks that
 * nothing has moved on since the load (06 §3.9): the application still carries
 * `migrationSource`, and no row was edited after it was ledgered. A row that
 * moved on stops the rollback; it is never "fixed". Audit rows are never
 * deleted (append-only); a DATA_MIGRATION_ROLLBACK row is added instead.
 * Ledger rows flip to `rolled_back`; the history stays.
 *
 * Main synopsis (Epic 21 #6, R1): the account's MAIN entry is ledgered and
 * deleted by id, before its assessment (a reload of the assessments phase
 * writes it afresh, and the one-MAIN-per-account index would refuse a second).
 * Rehearsal rows written as YEAR entries keep their ids through the in-place
 * YEAR -> MAIN conversion (migration 20261014130100), so their ledger rows stay
 * valid; a ledgered id that no longer exists is simply not there to delete.
 * Entries are derived, so a later `backfill-synopsis` row does not move the
 * "loaded at" mark the other rows are judged by; each entry is judged by its
 * own `updated_at`, so a staff edit of the Main synopsis stops the rollback. A
 * MAIN no run ledgered (written in the app) stops an accounts rollback (the
 * cascade would take it).
 *
 * Documents (M8): their rows go first, inside the account's transaction; the
 * storage objects are removed only after it commits (they cannot join it), and
 * their ledger rows flip once the removal succeeded. Objects a crashed run left
 * as open intents are removed too. Rolling back an account while documents
 * from another run still sit on its application stops: the cascade would
 * delete their rows and orphan their objects.
 */
import { resolve } from 'node:path'
import type { Prisma } from '@prisma/client'
import { createAuditLog } from '../../../src/lib/audit/log'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../../src/lib/audit/actions'
import { Ledger, type EntityType, type Phase } from './ledger'
import { runDir } from './phases'
import { BUCKET } from './documents'
import type { LoadContext } from './context'

type Tx = Prisma.TransactionClient
type Row = { phase: string; accountKey: string; entityType: string; entityId: string; createdAt: Date }

export interface RollbackOptions {
  runId: string
  phase?: Phase
  only?: string[]
  dryRun?: boolean
}

/** Reverse of creation (06 §4). */
export const ORDER: EntityType[] = [
  'Document',
  'AccountSynopsisEntry',
  'RecommendationGapReason',
  'RecommendationReasonCode',
  'Recommendation',
  'AssessmentEarner',
  'AssessmentProperty',
  'Assessment',
  'BursaryScheduleEntry',
  'BursaryAccount',
  'ApplicationContributor',
  'Application',
  'Contact',
  'Profile',
  'AuthUser',
]

/** Edits within this window after the ledger row count as the load itself. */
const GRACE_MS = 10 * 60 * 1000

export async function rollback(ctx: LoadContext, opts: RollbackOptions) {
  const rows: Row[] = await ctx.prisma.dataMigrationLedger.findMany({
    where: {
      runId: opts.runId,
      state: 'done',
      ...(opts.phase ? { phase: opts.phase } : {}),
      ...(opts.only?.length ? { accountKey: { in: opts.only } } : {}),
    },
    select: { phase: true, accountKey: true, entityType: true, entityId: true, createdAt: true },
  })
  const intents = await ctx.prisma.dataMigrationLedger.count({ where: { runId: opts.runId, state: 'intent' } })
  const objectIntents = !opts.phase || opts.phase === 'documents'
    ? await ctx.prisma.dataMigrationLedger.findMany({
        where: { runId: opts.runId, state: 'intent', entityType: 'StorageObject', ...(opts.only?.length ? { accountKey: { in: opts.only } } : {}) },
        select: { entityId: true },
      })
    : []

  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.entityType] = (m[r.entityType] ?? 0) + 1), m), {})
  const times = rows.map((r) => r.createdAt.getTime())
  console.log(
    `rollback ${opts.dryRun ? 'DRY RUN ' : ''}| target: ${ctx.config.env} (${ctx.config.projectRef}) | run: ${opts.runId}` +
      `${opts.phase ? ` | phase: ${opts.phase}` : ''} | ledger rows: ${rows.length} | open intents: ${intents}`,
  )
  console.log(`  by entity: ${JSON.stringify(counts)}`)
  if (times.length) {
    console.log(`  first: ${new Date(Math.min(...times)).toISOString()} | last: ${new Date(Math.max(...times)).toISOString()}`)
  }
  if (objectIntents.length) console.log(`  open storage intents (a crashed upload): ${objectIntents.length}`)
  if (opts.dryRun || (rows.length === 0 && objectIntents.length === 0)) return { counts, removed: 0 }

  const ledger = new Ledger(ctx.prisma, opts.runId, resolve(runDir(opts.runId), 'ledger.jsonl'))
  const byAccount = new Map<string, Row[]>()
  for (const r of rows) byAccount.set(r.accountKey, [...(byAccount.get(r.accountKey) ?? []), r])

  let removed = 0
  // Accounts first (assessments + accounts phases), then identities.
  const accountKeys = Array.from(byAccount.keys()).filter((k) => !k.startsWith('LEAD:') && k !== 'SYSTEM')
  for (const key of accountKeys) {
    removed += await rollbackAccount(ctx, ledger, key, byAccount.get(key)!)
  }
  for (const key of Array.from(byAccount.keys()).filter((k) => k.startsWith('LEAD:') || k === 'SYSTEM')) {
    removed += await rollbackIdentity(ctx, ledger, key, byAccount.get(key)!)
  }
  removed += await removeObjectIntents(ctx, objectIntents.map((r) => r.entityId))
  console.log(`rolled back ${removed} rows`)
  return { counts, removed }
}

function ids(rows: Row[], type: EntityType) {
  return rows.filter((r) => r.entityType === type).map((r) => r.entityId)
}

async function assertUntouched(tx: Tx, rows: Row[]) {
  const loaded = rows.filter((r) => r.entityType !== 'AccountSynopsisEntry')
  const loadedAt = Math.max(...(loaded.length ? loaded : rows).map((r) => r.createdAt.getTime()))
  const limit = new Date(loadedAt + GRACE_MS)
  const stop = (what: string) => {
    throw new Error(`STOP (06 §3.9): ${what} changed after the load; not rolling back this account`)
  }
  for (const r of rows.filter((x) => x.entityType === 'AccountSynopsisEntry')) {
    const e = await tx.accountSynopsisEntry.findUnique({ where: { id: r.entityId }, select: { updatedAt: true } })
    if (e && e.updatedAt.getTime() > r.createdAt.getTime() + GRACE_MS) stop('the main synopsis')
  }
  const accountIds = ids(rows, 'BursaryAccount')
  if (accountIds.length) {
    // Entries no run ledgered were written in the app (e.g. a MAIN seeded by an award lock).
    const onAccount = await tx.accountSynopsisEntry.findMany({ where: { bursaryAccountId: { in: accountIds } }, select: { id: true } })
    const ledgered = await tx.dataMigrationLedger.count({
      where: { entityType: 'AccountSynopsisEntry', state: 'done', entityId: { in: onAccount.map((e) => e.id) } },
    })
    if (onAccount.length > ledgered) stop(`the main synopsis (${onAccount.length - ledgered} entries written in the app)`)
  }
  for (const id of ids(rows, 'Application')) {
    const a = await tx.application.findUnique({ where: { id }, select: { migrationSource: true, updatedAt: true } })
    if (a && (!a.migrationSource || a.updatedAt > limit)) stop('the application')
  }
  for (const id of ids(rows, 'Assessment')) {
    const a = await tx.assessment.findUnique({ where: { id }, select: { updatedAt: true } })
    if (a && a.updatedAt > limit) stop('the assessment')
  }
  for (const id of ids(rows, 'Recommendation')) {
    const r = await tx.recommendation.findUnique({ where: { id }, select: { updatedAt: true } })
    if (r && r.updatedAt > limit) stop('the recommendation')
  }
  for (const id of ids(rows, 'BursaryAccount')) {
    const b = await tx.bursaryAccount.findUnique({ where: { id }, select: { updatedAt: true } })
    if (b && b.updatedAt > limit) stop('the bursary account')
  }
}

async function rollbackAccount(ctx: LoadContext, ledger: Ledger, key: string, rows: Row[]): Promise<number> {
  const objects = rows.filter((r) => r.entityType === 'StorageObject')
  const dbRows = rows.filter((r) => r.entityType !== 'StorageObject')
  try {
    await ctx.prisma.$transaction(async (tx) => {
      await assertUntouched(tx, rows)
      if (ids(rows, 'Application').length) {
        const listed = new Set(ids(rows, 'Document'))
        const others = await tx.dataMigrationLedger.count({
          where: { accountKey: key, entityType: 'Document', state: 'done', entityId: { notIn: Array.from(listed) } },
        })
        if (others > 0) throw new Error(`STOP: ${others} documents from another run are still on this application; roll back their documents phase first`)
      }
      for (const type of ORDER) {
        const list = ids(rows, type)
        if (list.length === 0) continue
        switch (type) {
          case 'RecommendationGapReason':
            for (const id of list) {
              const [recommendationId, gapReasonId] = id.split(':')
              await tx.recommendationGapReason.deleteMany({ where: { recommendationId, gapReasonId } })
            }
            break
          case 'RecommendationReasonCode':
            for (const id of list) {
              const [recommendationId, reasonCodeId] = id.split(':')
              await tx.recommendationReasonCode.deleteMany({ where: { recommendationId, reasonCodeId } })
            }
            break
          case 'AccountSynopsisEntry':
            await tx.accountSynopsisEntry.deleteMany({ where: { id: { in: list } } })
            break
          case 'Recommendation':
            await tx.recommendation.deleteMany({ where: { id: { in: list } } })
            break
          case 'AssessmentEarner':
            await tx.assessmentEarner.deleteMany({ where: { id: { in: list } } })
            break
          case 'AssessmentProperty':
            await tx.assessmentProperty.deleteMany({ where: { id: { in: list } } })
            break
          case 'Assessment':
            await tx.assessment.deleteMany({ where: { id: { in: list } } })
            break
          case 'BursaryScheduleEntry':
            await tx.bursaryScheduleEntry.deleteMany({ where: { id: { in: list } } })
            break
          case 'BursaryAccount':
            // Unlink the rows that point at it (both ledgered), then remove it.
            await tx.application.updateMany({ where: { bursaryAccountId: { in: list } }, data: { bursaryAccountId: null } })
            await tx.contact.updateMany({ where: { bursaryAccountId: { in: list } }, data: { bursaryAccountId: null } })
            for (const id of list) {
              await createAuditLog(tx, {
                userId: ctx.systemProfileId ?? undefined,
                action: AUDIT_ACTIONS.DATA_MIGRATION_ROLLBACK,
                entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
                entityId: id,
                context: 'Migrated account rolled back',
                metadata: { runId: ledger.runId },
              })
            }
            await tx.bursaryAccount.deleteMany({ where: { id: { in: list } } })
            break
          case 'ApplicationContributor':
            await tx.applicationContributor.deleteMany({ where: { id: { in: list } } })
            break
          case 'Application':
            await tx.application.deleteMany({ where: { id: { in: list }, migrationSource: { not: null } } })
            break
          case 'Contact':
            await tx.contact.deleteMany({ where: { id: { in: list } } })
            break
          case 'Document':
            await tx.document.deleteMany({ where: { id: { in: list } } })
            break
          default:
            throw new Error(`unexpected ${type} on an account key`)
        }
      }
      await ledger.markRolledBack(
        tx,
        dbRows.map((r) => ({ entityType: r.entityType as EntityType, entityId: r.entityId, phase: r.phase as Phase, accountKey: r.accountKey })),
      )
    }, { timeout: 30_000, maxWait: 10_000 })
    ledger.commit()
  } catch (err) {
    ledger.discard()
    console.log(`  FAILED ${key}: ${err instanceof Error ? err.message : err}`)
    if (err instanceof Error && err.message.startsWith('STOP')) throw err
    return 0
  }
  // Rows are gone; now the objects. A failure leaves them `done` for the next rollback.
  for (let i = 0; i < objects.length; i += 100) {
    const batch = objects.slice(i, i + 100)
    const { error } = await ctx.supabase.storage.from(BUCKET).remove(batch.map((o) => o.entityId))
    if (error) {
      console.log(`  FAILED ${key}: removing ${batch.length} storage objects: ${error.message}`)
      return dbRows.length
    }
    await ctx.prisma.$transaction((tx) =>
      ledger.markRolledBack(tx, batch.map((o) => ({ entityType: 'StorageObject' as const, entityId: o.entityId, phase: o.phase as Phase, accountKey: o.accountKey }))),
    )
    ledger.commit()
  }
  return rows.length
}

/** Objects a crashed upload left behind: remove them (absent is fine), then drop the intent. */
async function removeObjectIntents(ctx: LoadContext, keys: string[]): Promise<number> {
  let removed = 0
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100)
    const { error } = await ctx.supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.log(`  FAILED removing ${batch.length} intended storage objects: ${error.message}`)
      return removed
    }
    await ctx.prisma.dataMigrationLedger.deleteMany({ where: { entityType: 'StorageObject', entityId: { in: batch }, state: 'intent' } })
    removed += batch.length
  }
  return removed
}

/** A login and profile go only once none of that parent's migrated rows remain. */
async function rollbackIdentity(ctx: LoadContext, ledger: Ledger, key: string, rows: Row[]): Promise<number> {
  const profileIds = ids(rows, 'Profile')
  for (const id of profileIds) {
    const [apps, contacts, accounts, created] = await Promise.all([
      ctx.prisma.application.count({ where: { leadApplicantId: id } }),
      ctx.prisma.contact.count({ where: { OR: [{ profileId: id }, { createdBy: id }] } }),
      ctx.prisma.bursaryAccount.count({ where: { leadApplicantId: id } }),
      ctx.prisma.document.count({ where: { uploadedBy: id } }),
    ])
    if (apps + contacts + accounts + created > 0) {
      console.log(`  kept ${key}: the profile still has rows (not all of its accounts were rolled back)`)
      return 0
    }
  }
  await ctx.prisma.$transaction(async (tx) => {
    await tx.profile.deleteMany({ where: { id: { in: profileIds } } })
    await ledger.markRolledBack(
      tx,
      rows.filter((r) => r.entityType === 'Profile').map((r) => ({ entityType: 'Profile' as const, entityId: r.entityId, phase: r.phase as Phase, accountKey: r.accountKey })),
    )
  })
  ledger.commit()
  // Auth users: outside any transaction; ledgered ids only, so a reused login is never touched.
  for (const r of rows.filter((x) => x.entityType === 'AuthUser')) {
    const { error } = await ctx.supabase.auth.admin.deleteUser(r.entityId)
    if (error && !/not.?found/i.test(error.message)) {
      console.log(`  FAILED auth user for ${key}: ${error.message}`)
      continue
    }
    await ctx.prisma.$transaction((tx) =>
      ledger.markRolledBack(tx, [{ entityType: 'AuthUser', entityId: r.entityId, phase: r.phase as Phase, accountKey: r.accountKey }]),
    )
    ledger.commit()
  }
  return rows.length
}
