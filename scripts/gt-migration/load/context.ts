/**
 * Everything a load run resolves once, before any account (04-toolkit.md §3,
 * 02-target-model.md Part 1): the owner-role client, schema guards, the
 * 2026/27 round, the assessor (B3: Charlotte's ADMIN profile), the login-less
 * "Data migration" profile (B3: createdBy / uploadedBy), the active reason and
 * gap codes, and the target's reference bands.
 */
import { PrismaClient } from '@prisma/client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getReferenceBundleRows } from '../../../src/lib/db/queries/reference-tables'
import { resolveReferenceBundle } from '../../../src/lib/assessment/v2/reference-bundle'
import type { ReferenceBundle } from '../../../src/lib/assessment/v2/types'
import type { WritableMigConfig } from '../config'

export const ROUND_ACADEMIC_YEAR = '2026/27'
/** B3. Overridable per environment with MIG_ASSESSOR_EMAIL. */
export const DEFAULT_ASSESSOR_EMAIL = 'charlotteperrier@johnwhitgiftfoundation.org'
/** B3: no auth user behind it; `.invalid` can never receive mail. */
export const SYSTEM_PROFILE_EMAIL = 'data-migration@system.invalid'

export interface LoadContext {
  config: WritableMigConfig
  prisma: PrismaClient
  supabase: SupabaseClient
  round: { id: string; academicYear: string; openDate: Date | null; closeDate: Date | null }
  assessorId: string
  systemProfileId: string | null
  reasonCodes: { id: string; label: string }[]
  gapReasons: { id: string; label: string }[]
  reference: ReferenceBundle
}

/** PR-C / PR-D objects the load writes. Missing ⇒ the M1 PRs are not on this environment yet. */
async function assertSchema(prisma: PrismaClient, env: string) {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'migration_source')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_migration_ledger')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bursary_accounts' AND column_name = 'annual_fees_override')
      AND EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'School' AND e.enumlabel = 'OP_PARTNER')
      AS ok`
  if (!rows[0]?.ok) {
    throw new Error(`${env} lacks the M1 schema (PR-C / PR-D). Merge them and run prisma migrate deploy there first.`)
  }
}

export async function openContext(
  config: WritableMigConfig,
  opts: { requireSchema?: boolean } = {},
): Promise<LoadContext> {
  const prisma = new PrismaClient({ datasourceUrl: config.directUrl, log: ['error'] })
  // Only `mig plan` (read-only) may run before the M1 schema is on the target.
  if (opts.requireSchema !== false) await assertSchema(prisma, config.env)

  const rounds = await prisma.round.findMany({
    where: { academicYear: ROUND_ACADEMIC_YEAR },
    select: { id: true, academicYear: true, openDate: true, closeDate: true },
  })
  if (rounds.length !== 1) throw new Error(`Expected one ${ROUND_ACADEMIC_YEAR} round on ${config.env}, found ${rounds.length}`)

  const assessorEmail = process.env.MIG_ASSESSOR_EMAIL ?? DEFAULT_ASSESSOR_EMAIL
  const assessor = await prisma.profile.findFirst({
    where: { email: { equals: assessorEmail, mode: 'insensitive' } },
    select: { id: true, role: true },
  })
  if (!assessor || assessor.role !== 'ADMIN') throw new Error(`Assessor (B3) is not an ADMIN profile on ${config.env}`)

  const system = await prisma.profile.findUnique({ where: { email: SYSTEM_PROFILE_EMAIL }, select: { id: true } })

  const [reasonCodes, gapReasons] = await Promise.all([
    prisma.reasonCode.findMany({ where: { isDeprecated: false }, select: { id: true, label: true } }),
    prisma.gapReason.findMany({ where: { isDeprecated: false }, select: { id: true, label: true } }),
  ])

  const rows = await prisma.$transaction((tx) => getReferenceBundleRows(tx))
  const resolved = resolveReferenceBundle(rows)
  if (!resolved.isComplete) throw new Error(`Reference data incomplete on ${config.env}: ${resolved.missingTables.join(', ')}`)

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return {
    config,
    prisma,
    supabase,
    round: rounds[0],
    assessorId: assessor.id,
    systemProfileId: system?.id ?? null,
    reasonCodes,
    gapReasons,
    reference: resolved.bundle,
  }
}
