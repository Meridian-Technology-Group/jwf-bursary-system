/**
 * `mig calc`: runs `calculateAssessmentV2` for every account in the current
 * canonical build and writes `canonical/<hash>/calc-<env>[-<variant>].json`.
 *
 * The output holds figures and is written only under DATA_DIR. Console output
 * is counts and account-key hashes only.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateAssessmentV2, type AssessmentV2Output } from '../../../src/lib/assessment/v2/orchestrator'
import { DATA_DIR, EXTRACT_DIR, type MigConfig } from '../config'
import { readGtForms } from '../build/gt-forms'
import {
  mapAssessment,
  gtComparison,
  DEFAULT_RULES,
  type CanonicalAccount,
  type MappingRules,
} from '../build/map-assessment'
import { loadReferenceBundle } from './reference'

/** Legs closer than this to her payable fees count as "matching" (S19). */
const CLOSE_ENOUGH = 100

export interface CalcRow {
  key: string
  status: 'CALCULATED' | 'NOT_ASSESSED' | 'ERROR'
  reason?: string
  notes?: string[]
  gt?: { incomePostCourt: number; incomePreCourt: number }
  out?: Pick<
    AssessmentV2Output,
    | 'householdNetIncome'
    | 'totalNotionalSpend'
    | 'ndiAfterNotionalSpend'
    | 'derivedYearlyDebtRepayments'
    | 'debtOverNdiRatio'
    | 'debtStatusLabel'
    | 'incomeCategory'
    | 'propertyCategoryDerived'
    | 'propertyEquityCategory'
    | 'financialEquityLabel'
    | 'lifestyleSqueezeLabel'
    | 'actualRemainingDi'
    | 'theoreticalBenchmarkDi'
    | 'affordabilityAdjustedDi'
    | 'recommendedPayableFees'
  > & { gapAmount: number | null; yearlyPayableFeesInclVat: number | null; closestLeg: string; closestLegDistance: number }
}

export function latestCanonical(): { hash: string; dir: string } {
  const root = resolve(DATA_DIR, 'canonical')
  const dirs = readdirSync(root)
    .map((d) => ({ d, t: statSync(resolve(root, d, 'accounts.json')).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!dirs.length) throw new Error(`No canonical build under ${root}`)
  return { hash: dirs[0].d, dir: resolve(root, dirs[0].d) }
}

/**
 * S19: which leg her payable fees sit closest to. Each leg is floored at £0,
 * as the recommendation is, so a family she charges £0 whose actual leg is
 * negative counts as matching the actual leg, not whichever leg is nearest zero.
 */
function closestLeg(payable: number, out: AssessmentV2Output) {
  const legs: [string, number][] = [
    ['actual', Math.max(0, out.actualRemainingDi)],
    ['theoretical', Math.max(0, out.theoreticalBenchmarkDi)],
    ['affordability', Math.max(0, out.affordabilityAdjustedDi)],
  ]
  legs.sort((a, b) => Math.abs(a[1] - payable) - Math.abs(b[1] - payable))
  return { closestLeg: legs[0][0], closestLegDistance: Math.abs(legs[0][1] - payable) }
}

export async function runCalc(config: MigConfig, rules: MappingRules = DEFAULT_RULES, variant?: string) {
  const { hash, dir } = latestCanonical()
  const accounts: CanonicalAccount[] = JSON.parse(readFileSync(resolve(dir, 'accounts.json'), 'utf8')).accounts
  console.log(`target: ${config.env} (${config.projectRef}) | canonical: ${hash} | accounts: ${accounts.length}`)
  console.log(`rules: ${JSON.stringify({ ...rules, siblingPayableFees: rules.siblingPayableFees.length })}`)

  const ref = await loadReferenceBundle(config)
  const eids = new Set(accounts.map((a) => a.latest?.eid).filter((e): e is string => Boolean(e)))
  const forms = await readGtForms(resolve(EXTRACT_DIR, 'gt_forms.tsv'), eids)

  const rows: CalcRow[] = accounts.map((account) => {
    const controls = account.latest?.eid ? forms.get(account.latest.eid) : undefined
    const mapped = mapAssessment(account, controls, rules)
    if (mapped.status === 'NOT_ASSESSED') return { key: account.key, status: 'NOT_ASSESSED', reason: mapped.reason }
    try {
      const out = calculateAssessmentV2(mapped.input, ref)
      return {
        key: account.key,
        status: 'CALCULATED',
        notes: mapped.notes,
        gt: controls ? gtComparison(controls) : undefined,
        out: {
          householdNetIncome: out.householdNetIncome,
          totalNotionalSpend: out.totalNotionalSpend,
          ndiAfterNotionalSpend: out.ndiAfterNotionalSpend,
          derivedYearlyDebtRepayments: out.derivedYearlyDebtRepayments,
          debtOverNdiRatio: out.debtOverNdiRatio,
          debtStatusLabel: out.debtStatusLabel,
          incomeCategory: out.incomeCategory,
          propertyCategoryDerived: out.propertyCategoryDerived,
          propertyEquityCategory: out.propertyEquityCategory,
          financialEquityLabel: out.financialEquityLabel,
          lifestyleSqueezeLabel: out.lifestyleSqueezeLabel,
          actualRemainingDi: out.actualRemainingDi,
          theoreticalBenchmarkDi: out.theoreticalBenchmarkDi,
          affordabilityAdjustedDi: out.affordabilityAdjustedDi,
          recommendedPayableFees: out.recommendedPayableFees,
          gapAmount: out.awardSummary?.gapAmount ?? null,
          yearlyPayableFeesInclVat: out.awardSummary?.yearlyPayableFeesInclVat ?? null,
          ...closestLeg(account.payable, out),
        },
      }
    } catch (err) {
      return { key: account.key, status: 'ERROR', reason: err instanceof Error ? err.message : String(err) }
    }
  })

  const file = resolve(dir, `calc-${config.env}${variant ? `-${variant}` : ''}.json`)
  writeFileSync(file, JSON.stringify({ canonicalHash: hash, env: config.env, rules, builtAt: new Date().toISOString(), rows }, null, 1))

  const count = (s: CalcRow['status']) => rows.filter((r) => r.status === s).length
  const calculated = rows.filter((r) => r.status === 'CALCULATED')
  console.log(`calculated ${count('CALCULATED')} | not assessed ${count('NOT_ASSESSED')} | errors ${count('ERROR')}`)
  rows.filter((r) => r.status === 'ERROR').forEach((r) => console.log(`  error ${r.key}: ${r.reason}`))
  const within = calculated.filter((r) => r.out && r.out.gapAmount !== null && Math.abs(r.out.gapAmount) < CLOSE_ENOUGH).length
  console.log(`gap under £${CLOSE_ENOUGH}: ${within}/${calculated.length}`)
  console.log(`written: ${file}`)
  return { file, rows }
}
