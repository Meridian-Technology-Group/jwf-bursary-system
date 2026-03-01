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
  /** Applying to another school as well? */
  applyingToAnotherSchool: boolean;
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

export type EmploymentStatus =
  | "EMPLOYED"
  | "UNEMPLOYED"
  | "SELF_EMPLOYED"
  | "SELF_EMPLOYED_CIS"
  | "SELF_EMPLOYED_AND_EMPLOYED"
  | "RETIRED";

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
  /** Employer name and address */
  employerAddress?: string;
  /** Account year-end date */
  bookYearEndDate?: string;
  isDirector?: boolean;
  /** Shareholding percentage (when director) */
  sharePercentage?: string;
  /** Document slot: certified accounts (when director) */
  certifiedAccountsDocumentId?: string;
  /** Document slot: balance sheet (when director) */
  balanceSheetDocumentId?: string;
  /** Left self-employment since April? */
  leftSelfEmployment?: boolean;
  /** Document slot: evidence of left self-employment */
  leftSelfEmploymentDocumentId?: string;
  /** Gross pay (for employed/self-employed) */
  grossPay?: number;
  /** Receives scholarship/maintenance? */
  receivesScholarship?: boolean;
  /** Document slot: scholarship evidence */
  scholarshipDocumentId?: string;
  /** Details if unemployed */
  unemployedDetails?: string;
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
  bursaryAmount?: number;
  school?: string;
  /** Unearned income for tax year */
  unearnedIncome?: number;
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
  courtOrderDocumentId?: string;
  /** School/maintenance payment doc slot */
  maintenancePaymentDocumentId?: string;
  hasInsurancePolicy: boolean;
  insurancePolicyAmount?: number;
  insurancePolicyStartDate?: string;
  insurancePolicyEndDate?: string;
  hasOutstandingFees: boolean;
  outstandingFeesSchoolName?: string;
  outstandingFeesAmount?: number;
}

// ─── Section 7: Parents' Income ───────────────────────────────────────────────

export interface ParentIncomeRecord {
  salaryWagesPension: number;
  supplementsAndBonus: number;
  otherBenefitsAndCommissions: number;
  amountFromPartner: number;
  workingTaxCredits: number;
  grossInterestReceived: number;
  allDividendIncome: number;
  grossRentsReceived: number;
  allIncomeBonds: number;
  otherGrossIncomes: number;
  maintenanceOrEquivalents: number;
  bursariesOrSponsorships: number;
  otherIncomeNotIncluded: number;
  otherIncome: number;
  /** Regular capital repayments? */
  hasCapitalRepayments: boolean;
  capitalRepaymentsDocumentId?: string;
  /** P60 document slot */
  p60DocumentId?: string;
  /** Self-assessment document slot */
  selfAssessmentDocumentId?: string;
  /** Benefits evidence document slot */
  benefitsEvidenceDocumentId?: string;
  documentsConfirmed: boolean;
}

export interface ParentsIncomeData {
  parent1Income: ParentIncomeRecord;
  parent2Income?: ParentIncomeRecord;
}

// ─── Section 8: Assets & Liabilities ──────────────────────────────────────────

export type PropertyOwnership = "OWN" | "RENT";

export interface OtherProperty {
  id: string;
  address: string;
  postcode: string;
  value: number;
}

export interface AssetsLiabilitiesData {
  propertyOwnership: PropertyOwnership;
  residenceValue: number;
  carValue: number;
  otherPossessionsValue: number;
  stocksAndSharesValue: number;
  investmentsValue: number;
  otherAssetsValue: number;
  hasOtherProperties: boolean;
  otherPropertiesTotalValue?: number;
  hasRentalProperty?: boolean;
  rentalPropertyValue?: number;
  otherMortgageBalance: number;
  /** Document slot: council tax bill */
  councilTaxDocumentId?: string;
  /** Document slots: Parent 1 bank statements */
  parent1BankStatementDocumentIds: string[];
  /** Document slots: Parent 2 bank statements */
  parent2BankStatementDocumentIds?: string[];
  otherProperties: OtherProperty[];
  outstandingMainMortgage: number;
  totalOtherMortgages: number;
  currentOverdraft: number;
  hasHirePurchase: boolean;
  hirePurchaseBalance?: number;
  /** Document slots: liability agreements */
  liabilitiesAgreementsDocumentId?: string;
  liabilitiesStatementDocumentId?: string;
  hasLiabilityChanges: boolean;
  documentsConfirmed: boolean;
}

// ─── Section 9: Additional Info ───────────────────────────────────────────────

export interface CircumstanceItem {
  applies: boolean;
  documentId?: string;
}

export interface AdditionalInfoData {
  divorced: CircumstanceItem;
  separated: CircumstanceItem;
  sickUnableToWork: CircumstanceItem;
  rent: CircumstanceItem;
  madeRedundant: CircumstanceItem;
  receivingBenefits: CircumstanceItem;
  additionalNarrative?: string;
  additionalDocumentIds: string[];
}

// ─── Section 10: Declaration ──────────────────────────────────────────────────

export interface DeclarationData {
  accepted: boolean;
  signedOnBehalfOf: string;
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
