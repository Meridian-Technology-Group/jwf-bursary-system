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

  // B5: recommended = max(0, actual) on every migrated assessment.
  const b5 = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM assessments s JOIN applications a ON a.id = s.application_id
    WHERE a.migration_source IS NOT NULL
      AND abs(s.recommended_payable_fees - GREATEST(0, s.actual_remaining_di)) > 0.005`
  add('B5', Number(b5[0].n) === 0, `${b5[0].n} migrated rows break the rule`)

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
  add('A (re-run)', aFailures === 0, `${aFailures} accounts fail`)
  add('B8', Math.abs(sumConfirmed - expectConfirmed) < 0.01 && Math.abs(sumAward - expectAward) < 0.01,
    `confirmed £${sumConfirmed.toFixed(2)} vs sheet £${expectConfirmed.toFixed(2)}; award £${sumAward.toFixed(2)} vs sheet £${expectAward.toFixed(2)}`)

  const ok = checks.every((c) => c.ok)
  writeFileSync(resolve(dir, 'verify.json'), JSON.stringify({ runId, at: new Date().toISOString(), ok, checks, failedKeys }, null, 1))
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.id}: ${c.detail ?? ''}`)
  failedKeys.forEach((k) => console.log(`    ${k}`))
  console.log(ok ? 'verified' : 'NOT VERIFIED')
  return ok
}
