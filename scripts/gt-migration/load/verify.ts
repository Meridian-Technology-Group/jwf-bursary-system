/**
 * Post-phase verification (06-checks-and-rollback.md §1 group B), plus a
 * re-run of the group-A invariants for every loaded account. Read-only.
 * Writes runs/<run-id>/verify.json; prints counts and account keys only.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LoadContext } from './context'
import type { MirrorLine } from './ledger'
import {
  checkAccountInvariants,
  checkAssessmentInvariants,
  findMigratedApplication,
  leadProfileId,
  planAll,
  runDir,
} from './phases'
import { MIGRATION_SOURCE } from './plan'
import { BUCKET, GT_SLOT_PREFIX, stagedByAccount } from './documents'
import { storageKey } from '../docs/select'

interface Check {
  id: string
  ok: boolean
  detail?: string
}

export async function verify(ctx: LoadContext, runId: string) {
  const dir = runDir(runId)
  const manifests = existsSync(dir) ? readdirSync(dir).filter((f) => /^manifest-\w+\.json$/.test(f)) : []
  if (manifests.length === 0) throw new Error(`No manifests for run ${runId}`)
  const startedAt = new Date(
    Math.min(...manifests.map((f) => Date.parse(JSON.parse(readFileSync(resolve(dir, f), 'utf8')).startedAt))),
  )
  const checks: Check[] = []
  const add = (id: string, ok: boolean, detail?: string) => checks.push({ id, ok, detail })
  const db = ctx.prisma

  // B2: nothing was sent, nothing was invited.
  const [emails, invites, staffInvites] = await Promise.all([
    db.emailLog.count({ where: { createdAt: { gte: startedAt } } }),
    db.invitation.count({ where: { createdAt: { gte: startedAt } } }),
    db.staffInvitation.count({ where: { createdAt: { gte: startedAt } } }),
  ])
  add('B2', emails === 0 && invites === 0 && staffInvites === 0, `email_log +${emails}, invitations +${invites}, staff_invitations +${staffInvites}`)

  // B9: no sibling links (S22).
  const siblingLinks = await db.siblingLink.count({ where: { createdAt: { gte: startedAt } } })
  add('B9', siblingLinks === 0, `sibling_links +${siblingLinks}`)

  // B6, B7 over every migrated application.
  const migrated = await db.application.findMany({
    where: { migrationSource: MIGRATION_SOURCE },
    select: { id: true, submittedAt: true, closedAt: true, assessment: { select: { status: true } } },
  })
  add('B6', migrated.every((a) => a.assessment?.status !== 'COMPLETED'), `${migrated.filter((a) => a.assessment?.status === 'COMPLETED').length} COMPLETED`)
  add('B7', migrated.every((a) => a.submittedAt && !a.closedAt), `${migrated.length} migrated applications`)

  // B10: DB ledger ≡ local mirror, no open intents.
  const dbRows = await db.dataMigrationLedger.findMany({ where: { runId }, select: { entityType: true, entityId: true, state: true } })
  const mirrorFile = resolve(dir, 'ledger.jsonl')
  const mirror = new Map<string, string>()
  if (existsSync(mirrorFile)) {
    for (const line of readFileSync(mirrorFile, 'utf8').split('\n').filter(Boolean)) {
      const m = JSON.parse(line) as MirrorLine
      mirror.set(`${m.entityType}|${m.entityId}`, m.state)
    }
  }
  const openIntents = dbRows.filter((r) => r.state === 'intent').length
  const mismatched = dbRows.filter((r) => r.state !== 'intent' && mirror.get(`${r.entityType}|${r.entityId}`) !== r.state).length
  const extra = Array.from(mirror.keys()).filter((k) => !dbRows.some((r) => `${r.entityType}|${r.entityId}` === k)).length
  add('B10', openIntents === 0 && mismatched === 0 && extra === 0, `db ${dbRows.length}, mirror ${mirror.size}, mismatched ${mismatched}, mirror-only ${extra}, open intents ${openIntents}`)

  // B3: every ledgered login is a confirmed applicant.
  const authIds = dbRows.filter((r) => r.entityType === 'AuthUser' && r.state === 'done').map((r) => r.entityId)
  let badAuth = 0
  for (const id of authIds) {
    const { data, error } = await ctx.supabase.auth.admin.getUserById(id)
    if (error || !data.user?.email_confirmed_at || data.user.app_metadata?.role !== 'APPLICANT') badAuth++
  }
  add('B3', badAuth === 0, `${authIds.length} logins created, ${badAuth} not confirmed applicants`)

  // Group A again, and B8 aggregates, for every account this run loaded.
  const { plans } = await planAll(ctx, {})
  let aFailures = 0
  const failedKeys: string[] = []
  let sumConfirmed = 0
  let sumAward = 0
  let expectConfirmed = 0
  let expectAward = 0
  for (const plan of Array.from(plans.values())) {
    const leadId = await leadProfileId(ctx, plan)
    if (!leadId) continue
    const apps = (await findMigratedApplication(db, ctx, plan, leadId)).filter((a) => a.migrationSource === MIGRATION_SOURCE)
    if (apps.length !== 1 || !apps[0].bursaryAccountId) continue
    try {
      await checkAccountInvariants(db, ctx, plan, apps[0].id, apps[0].bursaryAccountId)
      const assessment = await db.assessment.findUnique({ where: { applicationId: apps[0].id }, select: { id: true } })
      if (assessment) {
        await checkAssessmentInvariants(db, plan, assessment.id)
        const r = await db.recommendation.findUniqueOrThrow({ where: { assessmentId: assessment.id } })
        sumConfirmed += Number(r.confirmedPayableFees)
        sumAward += Number(r.bursaryAward)
        expectConfirmed += plan.expect.confirmedPayableFees
        expectAward += plan.expect.bursaryAward
      }
    } catch (err) {
      aFailures++
      failedKeys.push(`${plan.key}: ${err instanceof Error ? err.message : err}`)
    }
  }
  // B5: recommended = max(0, actual) on every migrated assessment, except an
  // account her batch 1 ruling (8 Oct) takes from another leg; group A above
  // has already checked those against their own leg (A4).
  const ruled = new Set(Array.from(plans.values()).filter((p) => p.expect.referenceLeg !== 'ACTUAL').map((p) => p.key))
  const offActual = await db.$queryRaw<{ key: string | null }[]>`
    SELECT l.account_key AS key FROM assessments s
    JOIN applications a ON a.id = s.application_id
    LEFT JOIN data_migration_ledger l ON l.entity_type = 'Assessment' AND l.entity_id = s.id::text AND l.state = 'done'
    WHERE a.migration_source IS NOT NULL
      AND abs(s.recommended_payable_fees - GREATEST(0, s.actual_remaining_di)) > 0.005`
  const unexplained = offActual.filter((r) => !r.key || !ruled.has(r.key)).length
  add('B5', unexplained === 0, `${offActual.length} off the actual leg, ${offActual.length - unexplained} by her reference-leg ruling, ${unexplained} unexplained`)

  add('A (re-run)', aFailures === 0, `${aFailures} accounts fail`)
  add('B8', Math.abs(sumConfirmed - expectConfirmed) < 0.01 && Math.abs(sumAward - expectAward) < 0.01,
    `confirmed £${sumConfirmed.toFixed(2)} vs sheet £${expectConfirmed.toFixed(2)}; award £${sumAward.toFixed(2)} vs sheet £${expectAward.toFixed(2)}`)

  if (manifests.includes('manifest-documents.json')) await verifyDocuments(ctx, plans, add, failedKeys)

  const ok = checks.every((c) => c.ok)
  writeFileSync(resolve(dir, 'verify.json'), JSON.stringify({ runId, at: new Date().toISOString(), ok, checks, failedKeys }, null, 1))
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.id}: ${c.detail ?? ''}`)
  failedKeys.forEach((k) => console.log(`    ${k}`))
  console.log(ok ? 'verified' : 'NOT VERIFIED')
  return ok
}

/**
 * M8 step 6, for every account with a migrated application:
 *   D1 its GT documents are exactly the staged selection (by object key)
 *   D2 every object exists in storage at the staged size
 *   D3 total bytes in the rows = total bytes staged
 *   D4 coverage: no account with staged documents is still without them
 *      (fails after a canary by design; D1–D3 judge what was loaded)
 */
async function verifyDocuments(
  ctx: LoadContext,
  plans: Awaited<ReturnType<typeof planAll>>['plans'],
  add: (id: string, ok: boolean, detail?: string) => void,
  failedKeys: string[],
) {
  const { hash } = (await import('../calc/run')).latestCanonical()
  const staged = stagedByAccount(hash)
  let d1 = 0
  let d2 = 0
  let accounts = 0
  let rowsBytes = 0
  let stagedBytes = 0
  let objects = 0
  let pending = 0
  for (const plan of Array.from(plans.values())) {
    const leadId = await leadProfileId(ctx, plan)
    if (!leadId) continue
    const apps = (await findMigratedApplication(ctx.prisma, ctx, plan, leadId)).filter((a) => a.migrationSource === MIGRATION_SOURCE)
    if (apps.length !== 1) continue
    accounts++
    const appId = apps[0].id
    const docs = staged.get(plan.key) ?? []
    const expected = new Map(docs.map((d) => [storageKey(appId, d), d.size]))
    const rows = await ctx.prisma.document.findMany({
      where: { applicationId: appId, slot: { startsWith: GT_SLOT_PREFIX } },
      select: { storagePath: true, fileSize: true, slot: true },
    })
    if (rows.length === 0 && docs.length > 0) {
      pending++
      continue
    }
    stagedBytes += docs.reduce((s, d) => s + d.size, 0)
    rowsBytes += rows.reduce((s, r) => s + r.fileSize, 0)
    if (rows.length !== expected.size || rows.some((r) => expected.get(r.storagePath) !== r.fileSize)) {
      d1++
      failedKeys.push(`${plan.key}: D1 ${rows.length} GT documents, ${expected.size} staged`)
    }
    const stored = new Map<string, number>()
    for (const slot of Array.from(new Set(rows.map((r) => r.slot)))) {
      const folder = `documents/${appId}/${slot}`
      const { data, error } = await ctx.supabase.storage.from(BUCKET).list(folder, { limit: 1000 })
      if (error) throw new Error(`storage list: ${error.message}`)
      for (const o of data ?? []) stored.set(`${folder}/${o.name}`, Number((o.metadata as { size?: number } | null)?.size ?? -1))
    }
    objects += stored.size
    const bad = rows.filter((r) => stored.get(r.storagePath) !== r.fileSize).length
    if (bad) {
      d2++
      failedKeys.push(`${plan.key}: D2 ${bad} objects missing or the wrong size`)
    }
  }
  add('D1', d1 === 0, `${accounts} accounts checked, ${d1} differ from the staged selection`)
  add('D2', d2 === 0, `${objects} objects listed, ${d2} accounts with a missing or mis-sized object`)
  add('D4', pending === 0, `${pending} accounts with staged documents have none loaded`)
  add('D3', rowsBytes === stagedBytes, `rows ${(rowsBytes / 1e9).toFixed(3)} GB vs staged ${(stagedBytes / 1e9).toFixed(3)} GB`)
}
