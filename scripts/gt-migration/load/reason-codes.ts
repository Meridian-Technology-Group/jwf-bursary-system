/**
 * Reason-code crosswalk (03-field-mapping.md §6, decision C8) and the gap-code
 * rule (S19). Pure.
 *
 * Everything here is a LABEL without its display number ("Salary increase",
 * not "14 - Salary increase"): the numbers moved when her 43-code list landed
 * (PR-A) and may move again, so the loader resolves labels to ids against the
 * target database at load time, never by number.
 */

/** GT's old number → the new list's label. 29 has no clean match (C8). */
const GT_TO_LABEL: Record<number, string> = {
  1: 'No real change',
  2: 'Property asset has increased in value',
  3: 'New property asset acquired',
  4: 'Increased savings',
  6: 'Salary increase',
  8: 'Additional family member since last year',
  9: 'Divorce or separation',
  11: 'Severe Illness',
  14: 'Sudden unemployment',
  15: 'New job and increased pay',
  16: 'New job and decreased pay',
  17: 'Increase in Benefits',
  18: 'Inheritance',
  19: 'Bonus change year on year',
  28: 'Self-employed net profit decrease',
  32: 'Other',
  34: 'Decreased savings',
  35: 'Stopped qualifying for some benefits',
  77: 'Self-employed net profit increase',
}

export const FIRST_ASSESSMENT = 'No year on year comparison, first assessment'
export const MAJOR_INCOME = 'Major change in income'
export const MAJOR_ASSETS = 'Major change in assets'
export const OTHER = 'Other'

export const GAP_IMMATERIAL = 'Immaterial gap, less than £100'
export const GAP_FALLBACK = 'Original Old Assessment Benchmark (year 2020)'
/** S19: under £100 is immaterial; the app still requires a code above 1p. */
export const IMMATERIAL_BELOW = 100
export const GAP_TOLERANCE = 0.01

/** "14 - Salary increase" → "Salary increase". */
export function stripDisplayNumber(label: string): string {
  return label.replace(/^\s*\d+\s*[-–]\s*/, '').trim()
}

export interface ReasonInput {
  /** Her sheet's "Year On Year Bursary Award Change" cell, as typed. */
  yoyCodes: string | null | undefined
  majorIncome: string | null | undefined
  majorAssets: string | null | undefined
  /** New award (or PB): first assessment, no year-on-year comparison. */
  isNew: boolean
  /** Labels her rulings add (e.g. C40, sibling fees taking up NDI). */
  addLabels?: readonly string[]
}

export interface ReasonResult {
  labels: string[]
  /** GT values with no clean match; they load as "Other" and are listed in the report. */
  unmapped: string[]
}

export function crosswalkReasonCodes(input: ReasonInput): ReasonResult {
  const labels: string[] = []
  const unmapped: string[] = []
  const add = (l: string) => {
    if (!labels.includes(l)) labels.push(l)
  }

  if (input.isNew) {
    add(FIRST_ASSESSMENT)
  } else {
    for (const token of (input.yoyCodes ?? '').split(/[;,]/)) {
      const t = token.trim()
      if (!t || t.toLowerCase() === 'n/a') continue
      const n = Number(t.match(/^(\d+)/)?.[1])
      const label = Number.isFinite(n) ? GT_TO_LABEL[n] : undefined
      if (label) add(label)
      else {
        unmapped.push(t)
        add(OTHER)
      }
    }
  }
  if ((input.majorIncome ?? '').trim().toLowerCase() === 'yes') add(MAJOR_INCOME)
  if ((input.majorAssets ?? '').trim().toLowerCase() === 'yes') add(MAJOR_ASSETS)
  for (const l of input.addLabels ?? []) add(stripDisplayNumber(l))
  // A recommendation needs at least one reason code (06 A6).
  if (labels.length === 0) add(input.isNew ? FIRST_ASSESSMENT : OTHER)
  return { labels, unmapped }
}

/**
 * S19: her pick from the reconciliation report wins; otherwise under £100 is
 * immaterial, anything larger falls back to the 2020 benchmark code. No code
 * when the gap is within a penny.
 */
export function gapReasonLabel(gapAmount: number | null, herPick?: string | null): string | null {
  return gapReasonLabels(gapAmount, herPick ? [herPick] : [])[0] ?? null
}

/**
 * Phase 2 (7 Oct on): her returned report often gives several gap reasons for
 * one account, and all of them load. Same rule as `gapReasonLabel`: none
 * within a penny (even where she coded one, e.g. "Immaterial" on a £0 gap);
 * her picks when she gave any; otherwise the immaterial or fallback code.
 */
export function gapReasonLabels(gapAmount: number | null, herPicks: readonly string[] = []): string[] {
  if (gapAmount == null || Math.abs(gapAmount) <= GAP_TOLERANCE) return []
  const picks = Array.from(new Set(herPicks.map(stripDisplayNumber).filter(Boolean)))
  if (picks.length) return picks
  return [Math.abs(gapAmount) < IMMATERIAL_BELOW ? GAP_IMMATERIAL : GAP_FALLBACK]
}

/** Resolve labels against the target's active codes. Throws on any miss. */
export function resolveLabels(
  labels: readonly string[],
  active: readonly { id: string; label: string }[],
  kind: string,
): string[] {
  const byText = new Map(active.map((r) => [stripDisplayNumber(r.label).toLowerCase(), r.id]))
  return labels.map((l) => {
    const id = byText.get(l.toLowerCase())
    if (!id) throw new Error(`No active ${kind} labelled "${l}" on the target`)
    return id
  })
}
