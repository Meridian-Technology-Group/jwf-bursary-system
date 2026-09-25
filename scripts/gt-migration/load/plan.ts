/**
 * One migrated account, planned row by row (02-target-model.md Part 1).
 *
 * Pure: canonical account + mapped engine input + engine output → the values
 * every row will carry. The phases add ids and write; nothing here touches a
 * database. Names, emails and figures stay inside the returned plan and are
 * never logged.
 */
import type { AssessmentV2Input, AssessmentV2Output } from '../../../src/lib/assessment/v2/orchestrator'
import type { AssessmentSaveInput } from '../../../src/lib/db/queries/assessments'
import type { UpsertRecommendationInput } from '../../../src/lib/db/queries/recommendations'
import { computeGapAmount } from '../../../src/lib/assessment/recommendation-v2'
import { dominantEmploymentStatus } from '../../../src/lib/assessment/v2/employment-status'
import { calculateEarnerIncome } from '../../../src/lib/assessment/v2/income'
import { schoolVatRate } from '../../../src/lib/schools'
import type { AwardFundType, EntryYearGroup, School } from '@prisma/client'
import type { CanonicalAccount } from '../build/map-assessment'
import { crosswalkReasonCodes, gapReasonLabel } from './reason-codes'

/** The canonical fields the loader reads beyond what the mapper needs. */
export interface LoadAccount extends CanonicalAccount {
  reference: string
  referenceCorrected?: string | null
  email: string
  surname: string | null
  forenames: string | null
  parent?: { title: string | null; firstName: string | null; lastName: string; source: string } | null
  monthly: number
  fund: string
  majorIncome?: string | null
  majorAssets?: string | null
  yoyCodes?: string | null
  addReasonCodes?: string[]
  synopsis?: string | null
  siblings?: { name: string; gtFees: number }[]
  latest?: { completed?: string; received?: string; eid?: string; formEid?: string } | null
  gt?: { id: string } | null
  /** Her pick from the returned reconciliation report (S19), when ingested. */
  gapCode?: string | null
  held?: string | null
  /** Flags her rulings settled, flag → decision id. */
  resolved?: Record<string, string>
}

export const MIGRATION_SOURCE = 'GRANT_TRACKER'
export const ENTRY_YEAR = 2026

export type LockStatus = 'ROLLED_OVER' | 'NEW_AWARD'

export interface AccountPlan {
  key: string
  gtGrantId: string | null
  /** The lead's email as matched (lower-cased); one login + profile per email. */
  leadEmail: string
  parent: { title: string | null; firstName: string | null; lastName: string }
  child: { firstName: string | null; lastName: string | null; name: string; dob: null }
  school: School
  entryYearGroup: EntryYearGroup
  isNew: boolean
  reference: string
  submittedAt: Date
  contact: {
    title: string | null
    firstName: string | null
    lastName: string
    email: string
    childFirstName: string | null
    childLastName: string | null
    childName: string
    school: School
    situation: 'NEW' | 'ROLLING_OVER'
    entryYear: number
    entryYearGroup: EntryYearGroup
    notes: string
  }
  application: {
    reference: string
    school: School
    childName: string
    childFirstName: string | null
    childLastName: string | null
    entryYear: number
    entryYearGroup: EntryYearGroup
    applicationType: 'NEW' | 'ROLLING_OVER'
    isReassessment: boolean
    formStatus: 'SUBMITTED'
    submittedAt: Date
    migrationSource: string
  }
  assessmentSave: AssessmentSaveInput
  assessmentLock: {
    status: LockStatus
    awardFundType: AwardFundType
    completedAt: Date
    synopsis: string
    vatRate: number
  }
  recommendation: Omit<UpsertRecommendationInput, 'roundId' | 'bursaryAccountId'>
  reasonLabels: string[]
  gapLabel: string | null
  unmappedReasons: string[]
  account: { benchmarkPayableFees: number; annualFeesOverride: number | null }
  /** R3 / A7: her sheet's arithmetic was off and she ruled on it. */
  sheetArithResolved: boolean
  /** Figures the in-transaction checks compare against (06 §1 group A). */
  expect: {
    recommendedPayableFees: number
    confirmedPayableFees: number
    bursaryAward: number
    annualFees: number
    vatRate: number
    gapAmount: number | null
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** "16 May 2026" or "2026-04-15" → Date at noon UTC (a date, not a moment). */
export function parseGtDate(s: string | null | undefined): Date | null {
  const t = (s ?? '').trim()
  if (!t) return null
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = iso ? new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12)) : new Date(`${t} 12:00:00 UTC`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function composeSynopsis(
  gtText: string | null | undefined,
  completed: string | null | undefined,
  today: string,
  received?: string | null,
): string {
  const footer =
    `Migrated from Grant Tracker on ${today}.` +
    (completed ? ` GT assessment completed ${completed}.` : received ? ` GT holds no completion date; the review was received ${received}.` : '') +
    ' Figures recalculated by the current model from GT inputs; award and payable fees as confirmed by the Head of Fees & Bursaries.'
  const body = (gtText ?? '').trim()
  return body ? `${body}\n\n— ${footer}` : `— ${footer}`
}

export class PlanError extends Error {}

export function planAccount(
  a: LoadAccount,
  input: AssessmentV2Input,
  out: AssessmentV2Output,
  today: string,
): AccountPlan {
  if (a.excluded) throw new PlanError('excluded by ruling')
  if (a.held) throw new PlanError('held: ruling unclear')
  if (!a.parent?.lastName) throw new PlanError('no parent surname')
  if (!a.surname) throw new PlanError('no pupil name')
  if (a.sheetYear < 6 || a.sheetYear > 13) throw new PlanError(`school year ${a.sheetYear} out of range`)
  if (a.fund === 'PB') throw new PlanError('pastoral boarder: not migrated (C3)')

  const isNew = a.type === 'New award'
  if (!isNew && a.type !== 'Rolling-over') throw new PlanError(`unexpected bursary type ${a.type}`)
  const school = a.school
  const entryYearGroup = `Y${a.sheetYear}` as EntryYearGroup
  const childFirstName = a.forenames || null
  const childLastName = a.surname
  const childName = [childFirstName, childLastName].filter(Boolean).join(' ')
  const reference = a.referenceCorrected ?? a.reference
  // NO_COMPLETION_DATE: GT left it blank; the review's received date stands in.
  const completedAt = parseGtDate(a.latest?.completed) ?? parseGtDate(a.latest?.received)
  if (!completedAt) throw new PlanError('no GT completion or received date')
  const vatRate = schoolVatRate(school)
  if (input.vatRate !== vatRate) throw new PlanError(`mapper VAT ${input.vatRate} ≠ school VAT ${vatRate}`)

  const summary = out.awardSummary
  if (!summary) throw new PlanError('engine produced no award summary')
  const recommended = out.recommendedPayableFees
  const gapAmount = computeGapAmount(a.payable, recommended)
  const { labels: reasonLabels, unmapped } = crosswalkReasonCodes({
    yoyCodes: a.yoyCodes,
    majorIncome: a.majorIncome,
    majorAssets: a.majorAssets,
    isNew,
    addLabels: a.addReasonCodes,
  })
  const gapLabel = gapReasonLabel(gapAmount, a.gapCode)

  const siblingNames = (a.siblings ?? []).map((s) => s.name).filter(Boolean)
  const suppliedFees = a.overrides?.siblings ?? []
  const siblingDetails = siblingNames.length || suppliedFees.length
    ? Array.from({ length: Math.max(siblingNames.length, suppliedFees.length) }, (_, i) => ({
        name: suppliedFees[i]?.name ?? siblingNames[i] ?? '',
        school: null,
        netPayableFees: suppliedFees[i]?.payableFees ?? null,
      }))
    : null

  const assessmentSave: AssessmentSaveInput = {
    familyTypeCategory: input.familyTypeCategory,
    annualFees: a.fees,
    // 02 §5: no 2027/28 fee row exists; the award summary falls back to the current-year fee.
    nextYearAnnualFees: null,
    assessmentSchool: school,
    entrySchoolYear: a.sheetYear,
    scholarshipPct: a.scholPct,
    schoolingYearsRemaining: input.schoolingYearsRemaining,
    vatRate,
    rentAddBackType: input.rentAddBackType,
    rentAddBackOverride: input.rentAddBackOverride ?? null,
    multiPropertyRentAddBack: input.multiPropertyRentAddBack,
    councilTaxSupport: input.councilTaxSupport,
    councilTaxOverride: null,
    postcode: null,
    usesCar: input.usesCar,
    usesPublicTransport: input.usesPublicTransport,
    feeInsuranceAnnual: input.feeInsuranceAnnual,
    behindOnFees: false,
    manualAdjustment: input.manualAdjustment,
    manualAdjustmentReason: null,
    dishonestyFlag: false,
    siblingDetails,
    // the snapshot, 1:1 as the v2 form saves it
    totalHouseholdNetIncome: out.householdNetIncome,
    notionalEssentials: out.notionalEssentials,
    notionalCar: out.notionalCar,
    notionalPublicTransport: out.notionalPublicTransport,
    notionalJwfAllowance: out.notionalJwfAllowance,
    notionalSavingsBenchmark: out.notionalSavingsBenchmark,
    savingsTestNumber: out.savingsTestNumber,
    totalNotionalSpend: out.totalNotionalSpend,
    ndiAfterNotionalSpend: out.ndiAfterNotionalSpend,
    derivedYearlyDebtRepayments: out.derivedYearlyDebtRepayments,
    yearlyDebtExposure: out.yearlyDebtExposure,
    debtOverNdiRatio: out.debtOverNdiRatio,
    debtStatusLabel: out.debtStatusLabel,
    incomeCategory: out.incomeCategory,
    propertyCategoryDerived: out.propertyCategoryDerived,
    propertyEquityCategory: out.propertyEquityCategory,
    financialEquityLabel: out.financialEquityLabel,
    lifestyleSqueezeRatio: out.lifestyleSqueezeRatio,
    lifestyleSqueezeLabel: out.lifestyleSqueezeLabel,
    actualRemainingDi: out.actualRemainingDi,
    theoreticalBenchmarkDi: out.theoreticalBenchmarkDi,
    affordabilityAdjustedDi: out.affordabilityAdjustedDi,
    recommendedPayableFees: recommended,
    earnersV2: input.earners.map((rec, i) => ({
      earnerLabel: i === 0 ? 'PARENT_1' : 'PARENT_2',
      employmentStatus: dominantEmploymentStatus(rec),
      // `total` is the stored back-compat figure (assessment_earners.total_income);
      // the engine sums the sub-tables itself, so this is display only.
      incomeDetail: { ...rec, total: calculateEarnerIncome(rec) },
    })),
    propertyV2: {
      propertyAssets: { ...input.propertyAssets, portfolioType: input.portfolioType },
      debts: input.debts,
      cashSavings: input.cashSavings,
      isasPepsShares: input.isasPepsShares,
      schoolAgeChildrenCount: 0,
      derivedSavingsAnnualTotal: out.adjustedSavings,
    },
  }

  return {
    key: a.key,
    gtGrantId: a.gt?.id ?? null,
    leadEmail: a.email.trim().toLowerCase(),
    parent: { title: a.parent.title, firstName: a.parent.firstName, lastName: a.parent.lastName },
    child: { firstName: childFirstName, lastName: childLastName, name: childName, dob: null },
    school,
    entryYearGroup,
    isNew,
    reference,
    submittedAt: completedAt,
    contact: {
      title: a.parent.title,
      firstName: a.parent.firstName,
      lastName: a.parent.lastName,
      email: a.email.trim(),
      childFirstName,
      childLastName,
      childName,
      school,
      situation: isNew ? 'NEW' : 'ROLLING_OVER',
      entryYear: ENTRY_YEAR,
      entryYearGroup,
      notes: `Migrated from Grant Tracker ${today}`,
    },
    application: {
      reference,
      school,
      childName,
      childFirstName,
      childLastName,
      entryYear: ENTRY_YEAR,
      entryYearGroup,
      applicationType: isNew ? 'NEW' : 'ROLLING_OVER',
      isReassessment: !isNew,
      formStatus: 'SUBMITTED',
      submittedAt: completedAt,
      migrationSource: MIGRATION_SOURCE,
    },
    assessmentSave,
    assessmentLock: {
      status: isNew ? 'NEW_AWARD' : 'ROLLED_OVER',
      awardFundType: a.fund as AwardFundType,
      completedAt,
      synopsis: composeSynopsis(a.synopsis, a.latest?.completed, today, a.latest?.received),
      vatRate,
    },
    recommendation: {
      bursaryAward: a.award,
      bursarySpendBeforeVat: a.award,
      scholarshipSpendBeforeVat: round2(summary.scholarshipSpendBeforeVat),
      netFeesBeforeVat: round2(summary.netFeesBeforeVat),
      yearlyPayableFees: a.payable,
      confirmedPayableFees: a.payable,
      monthlyPayableFees: a.monthly,
      recommendedPayableFees: recommended,
      gapAmount,
      lastPayableFees: null,
      incomeCategory: out.incomeCategory == null ? null : String(out.incomeCategory),
      propertyCategory: out.propertyCategoryDerived ?? null,
      familySynopsis: null,
    },
    reasonLabels,
    gapLabel,
    unmappedReasons: unmapped,
    account: {
      benchmarkPayableFees: a.payable,
      annualFeesOverride: school === 'OP_PARTNER' ? a.fees : null,
    },
    sheetArithResolved: Boolean(a.resolved?.SHEET_ARITH),
    expect: {
      recommendedPayableFees: recommended,
      confirmedPayableFees: a.payable,
      bursaryAward: a.award,
      annualFees: a.fees,
      vatRate,
      gapAmount,
    },
  }
}
