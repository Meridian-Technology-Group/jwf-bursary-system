/**
 * Load phases (04-toolkit.md §5; 02-target-model.md Part 1):
 *
 *   identities  → one auth user + profile per lead email (reused when it exists)
 *   accounts    → per account: contact, placeholder application (+ PRIMARY
 *                 contributor), bursary account, schedule (year 1 COMPLETE)
 *   assessments → per account: assessment (+ earners, property) locked as
 *                 ROLLED_OVER / NEW_AWARD, recommendation (+ reason, gap codes),
 *                 and the account's Main synopsis (Epic 21 #6 rework, R1:
 *                 one MAIN entry pre-filled with the composed GT synopsis)
 *   documents   → per account: its staged GT documents on the migrated
 *                 application (M8; load/documents.ts)
 *
 * One account = one transaction; the group-A invariants run inside it before
 * commit. Concurrency 1. Logs carry the account key and GT grant id only.
 * Nothing here sends mail: no invitation is created and no module under
 * src/lib/email is imported (04 §6).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Prisma } from '@prisma/client'
import { calculateAssessmentV2 } from '../../../src/lib/assessment/v2/orchestrator'
import { provisionApplicantAuthUser } from '../../../src/lib/auth/provision-applicant'
import { createProfile } from '../../../src/lib/auth/create-profile'
import { ensurePrimaryContributor } from '../../../src/lib/db/queries/contributors'
import { promoteToActiveAccount } from '../../../src/lib/applications/account-promotion'
import { mirrorApplicationToSchedule } from '../../../src/lib/bursary-accounts/lifecycle'
import { effectiveHorizon, resolveScheduleHorizon } from '../../../src/lib/bursary-accounts/schedule'
import { saveAssessment } from '../../../src/lib/db/queries/assessments'
import { upsertRecommendation } from '../../../src/lib/db/queries/recommendations'
import { createAuditLog } from '../../../src/lib/audit/log'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../../src/lib/audit/actions'
import { isAwardFundValidForSchool } from '../../../src/lib/assessment/award-fund'
import { DATA_DIR, EXTRACT_DIR } from '../config'
import { latestCanonical } from '../calc/run'
import { readGtForms } from '../build/gt-forms'
import { dobCollisions, readGtDobs } from '../build/gt-dob'
import { mapAssessment } from '../build/map-assessment'
import { Ledger, type LedgerEntry, type Phase } from './ledger'
import { mainSynopsisProblem, writeMainSynopsis } from './main-synopsis'
import { planAccount, PlanError, MIGRATION_SOURCE, type AccountPlan, type LoadAccount } from './plan'
import { resolveLabels } from './reason-codes'
import { recommendedFromLeg } from '../build/reference-leg'
import { SYSTEM_PROFILE_EMAIL, type LoadContext } from './context'
import { loadDocumentsForAccount, stagedByAccount } from './documents'

type Tx = Prisma.TransactionClient

export interface LoadOptions {
  phase: Phase
  runId: string
  only?: string[]
  limit?: number
  dryRun?: boolean
}

export interface AccountOutcome {
  key: string
  gtGrantId: string | null
  status: 'LOADED' | 'SKIPPED_ALREADY_LOADED' | 'HELD' | 'FAILED' | 'PLANNED' | 'NOTHING_TO_LOAD'
  reason?: string
  created?: Record<string, number>
  reusedLogin?: boolean
}

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const
const PENNY = 0.005

/** Tripwires (06 §2): pause between accounts. */
const MAX_FAILURES = 3
const MAX_FAILURE_RATE = 0.02
const MAX_CONSECUTIVE = 3

export const runDir = (runId: string) => resolve(DATA_DIR, 'runs', runId)
const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)
const today = () => new Date().toISOString().slice(0, 10)

// ── planning: canonical + reviewed calc + fresh engine run on the target ────

export interface Planned {
  hash: string
  plans: Map<string, AccountPlan>
  held: AccountOutcome[]
}

export async function planAll(ctx: LoadContext, opts: Pick<LoadOptions, 'only' | 'limit'>): Promise<Planned> {
  const { hash, dir } = latestCanonical()
  const accounts: LoadAccount[] = JSON.parse(readFileSync(resolve(dir, 'accounts.json'), 'utf8')).accounts
  const calcFile = resolve(dir, `calc-${ctx.config.env}.json`)
  if (!existsSync(calcFile)) throw new Error(`No reviewed calc for ${ctx.config.env} on ${hash}: run mig calc --env ${ctx.config.env} first`)
  const calc = JSON.parse(readFileSync(calcFile, 'utf8')) as {
    canonicalHash: string
    rows: { key: string; status: string; out?: { recommendedPayableFees: number } }[]
  }
  if (calc.canonicalHash !== hash) throw new Error(`calc-${ctx.config.env}.json is for ${calc.canonicalHash}, canonical is ${hash}`)
  const reviewed = new Map(calc.rows.map((r) => [r.key, r]))

  let selected = accounts
  if (opts.only?.length) selected = selected.filter((a) => opts.only!.includes(a.key))
  const formEid = (a: LoadAccount) => a.latest?.formEid ?? a.latest?.eid
  const forms = await readGtForms(
    resolve(EXTRACT_DIR, 'gt_forms.tsv'),
    new Set(selected.map(formEid).filter((e): e is string => Boolean(e))),
  )
  // Epic 23 T2 (D-2): the recipient's DOB where GT's Recurring forms agree.
  const dobs = await readGtDobs(
    resolve(EXTRACT_DIR, 'gt_progress.tsv'),
    resolve(EXTRACT_DIR, 'gt_forms.tsv'),
    new Set(selected.map((a) => a.gt?.id).filter((g): g is string => Boolean(g))),
  )
  const dobOf = (a: LoadAccount): string | null => {
    const v = a.gt?.id ? dobs.get(a.gt.id) : undefined
    return v?.status === 'CONSISTENT' ? v.dob : null
  }

  const plans = new Map<string, AccountPlan>()
  const held: AccountOutcome[] = []
  for (const a of selected) {
    const hold = (reason: string) => held.push({ key: a.key, gtGrantId: a.gt?.id ?? null, status: 'HELD', reason })
    if (a.excluded) continue
    const eid = formEid(a)
    const mapped = mapAssessment(a, eid ? forms.get(eid) : undefined)
    if (mapped.status !== 'MAPPED') {
      hold(`not assessable: ${mapped.reason}`)
      continue
    }
    const out = calculateAssessmentV2(mapped.input, ctx.reference)
    // A10: the load writes the numbers she reviewed; a band change since then stops it.
    const was = reviewed.get(a.key)
    if (!was || was.status !== 'CALCULATED' || !was.out) {
      hold('no reviewed calculation')
      continue
    }
    if (Math.abs(was.out.recommendedPayableFees - recommendedFromLeg(out, a.overrides?.referenceLeg)) > PENNY) {
      hold('engine result differs from the reviewed calculation (A10)')
      continue
    }
    try {
      plans.set(a.key, planAccount(a, mapped.input, out, today(), dobOf(a)))
    } catch (err) {
      if (err instanceof PlanError) hold(err.message)
      else throw err
    }
  }
  // Same lead + same child name + same DOB would trip the Contact / Application
  // unique keys: leave those DOBs blank (the twin case; none expected).
  const twins = dobCollisions(
    Array.from(plans.values()).map((p) => ({ key: p.key, leadEmail: p.leadEmail, childName: p.child.name, dob: p.child.dob })),
  )
  for (const key of twins.flat()) {
    const p = plans.get(key)!
    p.child.dob = null
    p.contact.childDob = null
    p.application.childDob = null
  }
  if (twins.length) console.log(`DOB left blank on ${twins.flat().length} accounts: same lead, child name and date (twin case)`)
  if (opts.limit != null) {
    for (const k of Array.from(plans.keys()).slice(opts.limit)) plans.delete(k)
  }
  return { hash, plans, held }
}

// ── the runner: tripwires, manifest ─────────────────────────────────────────

export async function runPhase(ctx: LoadContext, opts: LoadOptions) {
  const dir = runDir(opts.runId)
  mkdirSync(dir, { recursive: true })
  const ledger = new Ledger(ctx.prisma, opts.runId, resolve(dir, 'ledger.jsonl'))
  const { hash, plans, held } = await planAll(ctx, opts)
  const startedAt = new Date()

  console.log(
    `target: ${ctx.config.env} (${ctx.config.projectRef}) | canonical: ${hash} | run: ${opts.runId} | phase: ${opts.phase}` +
      ` | accounts: ${plans.size} | held back: ${held.length}${opts.dryRun ? ' | DRY RUN' : ''}`,
  )

  const outcomes: AccountOutcome[] = []
  if (opts.phase === 'identities') {
    await identities(ctx, ledger, plans, outcomes, opts)
  } else {
    let failures = 0
    let consecutive = 0
    const staged = opts.phase === 'documents' ? stagedByAccount(hash) : null
    const step = staged
      ? (c: LoadContext, l: Ledger, p: AccountPlan) => loadDocumentsForAccount(c, l, p, staged.get(p.key) ?? [], opts)
      : opts.phase === 'accounts'
        ? loadAccount
        : loadAssessment
    for (const plan of Array.from(plans.values())) {
      if (opts.dryRun && !staged) {
        outcomes.push({ key: plan.key, gtGrantId: plan.gtGrantId, status: 'PLANNED' })
        continue
      }
      const o = await step(ctx, ledger, plan)
      outcomes.push(o)
      if (o.status === 'FAILED') {
        failures++
        consecutive++
        console.log(`  FAILED ${plan.key} (${plan.gtGrantId ?? 'no GT id'}): ${o.reason}`)
      } else {
        consecutive = 0
      }
      if (failures > MAX_FAILURES || consecutive >= MAX_CONSECUTIVE || failures > Math.max(1, MAX_FAILURE_RATE * plans.size)) {
        console.log('TRIPWIRE: too many failures; stopping between accounts (06 §2).')
        break
      }
    }
  }

  const manifest = {
    runId: opts.runId,
    env: ctx.config.env,
    projectRef: ctx.config.projectRef,
    canonicalHash: hash,
    phase: opts.phase,
    dryRun: !!opts.dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    counts: countBy(outcomes.map((o) => o.status)),
    heldBack: held,
    outcomes,
  }
  const file = resolve(dir, `manifest-${opts.phase}${opts.dryRun ? '-dry' : ''}.json`)
  writeFileSync(file, JSON.stringify(manifest, null, 1))
  console.log(`result: ${JSON.stringify(manifest.counts)} | held back ${held.length} | manifest: ${file}`)
  return manifest
}

function countBy(xs: string[]) {
  return xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})
}

// ── identities ──────────────────────────────────────────────────────────────

async function identities(
  ctx: LoadContext,
  ledger: Ledger,
  plans: Map<string, AccountPlan>,
  outcomes: AccountOutcome[],
  opts: LoadOptions,
) {
  // B3: the login-less "Data migration" profile every created row names as its creator.
  if (!ctx.systemProfileId && !opts.dryRun) {
    const id = await ctx.prisma.$transaction(async (tx) => {
      const created = await createProfile(tx, {
        id: crypto.randomUUID(),
        email: SYSTEM_PROFILE_EMAIL,
        role: 'VIEWER',
        firstName: 'Data',
        lastName: 'migration',
      })
      if (!created.success) throw new Error(`system profile: ${created.error}`)
      await ledger.record(tx, 'identities', 'SYSTEM', [{ entityType: 'Profile', entityId: created.profile.id }])
      return created.profile.id
    }, TX_OPTIONS)
    ledger.commit()
    ctx.systemProfileId = id
  }

  // One login and profile per lead email (02 §1): 247 emails for 271 accounts.
  const byEmail = new Map<string, AccountPlan[]>()
  for (const p of Array.from(plans.values())) byEmail.set(p.leadEmail, [...(byEmail.get(p.leadEmail) ?? []), p])

  let apiErrors = 0
  for (const [email, group] of Array.from(byEmail.entries())) {
    const first = group[0]
    const key = `LEAD:${emailHash(email)}`
    const record = (o: Omit<AccountOutcome, 'key' | 'gtGrantId'>) =>
      group.forEach((p) => outcomes.push({ key: p.key, gtGrantId: p.gtGrantId, ...o }))

    const existing = await ctx.prisma.profile.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true },
    })
    if (existing) {
      if (existing.role !== 'APPLICANT') record({ status: 'FAILED', reason: 'lead email belongs to a staff profile (B4)' })
      else record({ status: 'SKIPPED_ALREADY_LOADED', reusedLogin: true })
      continue
    }
    if (opts.dryRun) {
      record({ status: 'PLANNED' })
      continue
    }

    const pendingId = `pending:${emailHash(email)}`
    const adopting = await ledger.hasIntent('AuthUser', pendingId)
    await ledger.intent('identities', key, 'AuthUser', pendingId)
    const provisioned = await provisionApplicantAuthUser(ctx.supabase, email)
    if (!provisioned.ok) {
      await ledger.cancelIntent('AuthUser', pendingId)
      record({ status: 'FAILED', reason: 'auth provisioning failed' })
      console.log(`  FAILED ${key}: ${provisioned.error.replace(/\S+@\S+/g, '<email>')}`)
      if (++apiErrors >= 2) {
        console.log('TRIPWIRE: auth admin API errors (06 §2).')
        return
      }
      continue
    }
    apiErrors = 0
    // Created now, or left behind by a crashed run of ours (its intent is still here): ours to ledger.
    const ours = provisioned.created || adopting
    if (ours) await ledger.done('identities', key, 'AuthUser', pendingId, provisioned.authUserId)
    else await ledger.cancelIntent('AuthUser', pendingId)

    try {
      await ctx.prisma.$transaction(async (tx) => {
        const made = await createProfile(tx, {
          id: provisioned.authUserId,
          email: first.contact.email,
          role: 'APPLICANT',
          firstName: first.parent.firstName ?? undefined,
          lastName: first.parent.lastName,
        })
        if (!made.success) throw new Error(made.error)
        await ledger.record(tx, 'identities', key, [{ entityType: 'Profile', entityId: made.profile.id }])
      }, TX_OPTIONS)
      ledger.commit()
      record({ status: 'LOADED', reusedLogin: !ours })
    } catch (err) {
      ledger.discard()
      record({ status: 'FAILED', reason: `profile: ${err instanceof Error ? err.message : err}` })
    }
  }
}

// ── accounts ────────────────────────────────────────────────────────────────

export async function findMigratedApplication(tx: Tx, ctx: LoadContext, plan: AccountPlan, leadId: string) {
  // The table's own key is (round, lead, childName, childDob). DOB was NULL on
  // the first loads and is still NULL where GT's dates disagree, so match on
  // name: a reload must find an earlier load's row whatever its DOB.
  return tx.application.findMany({
    where: { roundId: ctx.round.id, leadApplicantId: leadId, childName: { equals: plan.child.name, mode: 'insensitive' } },
    select: { id: true, migrationSource: true, bursaryAccountId: true, reference: true },
  })
}

export async function leadProfileId(ctx: LoadContext, plan: AccountPlan): Promise<string | null> {
  const p = await ctx.prisma.profile.findFirst({
    where: { email: { equals: plan.leadEmail, mode: 'insensitive' }, role: 'APPLICANT' },
    select: { id: true },
  })
  return p?.id ?? null
}

async function loadAccount(ctx: LoadContext, ledger: Ledger, plan: AccountPlan): Promise<AccountOutcome> {
  const base = { key: plan.key, gtGrantId: plan.gtGrantId }
  const leadId = await leadProfileId(ctx, plan)
  if (!leadId) return { ...base, status: 'HELD', reason: 'no profile yet: run identities first' }
  if (!ctx.systemProfileId) return { ...base, status: 'HELD', reason: 'no system profile: run identities first' }

  try {
    const result = await ctx.prisma.$transaction(async (tx) => {
      const existing = await findMigratedApplication(tx, ctx, plan, leadId)
      if (existing.some((a) => a.migrationSource === MIGRATION_SOURCE)) return 'SKIP' as const
      // 06 §3.8: a live application for this child in this round is a real family, not ours.
      if (existing.length > 0) throw new Error('STOP: collides with a live application (06 §3.8)')

      const created: LedgerEntry[] = []
      const contact = await tx.contact.create({
        data: { ...plan.contact, profileId: leadId, createdBy: ctx.systemProfileId! },
        select: { id: true },
      })
      created.push({ entityType: 'Contact', entityId: contact.id })

      const app = await tx.application.create({
        data: {
          ...plan.application,
          roundId: ctx.round.id,
          leadApplicantId: leadId,
          contactId: contact.id,
        },
        select: { id: true },
      })
      created.push({ entityType: 'Application', entityId: app.id })
      const contributorId = await ensurePrimaryContributor(tx, app.id, leadId)
      created.push({ entityType: 'ApplicationContributor', entityId: contributorId })

      // The same promotion a live award runs: creates the ACTIVE account,
      // links the application, generates the forward schedule.
      const promoted = await promoteToActiveAccount(
        tx,
        {
          id: app.id,
          school: plan.school,
          childName: plan.child.name,
          childDob: plan.application.childDob,
          entryYear: plan.application.entryYear,
          entryYearGroup: plan.entryYearGroup,
          bursaryAccountId: null,
          leadApplicantId: leadId,
          round: { academicYear: ctx.round.academicYear, openDate: ctx.round.openDate, closeDate: ctx.round.closeDate },
          assessment: null,
        },
        { bursaryAward: null, scholarshipAward: null },
      )
      if (!promoted.created) throw new Error('promotion reused an existing account')
      created.push({ entityType: 'BursaryAccount', entityId: promoted.bursaryAccountId })
      await tx.bursaryAccount.update({
        where: { id: promoted.bursaryAccountId },
        data: plan.account,
      })
      await tx.contact.update({ where: { id: contact.id }, data: { bursaryAccountId: promoted.bursaryAccountId } })

      await mirrorApplicationToSchedule(tx, {
        bursaryAccountId: promoted.bursaryAccountId,
        academicYear: ctx.round.academicYear,
        applicationId: app.id,
        roundId: ctx.round.id,
        status: 'COMPLETE',
      })
      const entries = await tx.bursaryScheduleEntry.findMany({
        where: { bursaryAccountId: promoted.bursaryAccountId },
        select: { id: true },
      })
      created.push(...entries.map((e) => ({ entityType: 'BursaryScheduleEntry' as const, entityId: e.id })))

      await checkAccountInvariants(tx, ctx, plan, app.id, promoted.bursaryAccountId)
      await ledger.record(tx, 'accounts', plan.key, created)
      await createAuditLog(tx, {
        userId: ctx.systemProfileId!,
        action: AUDIT_ACTIONS.DATA_MIGRATION_IMPORT,
        entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
        entityId: promoted.bursaryAccountId,
        context: 'Account loaded from Grant Tracker',
        metadata: { runId: ledger.runId, source: MIGRATION_SOURCE, gtGrantId: plan.gtGrantId },
      })
      return created
    }, TX_OPTIONS)
    if (result === 'SKIP') return { ...base, status: 'SKIPPED_ALREADY_LOADED' }
    ledger.commit()
    return { ...base, status: 'LOADED', created: countBy(result.map((e) => e.entityType)) }
  } catch (err) {
    ledger.discard()
    return { ...base, status: 'FAILED', reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 06 §1 group A, accounts phase: A1, A2, A8, A9. A9 counts rows against the
 * effective horizon: an admin may end the schedule early (Epic 21 #4,
 * `scheduleEndYear`), and Add a year moves it back towards the natural one.
 */
export async function checkAccountInvariants(tx: Tx, ctx: LoadContext, plan: AccountPlan, appId: string, accountId: string) {
  const app = await tx.application.findUniqueOrThrow({ where: { id: appId } })
  const fail = (m: string) => {
    throw new Error(`invariant ${m}`)
  }
  if (app.migrationSource !== MIGRATION_SOURCE || app.formStatus !== 'SUBMITTED' || !app.submittedAt || app.closedAt) fail('A1')
  if (app.reference !== plan.reference) fail('A2')
  if (app.bursaryAccountId !== accountId) fail('A1: account link')
  const acc = await tx.bursaryAccount.findUniqueOrThrow({ where: { id: accountId } })
  if (acc.status !== 'ACTIVE' || !acc.entryYearGroup || acc.entryYear == null) fail('A8')
  if (Math.abs(Number(acc.benchmarkPayableFees) - plan.expect.confirmedPayableFees) > PENNY) fail('A8: benchmark')
  if (plan.school === 'OP_PARTNER' && acc.annualFeesOverride == null) fail('A8: OP fee')
  const rows = await tx.bursaryScheduleEntry.findMany({ where: { bursaryAccountId: accountId }, orderBy: { scheduleYear: 'asc' } })
  const horizon = effectiveHorizon(resolveScheduleHorizon(plan.entryYearGroup, undefined, plan.school), acc.scheduleEndYear)
  if (rows.length !== horizon) fail(`A9: ${rows.length} schedule rows, expected ${horizon}`)
  const y1 = rows[0]
  if (!y1 || y1.status !== 'COMPLETE' || y1.applicationId !== appId || y1.roundId !== ctx.round.id) fail('A9: year 1')
  if (rows.slice(1).some((r) => r.status !== 'SCHEDULED')) fail('A9: later years')
}

// ── assessments ─────────────────────────────────────────────────────────────

async function loadAssessment(ctx: LoadContext, ledger: Ledger, plan: AccountPlan): Promise<AccountOutcome> {
  const base = { key: plan.key, gtGrantId: plan.gtGrantId }
  const leadId = await leadProfileId(ctx, plan)
  if (!leadId) return { ...base, status: 'HELD', reason: 'no profile yet: run identities first' }

  try {
    const result = await ctx.prisma.$transaction(async (tx) => {
      const apps = (await findMigratedApplication(tx, ctx, plan, leadId)).filter((a) => a.migrationSource === MIGRATION_SOURCE)
      if (apps.length !== 1) return 'NO_ACCOUNT' as const
      const app = apps[0]
      if (await tx.assessment.findUnique({ where: { applicationId: app.id }, select: { id: true } })) return 'SKIP' as const
      if (!isAwardFundValidForSchool(plan.assessmentLock.awardFundType, plan.school)) {
        throw new Error('award fund not offered at this school')
      }

      const created: LedgerEntry[] = []
      const assessment = await tx.assessment.create({
        data: {
          applicationId: app.id,
          assessorId: ctx.assessorId,
          calculationVersion: 2,
          status: 'IN_PROGRESS',
          scholarshipPct: plan.assessmentSave.scholarshipPct ?? 0,
          vatRate: plan.assessmentLock.vatRate,
          manualAdjustment: 0,
        },
        select: { id: true },
      })
      created.push({ entityType: 'Assessment', entityId: assessment.id })

      // The app's own v2 save: snapshot columns, earners, property, 1:1 with the form.
      await saveAssessment(tx, assessment.id, plan.assessmentSave)
      // The lock (E3), written directly in its final state; never COMPLETED.
      await tx.assessment.update({
        where: { id: assessment.id },
        data: {
          status: plan.assessmentLock.status,
          awardFundType: plan.assessmentLock.awardFundType,
          completedAt: plan.assessmentLock.completedAt,
          synopsis: plan.assessmentLock.synopsis,
          vatRate: plan.assessmentLock.vatRate,
        },
      })
      if (!app.bursaryAccountId) throw new Error('migrated application has no bursary account')
      // The account's Main synopsis, pre-filled with the composed GT synopsis (Epic 21 R1).
      // The account was created by this run's accounts phase, so a MAIN already on it is a fault.
      const entryId = await writeMainSynopsis(tx, app.bursaryAccountId, plan.assessmentLock.synopsis)
      if (!entryId) throw new Error('account already has a main synopsis')
      created.push({ entityType: 'AccountSynopsisEntry', entityId: entryId })
      const earners = await tx.assessmentEarner.findMany({ where: { assessmentId: assessment.id }, select: { id: true } })
      created.push(...earners.map((e) => ({ entityType: 'AssessmentEarner' as const, entityId: e.id })))
      const property = await tx.assessmentProperty.findUnique({ where: { assessmentId: assessment.id }, select: { id: true } })
      if (property) created.push({ entityType: 'AssessmentProperty', entityId: property.id })

      const reasonCodeIds = resolveLabels(plan.reasonLabels, ctx.reasonCodes, 'reason code')
      const gapReasonIds = resolveLabels(plan.gapLabels, ctx.gapReasons, 'gap reason')
      const rec = await upsertRecommendation(tx, assessment.id, {
        ...plan.recommendation,
        roundId: ctx.round.id,
        bursaryAccountId: app.bursaryAccountId,
        reasonCodeIds,
        gapReasonIds,
      })
      created.push({ entityType: 'Recommendation', entityId: rec.id })
      created.push(...reasonCodeIds.map((id) => ({ entityType: 'RecommendationReasonCode' as const, entityId: `${rec.id}:${id}` })))
      created.push(...gapReasonIds.map((id) => ({ entityType: 'RecommendationGapReason' as const, entityId: `${rec.id}:${id}` })))

      await checkAssessmentInvariants(tx, plan, assessment.id, plan.assessmentLock.synopsis)
      await ledger.record(tx, 'assessments', plan.key, created)
      return created
    }, TX_OPTIONS)
    if (result === 'NO_ACCOUNT') return { ...base, status: 'HELD', reason: 'no migrated application yet: run accounts first' }
    if (result === 'SKIP') return { ...base, status: 'SKIPPED_ALREADY_LOADED' }
    ledger.commit()
    return { ...base, status: 'LOADED', created: countBy(result.map((e) => e.entityType)) }
  } catch (err) {
    ledger.discard()
    return { ...base, status: 'FAILED', reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 06 §1 group A, assessments phase: A3–A7, and A12 (the account's Main
 * synopsis). A10 ran at planning; A11 is the ledger itself. `expectMainBody`
 * is passed at load only: afterwards the Main synopsis is staff's to edit.
 */
export async function checkAssessmentInvariants(tx: Tx, plan: AccountPlan, assessmentId: string, expectMainBody?: string | null) {
  const fail = (m: string) => {
    throw new Error(`invariant ${m}`)
  }
  const a = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      recommendation: { include: { reasonCodes: true, gapReasons: true } },
      application: { select: { bursaryAccountId: true } },
    },
  })
  if (a.calculationVersion !== 2 || a.status !== plan.assessmentLock.status || a.outcome != null || !a.completedAt || !a.awardFundType) fail('A3')
  const recommended = Number(a.recommendedPayableFees)
  const legs = {
    actualRemainingDi: Number(a.actualRemainingDi),
    theoreticalBenchmarkDi: Number(a.theoreticalBenchmarkDi),
    affordabilityAdjustedDi: Number(a.affordabilityAdjustedDi),
  }
  // The stored leg was rounded by the database, the recommendation by
  // `recommendedFromLeg`: on a half-penny they can sit a penny apart.
  const legTolerance = plan.expect.referenceLeg === 'ACTUAL' ? PENNY : 0.0101
  if (Math.abs(recommended - recommendedFromLeg(legs, plan.expect.referenceLeg)) > legTolerance) fail('A4')
  if (Number(a.vatRate) !== plan.expect.vatRate || Math.abs(Number(a.annualFees) - plan.expect.annualFees) > PENNY) fail('A5')
  const r = a.recommendation
  if (!r) return fail('A6: no recommendation')
  if (Math.abs(Number(r.confirmedPayableFees) - plan.expect.confirmedPayableFees) > PENNY) fail('A6: confirmed')
  if (Math.abs(Number(r.bursaryAward) - plan.expect.bursaryAward) > PENNY) fail('A6: award')
  const gap = Math.round((Number(r.confirmedPayableFees) - recommended) * 100) / 100
  if (Math.abs(Number(r.gapAmount) - gap) > PENNY) fail('A6: gap')
  if (Math.abs(gap) > 0.01 && r.gapReasons.length === 0) fail('A6: gap reason')
  if (r.reasonCodes.length === 0) fail('A6: reason code')
  const net = Number(r.netFeesBeforeVat)
  if (Math.abs(net * (1 + plan.expect.vatRate / 100) - Number(r.yearlyPayableFees)) > 1.5 && !plan.sheetArithResolved) fail('A7')
  // A12: exactly one MAIN on the account, no retired YEAR/NOTE entries.
  const accountId = a.application.bursaryAccountId
  if (!accountId) return fail('A12: no bursary account')
  const entries = await tx.accountSynopsisEntry.findMany({
    where: { bursaryAccountId: accountId },
    select: { id: true, kind: true, bursaryAccountId: true, assessmentId: true, academicYear: true, body: true },
  })
  const problem = mainSynopsisProblem(entries, accountId, expectMainBody)
  if (problem) fail(`A12: ${problem}`)
}
