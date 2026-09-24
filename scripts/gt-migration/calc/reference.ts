/**
 * Loads the v2 `ReferenceBundle` from the target database through the same
 * two functions the assessment page uses (`getReferenceBundleRows` then
 * `resolveReferenceBundle`), so a calc run uses exactly the bands an assessor
 * on that environment would see. Read-only.
 */
import { PrismaClient } from '@prisma/client'
import { getReferenceBundleRows } from '../../../src/lib/db/queries/reference-tables'
import { resolveReferenceBundle } from '../../../src/lib/assessment/v2/reference-bundle'
import type { ReferenceBundle } from '../../../src/lib/assessment/v2/types'
import type { MigConfig } from '../config'

export async function loadReferenceBundle(config: MigConfig): Promise<ReferenceBundle> {
  const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl, log: ['error'] })
  try {
    const rows = await prisma.$transaction(async (tx) => {
      // Same claim as withAdminContext: the runtime role is under RLS.
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', jsonb_build_object('role', 'service_role'::text)::text, true)`
      return getReferenceBundleRows(tx)
    })
    const resolved = resolveReferenceBundle(rows)
    if (!resolved.isComplete) {
      throw new Error(`Reference data incomplete on ${config.env}: ${resolved.missingTables.join(', ')}`)
    }
    return resolved.bundle
  } finally {
    await prisma.$disconnect()
  }
}
