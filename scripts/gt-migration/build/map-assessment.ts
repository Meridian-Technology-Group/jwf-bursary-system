/**
 * GT assessment form → `AssessmentV2Input` (03-field-mapping.md §3–§4).
 *
 * Pure: no DB, no filesystem. Given one canonical account and the GT control
 * values of its latest assessment, returns the engine input plus a list of
 * provenance notes explaining every place the input deliberately departs
 * from what Grant Tracker computed. The notes carry control names and rules,
 * never names or figures, so they are safe to log.
 *
 * Verified against the 10 Sep extract before this was written: the income
 * sum below reproduces GT's own TOTAL HOUSEHOLD NET INCOME (post court
 * settlement) on 270/270 accounts, and home/other equity and savings
 * reproduce GT's section totals on 270/270.
 */
import type { AssessmentV2Input } from '../../../src/lib/assessment/v2/orchestrator'
import type { RentAddBackType } from '../../../src/lib/assessment/v2/types'
import type { PropertyPortfolioType } from '../../../src/lib/assessment/v2/profiling'
import { DEBT_REPAYMENT_YEARS } from '../../../src/lib/assessment/v2/debt'
import { getTotalSchoolingYears } from '../../../src/lib/assessment/schooling-years'
import type {
  AssessorIncomeRecord,
  DebtsRecord,
  PropertyAssetsRecord,
} from '../../../src/types/assessment-v2'

/** The subset of a `canonical/<hash>/accounts.json` row the mapper reads. */
export interface CanonicalAccount {
  key: string
  school: 'TRINITY' | 'WHITGIFT' | 'OP_PARTNER'
  type: string
  sheetYear: number
  fees: number
  scholPct: number
  award: number
  payable: number
  flags: readonly string[]
  latest?: { eid?: string } | null
  /** Her schedule's family type, as typed ("2"). The fallback when GT holds none. */
  sheetFamilyType?: string | number | null
}

/** GT control name → every value recorded against it on the assessment. */
export type Controls = ReadonlyMap<string, readonly string[]>

/**
 * C12. GT's "yearly loan/lease repayment" controls: GT itself summed them
 * with the credit-card BALANCE into "Debts other than foundation" and divided
 * that by schooling years (144/144 accounts), i.e. it treated the figure as a
 * balance. `AS_ENTERED` reproduces GT; `TIMES_REPAYMENT_YEARS` reads the label
 * literally and converts yearly → balance over the model's 5-year horizon.
 */
export type DebtTreatment = 'AS_ENTERED' | 'TIMES_REPAYMENT_YEARS'

/** C7. Where a figure in "other properties" goes. */
export type OtherPropertyTreatment = 'ONE_SECOND_PROPERTY' | 'PORTFOLIO'

/** C5. What to do with a +12,000/+15,000 rent-free marker in income support. */
export type RentFreeTreatment = 'RENT_FREE_ADD_BACK' | 'KEEP_AS_INCOME'

export interface MappingRules {
  debt: DebtTreatment
  otherProperty: OtherPropertyTreatment
  rentFree: RentFreeTreatment
  /** C16 (new). Owner with no mortgage → the model's mortgage-free rent add-back. */
  mortgageFreeAddBack: boolean
  /** S24. Sibling net payable fees she has supplied, in order. Empty = none. */
  siblingPayableFees: readonly number[]
}

/**
 * The "Proposed" column of the 22 Sep pack, except C12 (Brian, 24 Sep: take
 * loan/lease figures as GT entered them, since GT treated them as balances),
 * plus C16 (Brian, 24 Sep: yes, subject to her confirmation).
 */
export const DEFAULT_RULES: MappingRules = {
  debt: 'AS_ENTERED',
  otherProperty: 'ONE_SECOND_PROPERTY',
  rentFree: 'RENT_FREE_ADD_BACK',
  mortgageFreeAddBack: true,
  siblingPayableFees: [],
}

export const RENT_FREE_MARKERS: readonly number[] = [12000, 15000]
export const VAT_RATE_STANDARD = 20
/** Old Palace: no VAT, bursary ends at Year 11. */
export const OP_VAT_RATE = 0
export const OP_FINAL_YEAR = 11

export type MapResult =
  | { status: 'MAPPED'; input: AssessmentV2Input; notes: string[] }
  | { status: 'NOT_ASSESSED'; reason: 'PASTORAL_BOARDER' | 'NO_FORM_DATA' | 'NO_FAMILY_TYPE' }

const isFamilyType = (n: number) => Number.isInteger(n) && n >= 1 && n <= 6

// ── control names, exactly as GT stores them ────────────────────────────────
const EARNER_UPPER = {
  netPay: 'yearly net pay',
  companyProfits: 'yearly company profits',
  pensionP60: 'pension amount as stated on p60',
  pensionPayments: 'yearly pension payments',
  taxCredits: 'tax credits',
  hbOrUc: 'yearly hb or uc entitlement',
  jsa: 'yearly jsa',
  disability: 'yearly disability allowance',
  incomeSupport: 'yearly income support',
  otherBenefits: 'other benefits',
} as const
const EARNER_LOWER = {
  seSalary: 'net salary if self employed/director',
  dividends: 'net dividends',
  childBenefit: 'child benefits',
  housingBenefit: 'housing benefits',
} as const

export const C = {
  familyType: 'ENTER A FIGURE BETWEEN 1 AND 6',
  maintenance: 'YEARLY CHILD MAINTENANCE SUPPORT',
  friendsFamily: 'Friends and Family Arrangements Total',
  propertyIncome: 'ADD BACK IN THE ADDITIONAL YEARLY PROPERTY INCOME',
  homeValue: 'APPROX VALUE OF OWNED HOME',
  homeMortgage: 'OUTSTANDING MORTGAGE BALANCE',
  otherValue: 'TOTAL VALUE OF ANY OTHER PROPERTIES OWNED (IN THE UK OR ABROAD)',
  otherMortgage: 'OTHER OUTSTANDING MORTGAGE BALANCES',
  cash: 'CASH SAVINGS AT THE BANK',
  isas: 'TOTAL IN ISAS, PEPS, SHARES',
  cars: 'ENTER NUMBER OF CARS',
  creditCards: 'ENTER TOTAL CC DEBT BALANCE',
  loans: 'ENTER YEARLY LOAN REPAYMENTS OR REMAINDER IF LESS THAN 12 INSTL.',
  leases: 'ENTER YEARLY LEASE REPAYMENTS OR REMAINDER IF LESS THAN 12 INSTL.',
  foundationDebt: 'ENTER THE TOTAL DEBT ON THE DATE OF THE ASSESSMENT',
  // comparison anchors (never inputs)
  gtIncomePostCourt: 'TOTAL HOUSEHOLD NET INCOME',
  gtIncomePreCourt: 'TOTAL HOUSEHOLD NET INCOME (pre Court Settlement)',
} as const

const earnerControl = (who: 'First' | 'Second', suffix: string, lower: boolean) =>
  `${who} ${lower ? 'earner' : 'Earner'} ${suffix}`

/** First numeric value recorded for a control; 0 when absent or non-numeric. */
export function num(controls: Controls, name: string): number {
  const raw = controls.get(name)?.[0]
  if (raw == null) return 0
  const n = parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Schooling years left INCLUDING 2026-27 — her 22 Sep rule: entry year = 2026-27 year. */
export function schoolingYearsRemaining(account: CanonicalAccount): number {
  const total = getTotalSchoolingYears(account.sheetYear)
  if (account.school !== 'OP_PARTNER') return total
  return Math.max(0, Math.min(total, OP_FINAL_YEAR - account.sheetYear + 1))
}

function earnerRecord(controls: Controls, who: 'First' | 'Second', rules: MappingRules, notes: string[]) {
  const up = (k: keyof typeof EARNER_UPPER) => num(controls, earnerControl(who, EARNER_UPPER[k], false))
  const lo = (k: keyof typeof EARNER_LOWER) => num(controls, earnerControl(who, EARNER_LOWER[k], true))

  let incomeSupport = up('incomeSupport')
  let rentFreeMarker = 0
  if (rules.rentFree === 'RENT_FREE_ADD_BACK' && RENT_FREE_MARKERS.includes(incomeSupport)) {
    rentFreeMarker = incomeSupport
    incomeSupport = 0
    notes.push(`C5: ${who.toLowerCase()} earner income support is the rent-free marker; removed from income, rent added back instead`)
  }

  const values = {
    annualSalaryPaye: up('netPay'),
    grossSalaried: lo('seSalary'),
    dividends: lo('dividends'),
    otherInvestmentIncome: up('companyProfits'),
    privatePension: up('pensionP60'),
    statePension: up('pensionPayments'),
    childWorkingTaxCredit: up('taxCredits'),
    universalCredit: up('hbOrUc'),
    jsa: up('jsa'),
    pipOrDla: up('disability'),
    childBenefit: lo('childBenefit'),
    housingBenefit: lo('housingBenefit'),
    other: incomeSupport + up('otherBenefits'),
  }
  const any = Object.values(values).some((v) => v !== 0)
  return { values, any, rentFreeMarker }
}

function toIncomeRecord(v: ReturnType<typeof earnerRecord>['values']): AssessorIncomeRecord {
  const record: AssessorIncomeRecord = { total: 0, documentsConfirmed: true }
  if (v.annualSalaryPaye) record.employed = { annualSalaryPaye: v.annualSalaryPaye }
  if (v.grossSalaried || v.dividends || v.otherInvestmentIncome) {
    record.selfEmployed = {
      grossSalaried: v.grossSalaried,
      propertyIncome: 0,
      dividends: v.dividends,
      otherInvestmentIncome: v.otherInvestmentIncome,
    }
  }
  if (v.privatePension || v.statePension) {
    record.retired = { statePension: v.statePension, privatePension: v.privatePension }
  }
  if (v.jsa) record.unemployed = { finalGrossPay: 0, redundancy: 0, jsa: v.jsa, grantSupport: 0, leavePay: 0 }
  const benefits = v.universalCredit + v.childBenefit + v.housingBenefit + v.childWorkingTaxCredit + v.pipOrDla + v.other
  if (benefits) {
    record.benefits = {
      universalCredit: v.universalCredit,
      housingBenefit: v.housingBenefit,
      childBenefit: v.childBenefit,
      childWorkingTaxCredit: v.childWorkingTaxCredit,
      esa: 0,
      pipOrDla: v.pipOrDla,
      carersAllowance: 0,
      childcareSupport: 0,
      other: v.other,
    }
  }
  return record
}

export function mapAssessment(
  account: CanonicalAccount,
  controls: Controls | undefined,
  rules: MappingRules = DEFAULT_RULES,
): MapResult {
  if (account.flags.includes('PB_NO_GT')) return { status: 'NOT_ASSESSED', reason: 'PASTORAL_BOARDER' }
  if (!controls || controls.size === 0) return { status: 'NOT_ASSESSED', reason: 'NO_FORM_DATA' }

  const notes: string[] = []

  // ── income (§3) ──────────────────────────────────────────────────────────
  const first = earnerRecord(controls, 'First', rules, notes)
  const second = earnerRecord(controls, 'Second', rules, notes)
  const earner1 = toIncomeRecord(first.values)

  const maintenance = num(controls, C.maintenance)
  if (maintenance) earner1.divorcedSeparated = { maintenanceReceived: maintenance, sharedCustodyNote: '' }

  const friendsFamily = num(controls, C.friendsFamily)
  if (friendsFamily) {
    earner1.thirdParty = { incomeSupportReceived: friendsFamily, supportNote: '', numberOfKidsDivisor: 1 }
  }

  const propertyIncome = num(controls, C.propertyIncome)
  if (propertyIncome) {
    earner1.selfEmployed = {
      grossSalaried: earner1.selfEmployed?.grossSalaried ?? 0,
      dividends: earner1.selfEmployed?.dividends ?? 0,
      otherInvestmentIncome: earner1.selfEmployed?.otherInvestmentIncome ?? 0,
      propertyIncome,
    }
    notes.push('§3: additional property income counted as income; GT left it out of its income total')
  }

  const earners = second.any ? [earner1, toIncomeRecord(second.values)] : [earner1]
  const rentFree = first.rentFreeMarker > 0 || second.rentFreeMarker > 0

  // ── property (§4, C7, C16) ──────────────────────────────────────────────
  const home = { value: num(controls, C.homeValue), mortgageBalance: num(controls, C.homeMortgage) }
  const other = { value: num(controls, C.otherValue), mortgageBalance: num(controls, C.otherMortgage) }
  const propertyAssets: PropertyAssetsRecord = {}
  if (home.value || home.mortgageBalance) propertyAssets.home = home

  let portfolioType: PropertyPortfolioType = home.value > 0 ? 'SINGLE' : 'RENTING'
  if (other.value || other.mortgageBalance) {
    // The engine classifies DOUBLE from `second` and MULTIPLE from `other`;
    // equity sums all three, so only the category depends on this choice.
    if (rules.otherProperty === 'PORTFOLIO') {
      propertyAssets.other = other
      portfolioType = 'MULTIPLE'
    } else {
      propertyAssets.second = other
      portfolioType = 'DOUBLE'
    }
    notes.push(`C7: other properties treated as ${rules.otherProperty === 'PORTFOLIO' ? 'a portfolio' : 'one second property'}`)
  }
  propertyAssets.portfolioType = portfolioType

  let rentAddBackType: RentAddBackType = 'NONE'
  if (rentFree) {
    rentAddBackType = 'FULL_RENT_FREE'
  } else if (rules.mortgageFreeAddBack && home.value > 0 && home.mortgageBalance === 0) {
    rentAddBackType = 'FULL_MORTGAGE_FREE'
    notes.push('C16: owns the home outright; mortgage-free rent add-back applied')
  }

  // ── debt (§4, C12) ───────────────────────────────────────────────────────
  const factor = rules.debt === 'TIMES_REPAYMENT_YEARS' ? DEBT_REPAYMENT_YEARS : 1
  const loans = num(controls, C.loans)
  const leases = num(controls, C.leases)
  const debts: DebtsRecord = {
    creditCards: num(controls, C.creditCards),
    loans: loans * factor,
    leaseBalances: leases * factor,
    schoolFeesOwedOrOther: num(controls, C.foundationDebt),
  }
  if ((loans || leases) && factor !== 1) {
    notes.push(`C12: loan/lease figures multiplied by ${factor} to convert a yearly repayment to a balance`)
  }

  let familyTypeCategory = num(controls, C.familyType)
  if (!isFamilyType(familyTypeCategory)) {
    const fromSheet = Number(account.sheetFamilyType)
    if (!isFamilyType(fromSheet)) {
      return { status: 'NOT_ASSESSED', reason: 'NO_FAMILY_TYPE' }
    }
    familyTypeCategory = fromSheet
    notes.push('§4: GT holds no family type; taken from her schedule')
  }

  const isOp = account.school === 'OP_PARTNER'
  const input: AssessmentV2Input = {
    earners,
    manualAdjustment: 0,
    familyTypeCategory,
    rentAddBackType,
    multiPropertyRentAddBack: false,
    councilTaxSupport: false,
    usesCar: num(controls, C.cars) > 0,
    usesPublicTransport: false,
    feeInsuranceAnnual: 0,
    cashSavings: num(controls, C.cash),
    isasPepsShares: num(controls, C.isas),
    schoolingYearsRemaining: schoolingYearsRemaining(account),
    propertyAssets,
    portfolioType,
    debts,
    siblingPayableFees: rules.siblingPayableFees,
    annualFees: account.fees,
    scholarshipPct: account.scholPct,
    bursaryAwardBeforeVat: account.award,
    nextYearFees: account.fees,
    vatRate: isOp ? OP_VAT_RATE : VAT_RATE_STANDARD,
    confirmedPayableFees: account.payable,
  }
  return { status: 'MAPPED', input, notes }
}

/** GT's own figures, for the reconciliation checks (R1/R2). Never engine inputs. */
export function gtComparison(controls: Controls) {
  return {
    incomePostCourt: num(controls, C.gtIncomePostCourt),
    incomePreCourt: num(controls, C.gtIncomePreCourt),
  }
}
