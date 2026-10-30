/**
 * Child date of birth from Grant Tracker (Epic 23 T2; her 16 Oct option (b)).
 *
 * GT keeps the recipient's date of birth only on the Recurring Annual form, as
 * the top-level "Date of birth" control (no grid). The same control name also
 * sits inside the dependent children / elderly grids, which are other people.
 * A form's eid is a `gt_progress` id; that row's `grant` is the account's GT id.
 *
 * Rule (D-2): normalise every value to an ISO date first, then one distinct
 * date across all of the account's Recurring forms = consistent. Several
 * dates = conflict (left blank, on her list). New awards have no Recurring
 * form, so none. Pure apart from the streaming reader at the end.
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export const DOB_FORM_TYPE = 'Recurring Annual Bursary Assessment - V1'
export const DOB_CONTROL = 'Date of birth'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function iso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * A GT date value → "YYYY-MM-DD", or null when empty / a placeholder / not a date.
 * Seen in the extract: SQL Server's "May 12 2015 12:00AM" (day space-padded:
 * "May  2 2015 12:00AM") and "{Value:null}". Also accepted, in case a later
 * extract differs: ISO, "12/05/2015" (UK day-first) and "12 May 2015".
 */
export function parseGtDob(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!t || t.startsWith('{')) return null
  let m = t.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})(?: \d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)? ?(?:AM|PM)?)?$/i)
  if (m) {
    const mon = MONTHS.indexOf(m[1].toLowerCase())
    return mon < 0 ? null : iso(+m[3], mon + 1, +m[2])
  }
  m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/)
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase())
    return mon < 0 ? null : iso(+m[3], mon + 1, +m[1])
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return iso(+m[3], +m[2], +m[1])
  return null
}

/** One `gt_forms.tsv` row (ftype, eid, grid, row, control, rid, val) → is it the recipient's DOB? */
export function isRecipientDobRow(cols: readonly string[]): boolean {
  return cols.length >= 7 && cols[0].trim() === DOB_FORM_TYPE && cols[2].trim() === '' && cols[4].trim() === DOB_CONTROL
}

export type DobVerdict =
  | { status: 'CONSISTENT'; dob: string; forms: number }
  | { status: 'CONFLICT'; dates: string[]; forms: number }
  | { status: 'NONE'; forms: number }

/** Every DOB value found on one account's Recurring forms → the verdict (D-2). */
export function dobVerdict(values: readonly (string | null | undefined)[]): DobVerdict {
  const dates = Array.from(new Set(values.map(parseGtDob).filter((d): d is string => d != null))).sort()
  if (dates.length === 0) return { status: 'NONE', forms: values.length }
  if (dates.length === 1) return { status: 'CONSISTENT', dob: dates[0], forms: values.length }
  return { status: 'CONFLICT', dates, forms: values.length }
}

/** "YYYY-MM-DD" → the Date Prisma writes to a `@db.Date` column (UTC midnight). */
export function dobAsDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

/**
 * Two accounts of one lead with the same child name AND the same DOB would
 * collide on Contact (profileId, childName, childDob) and Application
 * (round, lead, childName, childDob) once DOB is set: the twin-name case. Returns
 * the account keys involved (empty = safe).
 */
export function dobCollisions(
  accounts: readonly { key: string; leadEmail: string; childName: string; dob: string | null }[],
): string[][] {
  const groups = new Map<string, string[]>()
  for (const a of accounts) {
    if (!a.dob) continue
    const k = `${a.leadEmail.trim().toLowerCase()}|${a.childName.trim().toLowerCase()}|${a.dob}`
    groups.set(k, [...(groups.get(k) ?? []), a.key])
  }
  return Array.from(groups.values()).filter((g) => g.length > 1)
}

/**
 * Streams `gt_progress.tsv` (id, grant, …) and `gt_forms.tsv` once and returns
 * a verdict for each wanted GT grant id (absent grants → NONE).
 */
export async function readGtDobs(
  progressPath: string,
  formsPath: string,
  grantIds: ReadonlySet<string>,
): Promise<Map<string, DobVerdict>> {
  const grantOfForm = new Map<string, string>()
  const progress = createInterface({ input: createReadStream(progressPath, 'utf8'), crlfDelay: Infinity })
  for await (const line of progress) {
    const cols = line.split('\t')
    if (cols.length >= 2 && grantIds.has(cols[1].trim())) grantOfForm.set(cols[0].trim(), cols[1].trim())
  }
  const values = new Map<string, string[]>()
  const forms = createInterface({ input: createReadStream(formsPath, 'utf8'), crlfDelay: Infinity })
  for await (const line of forms) {
    const cols = line.split('\t')
    if (!isRecipientDobRow(cols)) continue
    const grant = grantOfForm.get(cols[1].trim())
    if (!grant) continue
    values.set(grant, [...(values.get(grant) ?? []), cols[6]])
  }
  const out = new Map<string, DobVerdict>()
  for (const g of Array.from(grantIds)) out.set(g, dobVerdict(values.get(g) ?? []))
  return out
}
