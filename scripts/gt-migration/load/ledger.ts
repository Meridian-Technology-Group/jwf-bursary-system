/**
 * The data-migration ledger (04-toolkit.md §4): every row or object a run
 * creates, so a rollback removes exactly those and nothing else.
 *
 * - DB rows are ledgered in the SAME transaction as the rows they describe
 *   (`record`), so they commit or vanish together.
 * - External side effects (auth users) cannot join a transaction: `intent` is
 *   written first in its own transaction, the call is made, then `done` flips
 *   it to the real id. A crash leaves a `pending:` intent the next run adopts.
 * - A reused pre-existing row is never ledgered, so a rollback can never
 *   delete it.
 * - Every committed entry is mirrored to runs/<run-id>/ledger.jsonl, fsynced;
 *   verify compares the two (B10).
 *
 * Ledger rows carry the account key hash, never a name or an email.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Prisma, PrismaClient } from '@prisma/client'

export type Phase = 'identities' | 'accounts' | 'assessments' | 'documents'

export type EntityType =
  | 'AuthUser'
  | 'Profile'
  | 'Contact'
  | 'Application'
  | 'ApplicationContributor'
  | 'BursaryAccount'
  | 'BursaryScheduleEntry'
  | 'Assessment'
  | 'AssessmentEarner'
  | 'AssessmentProperty'
  | 'Recommendation'
  | 'RecommendationReasonCode'
  | 'RecommendationGapReason'
  | 'AccountSynopsisEntry'
  | 'Document'
  | 'StorageObject'

export interface LedgerEntry {
  entityType: EntityType
  entityId: string
}

export interface MirrorLine extends LedgerEntry {
  runId: string
  phase: Phase
  accountKey: string
  state: 'done' | 'rolled_back'
  at: string
}

type Tx = Prisma.TransactionClient

export class Ledger {
  private pending: MirrorLine[] = []

  constructor(
    private readonly prisma: PrismaClient,
    readonly runId: string,
    private readonly mirrorPath: string,
  ) {
    mkdirSync(dirname(mirrorPath), { recursive: true })
  }

  /** Inside the account's transaction. Mirrored only once `commit()` is called after it commits. */
  async record(tx: Tx, phase: Phase, accountKey: string, entries: readonly LedgerEntry[]) {
    if (entries.length === 0) return
    await tx.dataMigrationLedger.createMany({
      data: entries.map((e) => ({
        runId: this.runId,
        phase,
        accountKey,
        entityType: e.entityType,
        entityId: e.entityId,
        state: 'done',
      })),
    })
    const at = new Date().toISOString()
    this.pending.push(...entries.map((e) => ({ ...e, runId: this.runId, phase, accountKey, state: 'done' as const, at })))
  }

  /** After the transaction committed: append its entries to the mirror and fsync. */
  commit() {
    if (this.pending.length === 0) return
    this.append(this.pending)
    this.pending = []
  }

  /** The transaction rolled back: its entries never existed. */
  discard() {
    this.pending = []
  }

  /** External side effect, step 1: an intent keyed by a hash the next run can find. */
  async intent(phase: Phase, accountKey: string, entityType: EntityType, pendingId: string) {
    await this.prisma.dataMigrationLedger.upsert({
      where: { entityType_entityId: { entityType, entityId: pendingId } },
      create: { runId: this.runId, phase, accountKey, entityType, entityId: pendingId, state: 'intent' },
      update: {},
    })
  }

  /** External side effect, step 2: the call succeeded; record the real id. */
  async done(phase: Phase, accountKey: string, entityType: EntityType, pendingId: string, realId: string) {
    await this.prisma.dataMigrationLedger.update({
      where: { entityType_entityId: { entityType, entityId: pendingId } },
      data: { entityId: realId, state: 'done', runId: this.runId },
    })
    this.append([{ entityType, entityId: realId, runId: this.runId, phase, accountKey, state: 'done', at: new Date().toISOString() }])
  }

  /** The call created nothing (the login already existed): drop the intent. */
  async cancelIntent(entityType: EntityType, pendingId: string) {
    await this.prisma.dataMigrationLedger.deleteMany({
      where: { entityType, entityId: pendingId, state: 'intent' },
    })
  }

  async hasIntent(entityType: EntityType, pendingId: string): Promise<boolean> {
    const row = await this.prisma.dataMigrationLedger.findUnique({
      where: { entityType_entityId: { entityType, entityId: pendingId } },
      select: { state: true },
    })
    return row?.state === 'intent'
  }

  /**
   * A storage object (M8), step 1. Its key is deterministic, so the ledger row
   * outlives a rollback: a rolled-back row is reopened as an intent. Returns
   * the state found, so the caller knows whether an existing object is ours.
   */
  async objectIntent(phase: Phase, accountKey: string, key: string): Promise<'new' | 'intent' | 'done' | 'rolled_back'> {
    const row = await this.prisma.dataMigrationLedger.findUnique({
      where: { entityType_entityId: { entityType: 'StorageObject', entityId: key } },
      select: { state: true },
    })
    if (row?.state === 'done') return 'done'
    if (row) {
      await this.prisma.dataMigrationLedger.update({
        where: { entityType_entityId: { entityType: 'StorageObject', entityId: key } },
        data: { state: 'intent', runId: this.runId, phase, accountKey },
      })
      return row.state as 'intent' | 'rolled_back'
    }
    await this.prisma.dataMigrationLedger.create({
      data: { runId: this.runId, phase, accountKey, entityType: 'StorageObject', entityId: key, state: 'intent' },
    })
    return 'new'
  }

  /** Storage objects, step 2: inside the transaction that writes their rows, so both commit together. */
  async confirmObjects(tx: Tx, phase: Phase, accountKey: string, keys: readonly string[]) {
    if (keys.length === 0) return
    await tx.dataMigrationLedger.updateMany({
      where: { entityType: 'StorageObject', entityId: { in: [...keys] }, state: 'intent' },
      data: { state: 'done', runId: this.runId },
    })
    const at = new Date().toISOString()
    this.pending.push(...keys.map((k) => ({ entityType: 'StorageObject' as const, entityId: k, runId: this.runId, phase, accountKey, state: 'done' as const, at })))
  }

  /** Rollback: flip to rolled_back (never delete: the history stays), and mirror it. */
  async markRolledBack(tx: Tx, entries: readonly (LedgerEntry & { phase: Phase; accountKey: string })[]) {
    for (const e of entries) {
      await tx.dataMigrationLedger.update({
        where: { entityType_entityId: { entityType: e.entityType, entityId: e.entityId } },
        data: { state: 'rolled_back' },
      })
    }
    const at = new Date().toISOString()
    this.pending.push(...entries.map((e) => ({ ...e, runId: this.runId, state: 'rolled_back' as const, at })))
  }

  private append(lines: readonly MirrorLine[]) {
    const fd = openSync(this.mirrorPath, 'a')
    try {
      writeSync(fd, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  }
}
