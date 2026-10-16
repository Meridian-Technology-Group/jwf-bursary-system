/**
 * GT migration toolkit — command router (04-toolkit.md §2).
 *
 *   npm run mig -- calc     --env <e> [--debt as-entered|x5] [--mortgage-free on|off] [--variant <name>]
 *   npm run mig -- docs-extract [--only k1,k2]               (M8: decrypt + reconcile; no database)
 *   npm run mig -- load     --env <e> --phase identities|accounts|assessments|documents --run <id>
 *                           [--only k1,k2] [--limit n] [--dry-run]
 *   npm run mig -- plan     --env <e> [--only k1,k2] [--out plans.json]  (read-only preview)
 *   npm run mig -- verify   --env <e> --run <id>
 *   npm run mig -- rollback --env <e> --run <id> [--phase <p>] [--only k1,k2] [--dry-run]
 *   npm run mig -- backfill-synopsis --env <e> --run <id> [--only k1,k2] [--dry-run]
 *                           (Epic 21 R1: the account's Main synopsis for accounts
 *                            loaded before it existed; skips any account that has
 *                            one; ledgered under the run)
 *   npm run mig -- patch-dob --env <e> --run <id> [--only k1,k2] [--dry-run] [--undo] [--blank-list <csv>]
 *                           (Epic 23 T2: child DOB from GT's Recurring forms
 *                            where NULL; raw SQL, no updated_at moves; undo
 *                            log in runs/<id>/patch-dob.jsonl)
 *   npm run mig -- export-statistical --env <e> [--out <file.xlsx>]
 *                           (Epic 23 T5: Export Section 3 of the migrated
 *                            2026/27 assessments; read-only; 0600 file)
 *
 * <e> is nonprod | rehearsal | prod. The target's database URLs are pinned
 * into the process environment BEFORE any app module is imported (they are
 * imported dynamically below): the app's shared Prisma client reads
 * DATABASE_URL at start-up, and Prisma would otherwise fall back to the stale
 * `.env`. Prod writes refuse without an approval in STATE.json for this exact
 * (env, canonical hash, phase).
 *
 * --debt defaults to as-entered (C12, Brian 24 Sep).
 * --mortgage-free defaults to off (C16 declined per account, 25 Sep).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DATA_DIR, loadConfig, MIG_ENVS, requireWritable, type MigConfig, type MigEnv } from './config'

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (args: string[], name: string) => args.includes(`--${name}`)
const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)

function pinEnvironment(config: MigConfig) {
  process.env.DATABASE_URL = config.databaseUrl
  if (config.directUrl) process.env.DIRECT_URL = config.directUrl
  if (config.supabaseUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = config.supabaseUrl
  if (config.serviceRoleKey) process.env.SUPABASE_SERVICE_ROLE_KEY = config.serviceRoleKey
}

/** Prod: an approval for this (env, hash, phase) must already be in STATE.json. */
function assertApproved(env: MigEnv, hash: string, phase: string) {
  if (env !== 'prod') return
  const file = resolve(DATA_DIR, 'STATE.json')
  const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const approvals: { env: string; hash: string; phase: string }[] = state.approvals ?? []
  if (!approvals.some((a) => a.env === 'prod' && a.hash === hash && a.phase === phase)) {
    throw new Error(`Refusing: no approval in STATE.json for prod / ${hash} / ${phase}.`)
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'docs-extract') {
    const { extractDocuments } = await import('./docs/extract')
    await extractDocuments({ only: list(flag(args, 'only')) })
    return
  }
  const env = flag(args, 'env') as MigEnv | undefined
  if (!env || !MIG_ENVS.includes(env)) throw new Error(`--env ${MIG_ENVS.join('|')} is required`)
  const config = loadConfig(env)
  pinEnvironment(config)

  switch (command) {
    case 'calc': {
      const { runCalc } = await import('./calc/run')
      const { DEFAULT_RULES } = await import('./build/map-assessment')
      const rules = { ...DEFAULT_RULES }
      const debt = flag(args, 'debt')
      if (debt === 'as-entered') rules.debt = 'AS_ENTERED'
      else if (debt === 'x5') rules.debt = 'TIMES_REPAYMENT_YEARS'
      else if (debt) throw new Error('--debt as-entered|x5')
      const mortgageFree = flag(args, 'mortgage-free')
      if (mortgageFree === 'on') rules.mortgageFreeAddBack = true
      else if (mortgageFree && mortgageFree !== 'off') throw new Error('--mortgage-free on|off')
      await runCalc(config, rules, flag(args, 'variant'))
      return
    }
    case 'load': {
      const phase = flag(args, 'phase')
      if (phase !== 'identities' && phase !== 'accounts' && phase !== 'assessments' && phase !== 'documents') {
        throw new Error('--phase identities|accounts|assessments|documents')
      }
      const runId = flag(args, 'run')
      if (!runId) throw new Error('--run <id> is required (e.g. rh-r1-20260929)')
      const { latestCanonical } = await import('./calc/run')
      const dryRun = has(args, 'dry-run')
      if (!dryRun) assertApproved(env, latestCanonical().hash, phase)
      const { openContext } = await import('./load/context')
      const { runPhase } = await import('./load/phases')
      const ctx = await openContext(requireWritable(config))
      try {
        const limit = flag(args, 'limit')
        await runPhase(ctx, { phase, runId, only: list(flag(args, 'only')), limit: limit ? Number(limit) : undefined, dryRun })
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'plan': {
      // Read-only: plan every account against the target's reference data and
      // report what would load and what is held back, and why.
      const { openContext } = await import('./load/context')
      const { planAll } = await import('./load/phases')
      const ctx = await openContext(requireWritable(config), { requireSchema: false })
      try {
        const { hash, plans, held } = await planAll(ctx, { only: list(flag(args, 'only')) })
        const reasons = held.reduce<Record<string, number>>((m, h) => ((m[h.reason ?? '?'] = (m[h.reason ?? '?'] ?? 0) + 1), m), {})
        const unmapped = Array.from(plans.values()).filter((p) => p.unmappedReasons.length).length
        const gaps = Array.from(plans.values()).reduce<Record<string, number>>((m, p) => {
          for (const g of p.gapLabels.length ? p.gapLabels : ['(no gap)']) m[g] = (m[g] ?? 0) + 1
          return m
        }, {})
        const fromM5 = Array.from(plans.values()).filter((p) => p.reasonsFrom === 'M5').length
        console.log(`target: ${env} (${config.projectRef}) | canonical: ${hash}`)
        console.log(`plannable: ${plans.size} | held back: ${held.length} ${JSON.stringify(reasons)}`)
        console.log(`logins: ${new Set(Array.from(plans.values()).map((p) => p.leadEmail)).size} | with an unmapped GT reason code: ${unmapped}`)
        console.log(`reason + gap codes from her returned report: ${fromM5} | from the GT crosswalk and fallback: ${plans.size - fromM5}`)
        console.log(`gap codes (an account can carry several): ${JSON.stringify(gaps)}`)
        // --out: every plan as JSON (account keys, no logs), to diff a re-plan against an earlier one.
        const out = flag(args, 'out')
        if (out) {
          const { writeFileSync } = await import('node:fs')
          const sorted = Array.from(plans.values()).sort((x, y) => x.key.localeCompare(y.key))
          writeFileSync(out, JSON.stringify({ env, canonical: hash, plans: sorted, held }, null, 1), { mode: 0o600 })
          console.log(`plans written: ${out}`)
        }
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'verify': {
      const runId = flag(args, 'run')
      if (!runId) throw new Error('--run <id> is required')
      const { openContext } = await import('./load/context')
      const { verify } = await import('./load/verify')
      const ctx = await openContext(requireWritable(config))
      try {
        const ok = await verify(ctx, runId)
        if (!ok) process.exitCode = 2
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'rollback': {
      const runId = flag(args, 'run')
      if (!runId) throw new Error('--run <id> is required')
      const phase = flag(args, 'phase') as 'identities' | 'accounts' | 'assessments' | 'documents' | undefined
      const dryRun = has(args, 'dry-run')
      if (!dryRun && env === 'prod') {
        throw new Error('Refusing: a prod rollback needs Brian\'s approval for this run id (06 §4), recorded first.')
      }
      const { openContext } = await import('./load/context')
      const { rollback } = await import('./load/rollback')
      const ctx = await openContext(requireWritable(config))
      try {
        await rollback(ctx, { runId, phase, only: list(flag(args, 'only')), dryRun })
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'backfill-synopsis': {
      const runId = flag(args, 'run')
      if (!runId) throw new Error('--run <id> is required')
      const dryRun = has(args, 'dry-run')
      if (!dryRun) {
        const { latestCanonical } = await import('./calc/run')
        assertApproved(env, latestCanonical().hash, 'backfill-synopsis')
      }
      const { openContext } = await import('./load/context')
      const { backfillSynopsis } = await import('./load/backfill-synopsis')
      const ctx = await openContext(requireWritable(config))
      try {
        await backfillSynopsis(ctx, { runId, only: list(flag(args, 'only')), dryRun })
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'patch-dob': {
      const runId = flag(args, 'run')
      if (!runId) throw new Error('--run <id> is required')
      const dryRun = has(args, 'dry-run')
      if (!dryRun) {
        const { latestCanonical } = await import('./calc/run')
        assertApproved(env, latestCanonical().hash, 'patch-dob')
      }
      const { openContext } = await import('./load/context')
      const { patchDob } = await import('./load/patch-dob')
      const ctx = await openContext(requireWritable(config))
      try {
        await patchDob(ctx, { runId, only: list(flag(args, 'only')), dryRun, undo: has(args, 'undo'), blankList: flag(args, 'blank-list') })
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    case 'export-statistical': {
      // Read-only: Export Section 3 of the migrated accounts (Epic 23 T5).
      const { openContext } = await import('./load/context')
      const { exportStatistical } = await import('./load/export-statistical')
      const ctx = await openContext(requireWritable(config))
      try {
        await exportStatistical(ctx, { out: flag(args, 'out') })
      } finally {
        await ctx.prisma.$disconnect()
      }
      return
    }
    default:
      throw new Error(`Unknown command: ${command ?? '(none)'}. Available: docs-extract, calc, plan, load, verify, rollback, backfill-synopsis, patch-dob, export-statistical`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
