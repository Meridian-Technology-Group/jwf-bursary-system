/**
 * TypeScript interfaces for each ApplicationSection's JSONB data shape.
 *
 * These types represent what is stored in ApplicationSection.data (Prisma Json).
 * Each interface corresponds to one ApplicationSectionType enum value.
 */

// ─── Section 1: Child Details ─────────────────────────────────────────────────

export type School = "TRINITY" | "WHITGIFT";

export interface ChildAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
}

export interface ChildDetailsData {
  /** School applying for */
  school: School;
  /** Year group the child enters at (Y6/Y7/Y9/Y12/Other). Per §4 spec. */
  entryYearGroup: EntryYearGroup;
  /** Child's full legal name */
  childFullName: string;
  /** Gender */
  gender: string;
  /** ISO date string YYYY-MM-DD */
  dateOfBirth: string;
  /** Country of birth */
  placeOfBirth: string;
  /** Document slot ID for birth certificate */
  birthCertificateDocumentId?: string;
  /** Whether child lives at same address as Parent 1 */
  sameAddressAsParent1: boolean;
  /** Child's separate address (only when sameAddressAsParent1 = false) */
  childAddress?: ChildAddress;
  /** School the child currently attends */
  currentSchool: string;
  /** ISO date string for when child started current school */
  currentSchoolStartDate: string;
}

// ─── Section 2: Family ID ─────────────────────────────────────────────────────

export interface FamilyMemberIdentity {
  id: string;
  familyMemberName: string;
  /**
   * CHILD/GUARDIAN = the auto-added, always-required child and parent/guardian
   * named on the application; OTHER = an additional dependent added by the
   * applicant (Q1). Optional for back-compat with pre-Q1 blobs.
   */
  role?: "CHILD" | "GUARDIAN" | "OTHER";
  /** Child vs adult — only used for OTHER rows (Q1). */
  memberType?: "CHILD" | "ADULT";
  isBritishCitizen: boolean;
  /** Document slot ID for UK passport (when British citizen) */
  ukPassportDocumentId?: string;
  /** Document slot ID for passport (when not British citizen) */
  passportDocumentId?: string;
  /** Document slot ID for ILR evidence (when not British citizen) */
  ilrDocumentId?: string;
}

export interface FamilyIdData {
  familyMembers: FamilyMemberIdentity[];
}

// ─── Section 3: Parent Details ────────────────────────────────────────────────

export type RelationshipStatus =
  | "SINGLE"
  | "MARRIED"
  | "WIDOWED"
  | "SEPARATED"
  | "DIVORCED"
  | "CIVIL_PARTNERSHIP"
  | "COHABITING";

/**
 * Portal-side employment status — a 3-way classifier the applicant picks on the
 * Parent/Guardian Details page. The granular income breakdown (PAYE, benefits,
 * self-employed, pensions, JSA, …) is captured in the Income section; the
 * assessor sets the per-earner `EmploymentStatus` (assessment_earners) enum
 * independently, so these two are intentionally decoupled.
 */
export type EmploymentStatus =
  | "UNEMPLOYED_OR_RETIRED"
  | "EMPLOYED"
  | "SELF_EMPLOYED";

/** Self-employment position (when status === "SELF_EMPLOYED"). */
export type SelfEmploymentPosition = "DIRECTOR" | "PARTNER" | "SOLE_TRADER";

/**
 * The school year-group the child enters at. Mandated by §4 of the
 * spec; admin-side `Application.entryYear` (calendar Int) is set by the
 * invitation flow and is independent of this field.
 */
export type EntryYearGroup = "Y6" | "Y7" | "Y9" | "Y12" | "OTHER";

export type ParentTitle = "MR" | "MRS" | "MS" | "MISS" | "DR" | "PROF" | "OTHER";

export interface ParentContactDetails {
  title: ParentTitle;
  firstName: string;
  lastName: string;
  telephone?: string;
  telephone2?: string;
  mobile?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
}

export interface ParentEmploymentDetails {
  status: EmploymentStatus;
  /** Profession/business/trade (for employed / self-employed) */
  profession?: string;
  /** Employer name and address (EMPLOYED) */
  employerAddress?: string;
  /** Director of the employing company? (EMPLOYED) */
  isDirector?: boolean;
  /** Shareholding percentage (when director, EMPLOYED) */
  sharePercentage?: string;
  /** Self-employment company name (SELF_EMPLOYED) */
  selfEmploymentCompanyName?: string;
  /** Self-employment position (SELF_EMPLOYED) */
  selfEmploymentPosition?: SelfEmploymentPosition;
  /** Left employment in the last 12 months? (all statuses) */
  leftEmployment?: boolean;
  /** Document slot: P45 (when leftEmployment) — shared with the Income section */
  p45DocumentId?: string;
  /** Received a redundancy / severance package? (when leftEmployment) */
  receivedRedundancy?: boolean;
  /** Document slot: redundancy evidence — shared with the Income section */
  redundancyDocumentId?: string;
  /** Declaration accepted */
  declarationAccepted?: boolean;
}

export interface ParentDetailsData {
  isSoleParent: boolean;
  relationshipStatus: RelationshipStatus;
  parent1Contact: ParentContactDetails;
  parent1Employment: ParentEmploymentDetails;
  parent2Contact?: ParentContactDetails;
  parent2Employment?: ParentEmploymentDetails;
}

// ─── Section 4: Dependent Children ───────────────────────────────────────────

export interface DependentChild {
  id: string;
  name: string;
  /** ISO date string */
  dependentStatusDate?: string;
  surnameOtherParent?: string;
  school?: string;
  schoolAddress?: string;
  isNamedChild?: boolean;
}

export interface DependentChildrenData {
  numberOfDependentChildren: number;
  children: DependentChild[];
}

// ─── Section 5: Dependent Elderly ────────────────────────────────────────────

export interface ElderlyDependant {
  id: string;
  firstName: string;
  middleNames?: string;
  surname: string;
  /** ISO date string */
  dateOfBirth?: string;
  isOver100: boolean;
  /** Care home fields */
  careHomeName?: string;
  careHomeFees?: number;
  /** Document slot: care home invoice */
  careHomeInvoiceDocumentId?: string;
}

export interface DependentElderlyData {
  hasElderlyAtHome: boolean;
  elderlyAtHomeCount?: number;
  elderlyAtHome: ElderlyDependant[];
  hasElderlyInCare: boolean;
  elderlyInCareCount?: number;
  elderlyInCare: ElderlyDependant[];
}

// ─── Section 6: Other Info ────────────────────────────────────────────────────

export interface OtherInfoData {
  hasCOurtOrder: boolean;
  courtOrderTermAmount?: number;
  courtOrderYearAmount?: number;
  /** Which school year the court-order amount relates to (workbook §5 Q1). */
  courtOrderSchoolYear?: string;
  courtOrderDocumentId?: string;
  /** School/maintenance payment doc slot */
  maintenancePaymentDocumentId?: string;
  /** Child maintenance branch (workbook §5 Q2). */
  hasChildMaintenance?: boolean;
  /** "You" pay maintenance to the other parent, or "EX_PARTNER" pays you. */
  maintenancePayer?: "YOU" | "EX_PARTNER";
  /** When YOU pay: are you divorced (→ decree absolute) or separated (→ agreement note). */
  maintenanceIsDivorced?: boolean;
  maintenanceDecreeAbsoluteDocumentId?: string;
  maintenanceAgreementNote?: string;
  hasInsurancePolicy: boolean;
  insurancePolicyAmount?: number;
  /** Which school year the insurance policy relates to (workbook §5 Q3). */
  insurancePolicySchoolYear?: string;
  insurancePolicyStartDate?: string;
  insurancePolicyEndDate?: string;
  insurancePolicyDocumentId?: string;
  hasOutstandingFees: boolean;
  outstandingFeesSchoolName?: string;
  outstandingFeesAmount?: number;
}

// ─── Section 7: Parents' Income ───────────────────────────────────────────────
//
// Status-driven sub-tables (workbook §6, decision D3). The flat 14-line model is
// replaced with discrete sub-blocks per income type; each parent's column shows
// the sub-blocks relevant to them. The legacy flat shape
// (`LegacyParentIncomeRecord`) is retained for the back-compat reader so old
// drafts and submitted applications still read (see lib/portal/income-model.ts).

/** Employed (PAYE) — annual salary as on P60; P60 or March payslip required. */
export interface EmployedIncome {
  /** Annual salary (PAYE, as on P60). */
  annualSalaryPaye: number;
  /** P60 document slot (dated April YYYY). */
  p60DocumentId?: string;
  /** March YYYY payslip document slot. (≥1 of P60 / payslip is mandatory.) */
  marchPayslipDocumentId?: string;
}

/** Self-employed (SA302) — discrete numeric cells; SA302 required. */
export interface SelfEmployedIncome {
  grossSalaried: number;
  propertyIncome: number;
  dividends: number;
  /** Additional other interest / investment income. */
  otherInvestmentIncome: number;
  sa302DocumentId?: string;
}

/** On benefits — itemised rows; uploads required if > £0 except Child Benefit. */
export interface BenefitsIncome {
  /** Universal Credit (excl. childcare). */
  universalCredit: number;
  housingBenefit: number;
  /** Child Benefit — number only; upload is NON-mandatory. */
  childBenefit: number;
  childWorkingTaxCredit: number;
  esa: number;
  /** Disability Allowance or PIP. */
  pipOrDla: number;
  carersAllowance: number;
  childcareSupport: number;
  other: number;
  /** UC 12-month statement. */
  ucStatementDocumentId?: string;
  /** 3 separate detailed monthly UC payment docs. */
  ucMonthlyDocumentIds?: string[];
  housingBenefitDocumentId?: string;
  otherBenefitsDocumentId?: string;
}

/** Unemployed / in between roles in the last 12 months. */
export interface UnemployedIncome {
  /** Final gross pay → P45. */
  finalGrossPay: number;
  /** Redundancy / severance → letter. */
  redundancy: number;
  /** Job Seeker's Allowance → award letter. */
  jsa: number;
  /** Student grant / support → letter. */
  grantSupport: number;
  /** Parental / adoption / sickness leave pay → status-change doc. */
  leavePay: number;
  p45DocumentId?: string;
  redundancyDocumentId?: string;
  jsaDocumentId?: string;
  grantSupportDocumentId?: string;
  leavePayDocumentId?: string;
}

/** Retired — pensions; pension docs required. */
export interface RetiredIncome {
  statePension: number;
  privatePension: number;
  pensionDocumentId?: string;
}

/** Divorced or separated — child maintenance received + shared-custody note. */
export interface DivorcedSeparatedIncome {
  maintenanceReceived: number;
  sharedCustodyNote: string;
  maintenanceDocumentId?: string;
}

/** Third-party support (friends / family / other). */
export interface ThirdPartyIncome {
  incomeSupportReceived: number;
  /** Who provides it / how regularly / how long (free text). */
  supportNote: string;
}

/**
 * Status-driven income record per parent. Sub-blocks are present only for the
 * statuses the parent declared; `total` is the sum of all numeric cells across
 * the present sub-blocks (surfaced live on the form). `documentsConfirmed` is the
 * compulsory legibility tick.
 */
export interface ParentIncomeRecord {
  employed?: EmployedIncome;
  selfEmployed?: SelfEmployedIncome;
  benefits?: BenefitsIncome;
  unemployed?: UnemployedIncome;
  retired?: RetiredIncome;
  divorcedSeparated?: DivorcedSeparatedIncome;
  thirdParty?: ThirdPartyIncome;
  /** Running sum of all numeric cells, surfaced on the form. */
  total: number;
  /** "I confirm all documents on this page are correct and legible." */
  documentsConfirmed: boolean;
}

export interface ParentsIncomeData {
  parent1Income: ParentIncomeRecord;
  parent2Income?: ParentIncomeRecord;
}

/**
 * The legacy flat 14-line income record (pre-Epic-02). Retained ONLY so the
 * back-compat reader can map old drafts / submitted applications into the new
 * shape. Do not write this shape; the form writes `ParentIncomeRecord`.
 */
export interface LegacyParentIncomeRecord {
  salaryWagesPension?: number;
  supplementsAndBonus?: number;
  otherBenefitsAndCommissions?: number;
  amountFromPartner?: number;
  workingTaxCredits?: number;
  grossInterestReceived?: number;
  allDividendIncome?: number;
  grossRentsReceived?: number;
  allIncomeBonds?: number;
  otherGrossIncomes?: number;
  maintenanceOrEquivalents?: number;
  bursariesOrSponsorships?: number;
  otherIncomeNotIncluded?: number;
  otherIncome?: number;
  hasCapitalRepayments?: boolean;
  capitalRepaymentsDocumentId?: string;
  p60DocumentId?: string;
  selfAssessmentDocumentId?: string;
  benefitsEvidenceDocumentId?: string;
  documentsConfirmed?: boolean;
}

// ─── Section 8: Assets & Liabilities ──────────────────────────────────────────

export type PropertyOwnership = "OWN" | "RENT";

export interface OtherProperty {
  id: string;
  /** Address line 1 (workbook §6/7 Q2). */
  address: string;
  postcode: string;
  /** Current market value (£). Kept as `value` for back-compat with old drafts. */
  value: number;
  /** Current mortgage balance (£). */
  mortgageBalance?: number;
  /** Monthly mortgage repayment (£). */
  monthlyRepayment?: number;
  /** Whether the property is used as a rental. */
  usedAsRental?: boolean;
  /** Latest mortgage statement document slot. */
  mortgageStatementDocumentId?: string;
}

export type RentAgreementType =
  | "PRIVATE"
  | "COUNCIL"
  | "COUNCIL_NO_RENT"
  | "RELATIVES";

export type CarOwnership = "OWN" | "LEASE";

export interface AssetsLiabilitiesData {
  // Property
  propertyOwnership: PropertyOwnership;
  residenceValue: number;
  hasMortgage?: boolean;
  mortgageBalance?: number;
  monthlyMortgageRepayment?: number;
  mortgageStatementDocumentId?: string;
  rentAgreementType?: RentAgreementType;
  monthlyRent?: number;
  tenancyAgreementDocumentId?: string;
  housingBenefitLetterDocumentId?: string;
  relativeLetterDocumentId?: string;
  hasOtherProperties: boolean;
  otherProperties: OtherProperty[];
  hasChargingOrder: boolean;
  chargingOrderAddress?: string;
  chargingOrderPostcode?: string;
  chargingOrderValue?: number;
  /** Document slot: council tax letter */
  councilTaxDocumentId?: string;
  // Car & home contents
  carOwnership: CarOwnership;
  carValue?: number;
  carMonthlyLease?: number;
  carLeaseAgreementDocumentId?: string;
  usesPublicTransport: boolean;
  publicTransportMonthly?: number;
  otherPossessionsValue: number;
  otherNonFinancialAssetsValue: number;
  // Financial assets & debt
  totalCashBalance: number;
  investmentsValue: number;
  parent1CurrentAccountDocumentIds: string[];
  parent1SavingsAccountDocumentIds: string[];
  parent1OwnsInvestments?: boolean;
  parent1InvestmentDocumentIds: string[];
  parent2CurrentAccountDocumentIds?: string[];
  parent2SavingsAccountDocumentIds?: string[];
  parent2OwnsInvestments?: boolean;
  parent2InvestmentDocumentIds?: string[];
  hasPersonalDebt: boolean;
  creditCardBalance?: number;
  creditCardStatementDocumentIds: string[];
  bankOverdraft?: number;
  loansToAgencies?: number;
  loanStatementDocumentIds: string[];
  loansToFriendsFamily?: number;
  schoolFeesOwed?: number;
  otherDebtDocumentIds: string[];
  documentsConfirmed: boolean;
}

// ─── Section 9: Additional Info ───────────────────────────────────────────────

export interface AdditionalInfoData {
  additionalNarrative?: string;
  additionalDocumentIds: string[];
}

// ─── Section 10: Declaration ──────────────────────────────────────────────────

export interface DeclarationData {
  /** Parent/Guardian 1 acceptance tick (workbook §8). */
  acceptedParent1: boolean;
  /** Full name of Parent/Guardian 1 accepting the declaration. */
  signedOnBehalfOfParent1: string;
  /** Parent/Guardian 2 acceptance tick (required unless sole parent). */
  acceptedParent2?: boolean;
  signedOnBehalfOfParent2?: string;
  /**
   * Legacy single-tick fields (pre-Epic-02 PR-5). Retained so the back-compat
   * reader / review screen can render old submitted declarations.
   */
  accepted?: boolean;
  signedOnBehalfOf?: string;
}

// ─── Union type for all section data ──────────────────────────────────────────

export type ApplicationSectionData =
  | ChildDetailsData
  | FamilyIdData
  | ParentDetailsData
  | DependentChildrenData
  | DependentElderlyData
  | OtherInfoData
  | ParentsIncomeData
  | AssetsLiabilitiesData
  | AdditionalInfoData
  | DeclarationData;

// ─── Section status ───────────────────────────────────────────────────────────

export interface SectionStatus {
  section: string;
  isComplete: boolean;
  updatedAt: Date | null;
}
