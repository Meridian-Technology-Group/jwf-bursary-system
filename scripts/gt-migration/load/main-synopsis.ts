/**
 * The account's Main synopsis (Epic 21 #6 rework, R1, 14 Oct 2026).
 *
 * One editable MAIN entry per bursary account (`account_synopsis_entries`,
 * kind MAIN, assessment_id and academic_year NULL; one per account by the
 * partial unique index `account_synopsis_entries_one_main_per_account`). For a
 * migrated account the toolkit pre-fills it with the composed Grant Tracker
 * synopsis; from then on it belongs to staff. YEAR and NOTE are retired kinds:
 * nothing writes them, and a migrated account must carry none.
 *
 * The load (assessments phase) and `mig backfill-synopsis` both write it here.
 */
import type { Prisma } from '@prisma/client'
import { mainSynopsisSeed } from '../../../src/lib/bursary-accounts/standing-synopsis'

type Tx = Prisma.TransactionClient

/** The fields the checks below read; a subset of an `AccountSynopsisEntry`. */
export interface SynopsisEntryShape {
  id: string
  kind: string
  bursaryAccountId: string
  assessmentId: string | null
  academicYear: string | null
  body: string
}

/** The account's MAIN entry, if it has one (the index allows at most one). */
export async function findMainSynopsis(tx: Tx, bursaryAccountId: string) {
  return tx.accountSynopsisEntry.findFirst({ where: { bursaryAccountId, kind: 'MAIN' }, select: { id: true } })
}

/**
 * Writes the account's MAIN entry from the synopsis and returns its id for the
 * ledger, or null when the account already has a MAIN (the caller decides
 * whether that is a skip or a fault). A blank synopsis throws: every migrated
 * account carries a composed synopsis, so blank means a broken plan. No author:
 * a system write. A concurrent MAIN trips the partial unique index (P2002),
 * which fails the caller's transaction rather than writing a second one.
 */
export async function writeMainSynopsis(tx: Tx, bursaryAccountId: string, synopsis: string | null | undefined) {
  const body = mainSynopsisSeed(synopsis)
  if (!body) throw new Error('blank synopsis: no main synopsis written')
  if (await findMainSynopsis(tx, bursaryAccountId)) return null
  const entry = await tx.accountSynopsisEntry.create({
    data: { bursaryAccountId, kind: 'MAIN', body, assessmentId: null, academicYear: null, createdById: null },
    select: { id: true },
  })
  return entry.id
}

/**
 * Invariant A12 over an account's synopsis entries: exactly one MAIN, on this
 * account, with no assessment or academic year, and no YEAR (or NOTE) entry.
 * `expectBody` is checked only at load, when the toolkit has just written it;
 * afterwards the Main synopsis is staff's to edit, so `verify` omits it.
 * Returns the failure, or null.
 */
export function mainSynopsisProblem(
  entries: SynopsisEntryShape[],
  bursaryAccountId: string,
  expectBody?: string | null,
): string | null {
  const mains = entries.filter((e) => e.kind === 'MAIN')
  const retired = entries.filter((e) => e.kind !== 'MAIN')
  if (retired.length) return `${retired.length} retired ${retired.map((e) => e.kind).join('/')} entr${retired.length === 1 ? 'y' : 'ies'}`
  if (mains.length !== 1) return `${mains.length} main synopsis entries, expected 1`
  const m = mains[0]
  if (m.bursaryAccountId !== bursaryAccountId) return 'main synopsis on another account'
  if (m.assessmentId != null || m.academicYear != null) return 'main synopsis carries an assessment or academic year'
  if (expectBody !== undefined) {
    const want = mainSynopsisSeed(expectBody)
    if (want && m.body !== want) return 'main synopsis differs from the composed synopsis'
  }
  return null
}
