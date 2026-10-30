/**
 * M8 — the documents phase (`mig load --phase documents`).
 *
 * Per account: the files `mig docs-extract` staged for it are uploaded to the
 * `documents` bucket under deterministic keys, then one transaction writes
 * their `documents` rows on the migrated application, confirms the objects in
 * the ledger, and checks the account now holds exactly what was selected.
 *
 * Idempotent: a document whose key already has a row is skipped. Objects are
 * external side effects (02 §10, 04 §4): each is an `intent` before upload and
 * flips to `done` inside the row transaction, so a crash leaves intents the
 * next run adopts (an object left by our own intent, at the expected size, is
 * kept rather than uploaded again) and a rollback can find.
 *
 * Nothing here sends mail or touches an account's figures.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createAuditLog } from '../../../src/lib/audit/log'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../../src/lib/audit/actions'
import { DOCS_STAGING_DIR } from '../config'
import { readStagedSelection, type StagedDoc } from '../docs/extract'
import { storageKey } from '../docs/select'
import type { LoadContext } from './context'
import type { Ledger } from './ledger'
import { MIGRATION_SOURCE, type AccountPlan } from './plan'
import { findMigratedApplication, leadProfileId, type AccountOutcome, type LoadOptions } from './phases'

export const BUCKET = 'documents'
export const GT_SLOT_PREFIX = 'GRANT_TRACKER_'
const UPLOAD_CONCURRENCY = 4
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const

export function stagedByAccount(hash: string): Map<string, StagedDoc[]> {
  const selection = readStagedSelection()
  if (selection.canonicalHash !== hash) {
    throw new Error(`docs-staging was built on ${selection.canonicalHash}, canonical is ${hash}: run mig docs-extract again`)
  }
  const by = new Map<string, StagedDoc[]>()
  for (const d of selection.docs) by.set(d.accountKey, [...(by.get(d.accountKey) ?? []), d])
  return by
}

/** GT's own date, so the list shows when the family actually sent it. Midday UTC: never the day before in London. */
const uploadedAt = (created: string) => new Date(`${created}T12:00:00Z`)

async function pool<T>(items: readonly T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

async function objectSize(ctx: LoadContext, key: string): Promise<number | null> {
  const { data, error } = await ctx.supabase.storage.from(BUCKET).info(key)
  if (error || !data) return null
  return typeof data.size === 'number' ? data.size : null
}

async function uploadOne(ctx: LoadContext, ledger: Ledger, plan: AccountPlan, key: string, doc: StagedDoc) {
  const prior = await ledger.objectIntent('documents', plan.key, key)
  if (prior === 'done') throw new Error('an object ledgered as loaded has no documents row (deleted in the app?): not re-creating it')
  const body = readFileSync(resolve(DOCS_STAGING_DIR, 'files', doc.localPath))
  if (body.length !== doc.size) throw new Error('staged file changed size since docs-extract')
  const { error } = await ctx.supabase.storage.from(BUCKET).upload(key, body, { contentType: doc.mime, upsert: false })
  if (!error) return
  // Already there: ours only if a run of ours left the intent, and only at the right size.
  if (/exists|duplicate/i.test(error.message) && prior !== 'new' && (await objectSize(ctx, key)) === doc.size) return
  throw new Error(`upload: ${error.message}${doc.size > 50 * 1024 * 1024 ? ` (${Math.round(doc.size / 1048576)} MB: check the project's global file size limit)` : ''}`)
}

export async function loadDocumentsForAccount(
  ctx: LoadContext,
  ledger: Ledger,
  plan: AccountPlan,
  docs: readonly StagedDoc[],
  opts: Pick<LoadOptions, 'dryRun'>,
): Promise<AccountOutcome> {
  const base = { key: plan.key, gtGrantId: plan.gtGrantId }
  if (!ctx.systemProfileId) return { ...base, status: 'HELD', reason: 'no system profile: run identities first' }
  const leadId = await leadProfileId(ctx, plan)
  const apps = leadId ? (await findMigratedApplication(ctx.prisma, ctx, plan, leadId)).filter((a) => a.migrationSource === MIGRATION_SOURCE) : []
  if (apps.length !== 1) return { ...base, status: 'HELD', reason: 'no migrated application yet: run accounts first' }
  const appId = apps[0].id
  if (docs.length === 0) return { ...base, status: 'NOTHING_TO_LOAD' }

  const keyed = docs.map((d) => ({ doc: d, key: storageKey(appId, d) }))
  if (new Set(keyed.map((k) => k.key)).size !== keyed.length) return { ...base, status: 'FAILED', reason: 'two documents map to one storage key' }
  const existing = new Set(
    (await ctx.prisma.document.findMany({ where: { applicationId: appId }, select: { storagePath: true } })).map((d) => d.storagePath),
  )
  const todo = keyed.filter((k) => !existing.has(k.key))
  if (todo.length === 0) return { ...base, status: 'SKIPPED_ALREADY_LOADED' }
  if (opts.dryRun) return { ...base, status: 'PLANNED', created: { Document: todo.length } }

  try {
    await pool(todo, UPLOAD_CONCURRENCY, ({ doc, key }) => uploadOne(ctx, ledger, plan, key, doc))

    await ctx.prisma.$transaction(async (tx) => {
      const rows = todo.map(({ doc, key }) => ({
        id: randomUUID(),
        applicationId: appId,
        slot: doc.slot,
        filename: doc.filename,
        mimeType: doc.mime,
        fileSize: doc.size,
        storagePath: key,
        contentDigest: doc.contentDigest,
        isVerified: false,
        uploadedBy: ctx.systemProfileId!,
        uploadedAt: uploadedAt(doc.created),
      }))
      await tx.document.createMany({ data: rows })
      await ledger.record(tx, 'documents', plan.key, rows.map((r) => ({ entityType: 'Document' as const, entityId: r.id })))
      await ledger.confirmObjects(tx, 'documents', plan.key, todo.map((t) => t.key))

      // D1 for this account: its GT documents are exactly the selection.
      const held = await tx.document.findMany({
        where: { applicationId: appId, slot: { startsWith: GT_SLOT_PREFIX } },
        select: { storagePath: true },
      })
      const expected = new Set(keyed.map((k) => k.key))
      if (held.length !== expected.size || held.some((h) => !expected.has(h.storagePath))) {
        throw new Error(`invariant D1: ${held.length} GT documents on the application, ${expected.size} selected`)
      }
      await createAuditLog(tx, {
        userId: ctx.systemProfileId!,
        action: AUDIT_ACTIONS.DATA_MIGRATION_IMPORT,
        entityType: AUDIT_ENTITY_TYPES.Application,
        entityId: appId,
        context: 'Documents loaded from Grant Tracker',
        metadata: { runId: ledger.runId, source: MIGRATION_SOURCE, gtGrantId: plan.gtGrantId, documents: rows.length, bytes: rows.reduce((s, r) => s + r.fileSize, 0) },
      })
    }, TX_OPTIONS)
    ledger.commit()
    return { ...base, status: 'LOADED', created: { Document: todo.length, StorageObject: todo.length } }
  } catch (err) {
    ledger.discard()
    return { ...base, status: 'FAILED', reason: err instanceof Error ? err.message : String(err) }
  }
}
