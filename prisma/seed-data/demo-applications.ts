// prisma/seed-data/demo-applications.ts
// Demo application, assessment, and recommendation data for the four demo families.

import {
  ASSESSOR_ID,
  APPLICANT_1_ID,
  APPLICANT_2_ID,
  APPLICANT_3_ID,
  APPLICANT_4_ID,
} from "./demo-users";

// ─── Fixed IDs ───────────────────────────────────────────────────────────────

// Bursary account IDs
export const ACCOUNT_OKAFOR_ID   = "00000000-0000-4000-b000-000000000001"; // WS-2601 (new)
export const ACCOUNT_PATEL_ID    = "00000000-0000-4000-b000-000000000002"; // TS-2401 (existing)
export const ACCOUNT_WILLIAMS_M_ID = "00000000-0000-4000-b000-000000000003"; // WS-2501 Marcus (existing)
export const ACCOUNT_WILLIAMS_A_ID = "00000000-0000-4000-b000-000000000004"; // TS-2601 Amara (new)
export const ACCOUNT_CHEN_ID     = "00000000-0000-4000-b000-000000000005"; // TS-2602 (new)

// Application IDs
export const APP_OKAFOR_ID       = "00000000-0000-4000-c000-000000000001";
export const APP_PATEL_ID        = "00000000-0000-4000-c000-000000000002";
export const APP_WILLIAMS_M_ID   = "00000000-0000-4000-c000-000000000003"; // Marcus re-assessment
export const APP_WILLIAMS_A_ID   = "00000000-0000-4000-c000-000000000004"; // Amara new
export const APP_CHEN_ID         = "00000000-0000-4000-c000-000000000005";

// Assessment IDs
export const ASSESS_OKAFOR_ID    = "00000000-0000-4000-d000-000000000001";
export const ASSESS_PATEL_ID     = "00000000-0000-4000-d000-000000000002";
export const ASSESS_WILLIAMS_M_ID = "00000000-0000-4000-d000-000000000003";

// Recommendation ID
export const REC_OKAFOR_ID       = "00000000-0000-4000-e000-000000000001";
export const REC_WILLIAMS_M_ID   = "00000000-0000-4000-e000-000000000002";

// Sibling group UUID
export const WILLIAMS_FAMILY_GROUP_ID = "00000000-0000-4000-f000-000000000001";

// ─── Bursary Accounts ────────────────────────────────────────────────────────

export const bursaryAccounts = [
  {
    id: ACCOUNT_OKAFOR_ID,
    reference: "WS-2601",
    school: "WHITGIFT" as const,
    childName: "Emeka Okafor",
    childDob: new Date("2014-03-12"),
    entryYear: 2026,
    firstAssessmentYear: "2026/27",
    benchmarkPayableFees: null,
    leadApplicantId: APPLICANT_1_ID,
    status: "ACTIVE" as const,
  },
  {
    id: ACCOUNT_PATEL_ID,
    reference: "TS-2401",
    school: "TRINITY" as const,
    childName: "Arjun Patel",
    childDob: new Date("2012-07-20"),
    entryYear: 2024,
    firstAssessmentYear: "2024/25",
    benchmarkPayableFees: 18400,
    leadApplicantId: APPLICANT_2_ID,
    status: "ACTIVE" as const,
  },
  {
    id: ACCOUNT_WILLIAMS_M_ID,
    reference: "WS-2501",
    school: "WHITGIFT" as const,
    childName: "Marcus Williams",
    childDob: new Date("2011-11-04"),
    entryYear: 2025,
    firstAssessmentYear: "2025/26",
    benchmarkPayableFees: 16200,
    leadApplicantId: APPLICANT_3_ID,
    status: "ACTIVE" as const,
  },
  {
    id: ACCOUNT_WILLIAMS_A_ID,
    reference: "TS-2601",
    school: "TRINITY" as const,
    childName: "Amara Williams",
    childDob: new Date("2014-06-18"),
    entryYear: 2026,
    firstAssessmentYear: "2026/27",
    benchmarkPayableFees: null,
    leadApplicantId: APPLICANT_3_ID,
    status: "ACTIVE" as const,
  },
  {
    id: ACCOUNT_CHEN_ID,
    reference: "TS-2602",
    school: "TRINITY" as const,
    childName: "Lily Chen",
    childDob: new Date("2015-09-28"),
    entryYear: 2026,
    firstAssessmentYear: "2026/27",
    benchmarkPayableFees: null,
    leadApplicantId: APPLICANT_4_ID,
    status: "ACTIVE" as const,
  },
];

// ─── Applications ─────────────────────────────────────────────────────────────

export const applications = [
  // Okafor — new application, submitted, assessment complete, qualifies
  {
    id: APP_OKAFOR_ID,
    reference: "WS-2601-2627",
    bursaryAccountId: ACCOUNT_OKAFOR_ID,
    leadApplicantId: APPLICANT_1_ID,
    school: "WHITGIFT" as const,
    childName: "Emeka Okafor",
    childDob: new Date("2014-03-12"),
    entryYear: 2026,
    isReassessment: false,
    isInternal: false,
    status: "QUALIFIES" as const,
    submittedAt: new Date("2026-02-10T10:30:00Z"),
  },
  // Patel — re-assessment, submitted, assessment paused
  {
    id: APP_PATEL_ID,
    reference: "TS-2401-2627",
    bursaryAccountId: ACCOUNT_PATEL_ID,
    leadApplicantId: APPLICANT_2_ID,
    school: "TRINITY" as const,
    childName: "Arjun Patel",
    childDob: new Date("2012-07-20"),
    entryYear: 2024,
    isReassessment: true,
    isInternal: false,
    status: "PAUSED" as const,
    submittedAt: new Date("2026-02-14T14:15:00Z"),
  },
  // Williams Marcus — re-assessment, submitted, assessment complete, qualifies
  {
    id: APP_WILLIAMS_M_ID,
    reference: "WS-2501-2627",
    bursaryAccountId: ACCOUNT_WILLIAMS_M_ID,
    leadApplicantId: APPLICANT_3_ID,
    school: "WHITGIFT" as const,
    childName: "Marcus Williams",
    childDob: new Date("2011-11-04"),
    entryYear: 2025,
    isReassessment: true,
    isInternal: false,
    status: "QUALIFIES" as const,
    submittedAt: new Date("2026-02-05T09:45:00Z"),
  },
  // Williams Amara — new application, submitted, not yet assessed
  {
    id: APP_WILLIAMS_A_ID,
    reference: "TS-2601-2627",
    bursaryAccountId: ACCOUNT_WILLIAMS_A_ID,
    leadApplicantId: APPLICANT_3_ID,
    school: "TRINITY" as const,
    childName: "Amara Williams",
    childDob: new Date("2014-06-18"),
    entryYear: 2026,
    isReassessment: false,
    isInternal: false,
    status: "SUBMITTED" as const,
    submittedAt: new Date("2026-02-05T09:50:00Z"),
  },
  // Chen — new application, submitted, not yet assessed
  {
    id: APP_CHEN_ID,
    reference: "TS-2602-2627",
    bursaryAccountId: ACCOUNT_CHEN_ID,
    leadApplicantId: APPLICANT_4_ID,
    school: "TRINITY" as const,
    childName: "Lily Chen",
    childDob: new Date("2015-09-28"),
    entryYear: 2026,
    isReassessment: false,
    isInternal: false,
    status: "SUBMITTED" as const,
    submittedAt: new Date("2026-02-18T11:00:00Z"),
  },
];

// ─── Application Sections ─────────────────────────────────────────────────────

// Section data helper types (JSONB — typed for clarity but stored as Json)
type SectionData = Record<string, unknown>;

interface SectionDef {
  applicationId: string;
  section:
    | "CHILD_DETAILS"
    | "FAMILY_ID"
    | "PARENT_DETAILS"
    | "DEPENDENT_CHILDREN"
    | "DEPENDENT_ELDERLY"
    | "OTHER_INFO"
    | "PARENTS_INCOME"
    | "ASSETS_LIABILITIES"
    | "ADDITIONAL_INFO"
    | "DECLARATION";
  data: SectionData;
  isComplete: boolean;
}

// ── Okafor sections ──────────────────────────────────────────────────────────
const okaforSections: SectionDef[] = [
  {
    applicationId: APP_OKAFOR_ID,
    section: "CHILD_DETAILS",
    isComplete: true,
    data: {
      childName: "Emeka Okafor",
      childDob: "2014-03-12",
      school: "WHITGIFT",
      yearGroup: "Year 7",
      entryYear: 2026,
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "FAMILY_ID",
    isComplete: true,
    data: {
      leadApplicantName: "Adaeze Okafor",
      relationshipToChild: "Mother",
      address: "42 Thornton Road, Croydon, CR0 3BT",
      residencyStatus: "British citizen",
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "PARENT_DETAILS",
    isComplete: true,
    data: {
      parent1: {
        name: "Adaeze Okafor",
        dob: "1982-08-15",
        occupation: "NHS Clinical Lead",
        employmentStatus: "PAYE",
        employer: "NHS South London Trust",
      },
      parent2: {
        name: "Chukwuemeka Okafor",
        dob: "1980-04-22",
        occupation: "Secondary School Teacher",
        employmentStatus: "PAYE",
        employer: "Croydon High School",
      },
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "DEPENDENT_CHILDREN",
    isComplete: true,
    data: {
      dependentChildren: [
        {
          name: "Emeka Okafor",
          dob: "2014-03-12",
          school: "Whitgift School",
          isApplicant: true,
        },
        {
          name: "Chisom Okafor",
          dob: "2016-11-07",
          school: "St. Joseph's Primary",
          isApplicant: false,
        },
      ],
      totalDependentChildren: 2,
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "DEPENDENT_ELDERLY",
    isComplete: true,
    data: {
      hasDependentElderly: false,
      dependentElderly: [],
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "OTHER_INFO",
    isComplete: true,
    data: {
      nationalityDetails: "Both parents are British citizens",
      additionalDependants: "None",
      specialCircumstances: "None",
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "PARENTS_INCOME",
    isComplete: true,
    data: {
      parent1Income: {
        employmentStatus: "PAYE",
        grossSalary: 68000,
        netAnnualPay: 47200,
        pensionContribution: 4000,
        taxCode: "1257L",
        niNumber: "AB123456C",
      },
      parent2Income: {
        employmentStatus: "PAYE",
        grossSalary: 42000,
        netAnnualPay: 31500,
        pensionContribution: 2100,
        taxCode: "1257L",
        niNumber: "CD789012A",
      },
      totalHouseholdGross: 110000,
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "ASSETS_LIABILITIES",
    isComplete: true,
    data: {
      propertyOwnership: "Renting",
      monthlyRent: 1850,
      cashSavings: 12000,
      isasPepsShares: 8500,
      additionalProperties: 0,
      outstandingDebts: [
        { type: "Car loan", balance: 6500, monthlyPayment: 280 },
      ],
      totalDebt: 6500,
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "ADDITIONAL_INFO",
    isComplete: true,
    data: {
      bursaryHistory: "No previous bursary",
      scholarships: "None",
      otherSupport: "None",
      additionalComments:
        "We are very keen for Emeka to attend Whitgift and would appreciate any support the Foundation can offer.",
    },
  },
  {
    applicationId: APP_OKAFOR_ID,
    section: "DECLARATION",
    isComplete: true,
    data: {
      declarationAccepted: true,
      declarationDate: "2026-02-10",
      signatoryName: "Adaeze Okafor",
    },
  },
];

// ── Patel sections ────────────────────────────────────────────────────────────
const patelSections: SectionDef[] = [
  {
    applicationId: APP_PATEL_ID,
    section: "CHILD_DETAILS",
    isComplete: true,
    data: {
      childName: "Arjun Patel",
      childDob: "2012-07-20",
      school: "TRINITY",
      yearGroup: "Year 9",
      entryYear: 2024,
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "FAMILY_ID",
    isComplete: true,
    data: {
      leadApplicantName: "Priya Patel",
      relationshipToChild: "Mother",
      address: "17 Park Lane, Purley, CR8 2AB",
      residencyStatus: "British citizen",
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "PARENT_DETAILS",
    isComplete: true,
    data: {
      parent1: {
        name: "Priya Patel",
        dob: "1979-05-30",
        occupation: "Marketing Manager",
        employmentStatus: "PAYE",
        employer: "Apex Digital Ltd",
      },
      parent2: {
        name: "Rajesh Patel",
        dob: "1977-11-14",
        occupation: "Director, Patel IT Solutions Ltd",
        employmentStatus: "SELF_EMPLOYED_DIRECTOR",
        companyName: "Patel IT Solutions Ltd",
        companyNumber: "12345678",
      },
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "DEPENDENT_CHILDREN",
    isComplete: true,
    data: {
      dependentChildren: [
        {
          name: "Arjun Patel",
          dob: "2012-07-20",
          school: "Trinity School",
          isApplicant: true,
        },
        {
          name: "Meera Patel",
          dob: "2015-03-08",
          school: "Purley Primary Academy",
          isApplicant: false,
        },
      ],
      totalDependentChildren: 2,
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "DEPENDENT_ELDERLY",
    isComplete: true,
    data: {
      hasDependentElderly: true,
      dependentElderly: [
        {
          name: "Kamla Patel",
          relationship: "Mother-in-law",
          age: 74,
          additionalCosts: 3600,
        },
      ],
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "OTHER_INFO",
    isComplete: true,
    data: {
      nationalityDetails: "Both parents hold British passports",
      additionalDependants: "Rajesh's mother lives with the family",
      specialCircumstances:
        "Company income has been lower in 2025/26 due to delayed contract renewals",
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "PARENTS_INCOME",
    isComplete: true,
    data: {
      parent1Income: {
        employmentStatus: "PAYE",
        grossSalary: 52000,
        netAnnualPay: 37800,
        pensionContribution: 2600,
        taxCode: "1257L",
      },
      parent2Income: {
        employmentStatus: "SELF_EMPLOYED_DIRECTOR",
        directorSalary: 12570,
        dividendsGross: 38000,
        netDividends: 35000,
        netDirectorPay: 10500,
        companyAccountingYear: "April",
        latestAccountsTurnover: 210000,
        latestAccountsProfit: 55000,
      },
      totalHouseholdGross: 102570,
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "ASSETS_LIABILITIES",
    isComplete: true,
    data: {
      propertyOwnership: "Mortgaged",
      propertyValue: 580000,
      mortgageOutstanding: 240000,
      monthlyMortgagePayment: 1450,
      cashSavings: 22000,
      isasPepsShares: 35000,
      additionalProperties: 0,
      outstandingDebts: [
        { type: "Business loan", balance: 18000, monthlyPayment: 650 },
      ],
      totalDebt: 18000,
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "ADDITIONAL_INFO",
    isComplete: true,
    data: {
      bursaryHistory: "Arjun has held a bursary since Year 7 (2024/25)",
      scholarships: "None",
      otherSupport: "None",
      additionalComments:
        "We are grateful for the Foundation's continued support and hope to remain eligible for the coming year.",
    },
  },
  {
    applicationId: APP_PATEL_ID,
    section: "DECLARATION",
    isComplete: true,
    data: {
      declarationAccepted: true,
      declarationDate: "2026-02-14",
      signatoryName: "Priya Patel",
    },
  },
];

// ── Williams Marcus sections (re-assessment) ──────────────────────────────────
const williamsMSections: SectionDef[] = [
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "CHILD_DETAILS",
    isComplete: true,
    data: {
      childName: "Marcus Williams",
      childDob: "2011-11-04",
      school: "WHITGIFT",
      yearGroup: "Year 9",
      entryYear: 2025,
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "FAMILY_ID",
    isComplete: true,
    data: {
      leadApplicantName: "Sarah Williams",
      relationshipToChild: "Mother",
      address: "8 Birchwood Avenue, South Croydon, CR2 7PQ",
      residencyStatus: "British citizen",
      familyStructure: "Sole parent",
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "PARENT_DETAILS",
    isComplete: true,
    data: {
      parent1: {
        name: "Sarah Williams",
        dob: "1984-02-19",
        occupation: "Senior Admin Officer",
        employmentStatus: "PAYE",
        employer: "London Borough of Croydon",
      },
      parent2: null,
      isSoleParent: true,
      soleParentReason: "Separated. Father has no contact.",
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "DEPENDENT_CHILDREN",
    isComplete: true,
    data: {
      dependentChildren: [
        {
          name: "Marcus Williams",
          dob: "2011-11-04",
          school: "Whitgift School",
          isApplicant: true,
        },
        {
          name: "Amara Williams",
          dob: "2014-06-18",
          school: "Granton Primary",
          isApplicant: false,
        },
      ],
      totalDependentChildren: 2,
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "DEPENDENT_ELDERLY",
    isComplete: true,
    data: {
      hasDependentElderly: false,
      dependentElderly: [],
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "OTHER_INFO",
    isComplete: true,
    data: {
      nationalityDetails: "British citizen",
      additionalDependants: "None",
      specialCircumstances:
        "Single parent household. Marcus's father provides no financial support.",
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "PARENTS_INCOME",
    isComplete: true,
    data: {
      parent1Income: {
        employmentStatus: "PAYE",
        grossSalary: 36000,
        netAnnualPay: 27900,
        pensionContribution: 3240,
        taxCode: "1257L",
      },
      totalHouseholdGross: 36000,
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "ASSETS_LIABILITIES",
    isComplete: true,
    data: {
      propertyOwnership: "Renting",
      monthlyRent: 1350,
      cashSavings: 3500,
      isasPepsShares: 0,
      additionalProperties: 0,
      outstandingDebts: [],
      totalDebt: 0,
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "ADDITIONAL_INFO",
    isComplete: true,
    data: {
      bursaryHistory: "Marcus has held a bursary since Year 8 (2025/26). Also applying for Amara (TS-2601).",
      scholarships: "None",
      otherSupport: "Child Tax Credit and Child Benefit",
      additionalComments:
        "My circumstances have not materially changed since last year. I continue to rely on the bursary for Marcus to remain at Whitgift.",
    },
  },
  {
    applicationId: APP_WILLIAMS_M_ID,
    section: "DECLARATION",
    isComplete: true,
    data: {
      declarationAccepted: true,
      declarationDate: "2026-02-05",
      signatoryName: "Sarah Williams",
    },
  },
];

// ── Williams Amara sections (new application) ─────────────────────────────────
const williamsASections: SectionDef[] = [
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "CHILD_DETAILS",
    isComplete: true,
    data: {
      childName: "Amara Williams",
      childDob: "2014-06-18",
      school: "TRINITY",
      yearGroup: "Year 7",
      entryYear: 2026,
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "FAMILY_ID",
    isComplete: true,
    data: {
      leadApplicantName: "Sarah Williams",
      relationshipToChild: "Mother",
      address: "8 Birchwood Avenue, South Croydon, CR2 7PQ",
      residencyStatus: "British citizen",
      familyStructure: "Sole parent",
      siblingReference: "WS-2501",
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "PARENT_DETAILS",
    isComplete: true,
    data: {
      parent1: {
        name: "Sarah Williams",
        dob: "1984-02-19",
        occupation: "Senior Admin Officer",
        employmentStatus: "PAYE",
        employer: "London Borough of Croydon",
      },
      parent2: null,
      isSoleParent: true,
      soleParentReason: "Separated. Father has no contact.",
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "DEPENDENT_CHILDREN",
    isComplete: true,
    data: {
      dependentChildren: [
        {
          name: "Marcus Williams",
          dob: "2011-11-04",
          school: "Whitgift School",
          isApplicant: false,
          hasBursary: true,
          bursaryReference: "WS-2501",
        },
        {
          name: "Amara Williams",
          dob: "2014-06-18",
          school: "Trinity School",
          isApplicant: true,
        },
      ],
      totalDependentChildren: 2,
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "DEPENDENT_ELDERLY",
    isComplete: true,
    data: {
      hasDependentElderly: false,
      dependentElderly: [],
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "OTHER_INFO",
    isComplete: true,
    data: {
      nationalityDetails: "British citizen",
      additionalDependants: "None",
      specialCircumstances:
        "Same household as Marcus Williams (WS-2501). Sibling bursary assessment.",
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "PARENTS_INCOME",
    isComplete: true,
    data: {
      parent1Income: {
        employmentStatus: "PAYE",
        grossSalary: 36000,
        netAnnualPay: 27900,
        pensionContribution: 3240,
        taxCode: "1257L",
      },
      totalHouseholdGross: 36000,
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "ASSETS_LIABILITIES",
    isComplete: true,
    data: {
      propertyOwnership: "Renting",
      monthlyRent: 1350,
      cashSavings: 3500,
      isasPepsShares: 0,
      additionalProperties: 0,
      outstandingDebts: [],
      totalDebt: 0,
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "ADDITIONAL_INFO",
    isComplete: true,
    data: {
      bursaryHistory: "Amara is applying for the first time. Her brother Marcus holds WS-2501.",
      scholarships: "None",
      otherSupport: "Child Tax Credit and Child Benefit",
      additionalComments:
        "Amara has passed the entrance examination and I very much hope the Foundation will be able to support her as it does her brother.",
    },
  },
  {
    applicationId: APP_WILLIAMS_A_ID,
    section: "DECLARATION",
    isComplete: true,
    data: {
      declarationAccepted: true,
      declarationDate: "2026-02-05",
      signatoryName: "Sarah Williams",
    },
  },
];

// ── Chen sections ─────────────────────────────────────────────────────────────
const chenSections: SectionDef[] = [
  {
    applicationId: APP_CHEN_ID,
    section: "CHILD_DETAILS",
    isComplete: true,
    data: {
      childName: "Lily Chen",
      childDob: "2015-09-28",
      school: "TRINITY",
      yearGroup: "Year 6",
      entryYear: 2026,
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "FAMILY_ID",
    isComplete: true,
    data: {
      leadApplicantName: "Wei Chen",
      relationshipToChild: "Father",
      address: "93 Selsdon Road, South Croydon, CR2 6PB",
      residencyStatus: "British citizen",
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "PARENT_DETAILS",
    isComplete: true,
    data: {
      parent1: {
        name: "Wei Chen",
        dob: "1978-12-03",
        occupation: "Software Engineer",
        employmentStatus: "PAYE",
        employer: "TechVenture Systems Ltd",
      },
      parent2: {
        name: "Jing Chen",
        dob: "1981-04-16",
        occupation: "Part-time Mandarin Tutor",
        employmentStatus: "SELF_EMPLOYED_SOLE",
      },
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "DEPENDENT_CHILDREN",
    isComplete: true,
    data: {
      dependentChildren: [
        {
          name: "Lily Chen",
          dob: "2015-09-28",
          school: "Trinity School",
          isApplicant: true,
        },
        {
          name: "Nathan Chen",
          dob: "2018-02-11",
          school: "Selsdon Primary",
          isApplicant: false,
        },
      ],
      totalDependentChildren: 2,
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "DEPENDENT_ELDERLY",
    isComplete: true,
    data: {
      hasDependentElderly: false,
      dependentElderly: [],
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "OTHER_INFO",
    isComplete: true,
    data: {
      nationalityDetails: "Both parents are naturalised British citizens",
      additionalDependants: "None",
      specialCircumstances: "None",
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "PARENTS_INCOME",
    isComplete: true,
    data: {
      parent1Income: {
        employmentStatus: "PAYE",
        grossSalary: 78000,
        netAnnualPay: 52400,
        pensionContribution: 5850,
        taxCode: "1257L",
      },
      parent2Income: {
        employmentStatus: "SELF_EMPLOYED_SOLE",
        grossSelfEmployedProfit: 8400,
        netSelfEmployedProfit: 7560,
        taxReturnYear: "2024/25",
      },
      totalHouseholdGross: 86400,
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "ASSETS_LIABILITIES",
    isComplete: true,
    data: {
      propertyOwnership: "Mortgaged",
      propertyValue: 650000,
      mortgageOutstanding: 390000,
      monthlyMortgagePayment: 1820,
      cashSavings: 18000,
      isasPepsShares: 12000,
      additionalProperties: 0,
      outstandingDebts: [
        { type: "Credit card", balance: 3200, monthlyPayment: 120 },
      ],
      totalDebt: 3200,
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "ADDITIONAL_INFO",
    isComplete: true,
    data: {
      bursaryHistory: "No previous bursary",
      scholarships: "None",
      otherSupport: "None",
      additionalComments:
        "Lily is very excited about the prospect of attending Trinity and we believe a bursary would allow her to fulfil her potential.",
    },
  },
  {
    applicationId: APP_CHEN_ID,
    section: "DECLARATION",
    isComplete: true,
    data: {
      declarationAccepted: true,
      declarationDate: "2026-02-18",
      signatoryName: "Wei Chen",
    },
  },
];

export const applicationSections: SectionDef[] = [
  ...okaforSections,
  ...patelSections,
  ...williamsMSections,
  ...williamsASections,
  ...chenSections,
];

// ─── Assessments ──────────────────────────────────────────────────────────────

export const assessments = [
  // Okafor — COMPLETED, QUALIFIES
  {
    id: ASSESS_OKAFOR_ID,
    applicationId: APP_OKAFOR_ID,
    assessorId: ASSESSOR_ID,
    // Reference value snapshots (Cat 3: Parents, 2 children, renting so notional rent applies)
    familyTypeCategory: 3,
    notionalRent: 18000,
    utilityCosts: 2000,
    foodCosts: 8500,
    annualFees: 31752,       // Whitgift 2026/27 fees
    councilTax: 2480,
    schoolingYearsRemaining: 7,
    // Calculation results
    totalHouseholdNetIncome: 78700,  // 47200 + 31500
    netAssetsYearlyValuation: 1460,  // (12000+8500) / 7 years schooling remaining / school_age_children factor simplified
    hndiAfterNs: 46720,              // 78700 - 18000 - 2000 - 8500 - 2480 - 1000 (other)
    requiredBursary: 22456,
    // Payable fees
    grossFees: 31752,
    scholarshipPct: 0,
    bursaryAward: 22456,
    netYearlyFees: 9296,
    vatRate: 20,
    yearlyPayableFees: 11155,
    monthlyPayableFees: 929.58,
    manualAdjustment: 0,
    manualAdjustmentReason: null,
    // Property
    propertyCategory: 1,             // Renting, no property assets above threshold
    propertyExceedsThreshold: false,
    // Flags
    dishonestyFlag: false,
    creditRiskFlag: false,
    // Status
    status: "COMPLETED" as const,
    outcome: "QUALIFIES" as const,
    completedAt: new Date("2026-02-28T16:00:00Z"),
  },
  // Patel — PAUSED (in progress)
  {
    id: ASSESS_PATEL_ID,
    applicationId: APP_PATEL_ID,
    assessorId: ASSESSOR_ID,
    // Partial data — assessment not yet complete
    familyTypeCategory: 3,           // Parents, 2 children
    notionalRent: 18000,
    utilityCosts: 2000,
    foodCosts: 8500,
    annualFees: 30702,               // Trinity fees
    councilTax: 2480,
    schoolingYearsRemaining: 5,
    // Income partially assessed
    totalHouseholdNetIncome: 83300,  // 37800 + 35000 (net dividends) + 10500
    netAssetsYearlyValuation: null,
    hndiAfterNs: null,
    requiredBursary: null,
    grossFees: 30702,
    scholarshipPct: 0,
    bursaryAward: null,
    netYearlyFees: null,
    vatRate: 20,
    yearlyPayableFees: null,
    monthlyPayableFees: null,
    manualAdjustment: 0,
    manualAdjustmentReason: null,
    propertyCategory: null,
    propertyExceedsThreshold: false,
    dishonestyFlag: false,
    creditRiskFlag: false,
    status: "PAUSED" as const,
    outcome: null,
    completedAt: null,
  },
  // Williams Marcus — COMPLETED, QUALIFIES (re-assessment, sole parent, low income)
  {
    id: ASSESS_WILLIAMS_M_ID,
    applicationId: APP_WILLIAMS_M_ID,
    assessorId: ASSESSOR_ID,
    familyTypeCategory: 1,           // Sole parent, 1 child (absorbs sibling income first)
    notionalRent: 13000,
    utilityCosts: 1200,
    foodCosts: 5000,
    annualFees: 31752,
    councilTax: 2480,
    schoolingYearsRemaining: 4,      // Marcus: Year 9, leaving after Year 13
    totalHouseholdNetIncome: 27900,
    netAssetsYearlyValuation: 875,   // (3500+0) / 4
    hndiAfterNs: 6220,               // 27900 - 13000 - 1200 - 5000 - 2480
    requiredBursary: 29532,          // fees exceed what family can contribute
    grossFees: 31752,
    scholarshipPct: 0,
    bursaryAward: 29532,
    netYearlyFees: 2220,
    vatRate: 20,
    yearlyPayableFees: 2664,
    monthlyPayableFees: 222,
    manualAdjustment: 0,
    manualAdjustmentReason: null,
    propertyCategory: 1,
    propertyExceedsThreshold: false,
    dishonestyFlag: false,
    creditRiskFlag: false,
    status: "COMPLETED" as const,
    outcome: "QUALIFIES" as const,
    completedAt: new Date("2026-02-25T11:30:00Z"),
  },
];

// ─── Assessment Earners ────────────────────────────────────────────────────────

export const assessmentEarners = [
  // Okafor: Parent 1 — Adaeze, PAYE
  {
    assessmentId: ASSESS_OKAFOR_ID,
    earnerLabel: "PARENT_1" as const,
    employmentStatus: "PAYE" as const,
    netPay: 47200,
    netDividends: 0,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 0,
    benefitsIncludedDetail: {},
    benefitsExcluded: 0,
    benefitsExcludedDetail: {},
    totalIncome: 47200,
  },
  // Okafor: Parent 2 — Chukwuemeka, PAYE
  {
    assessmentId: ASSESS_OKAFOR_ID,
    earnerLabel: "PARENT_2" as const,
    employmentStatus: "PAYE" as const,
    netPay: 31500,
    netDividends: 0,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 0,
    benefitsIncludedDetail: {},
    benefitsExcluded: 0,
    benefitsExcludedDetail: {},
    totalIncome: 31500,
  },
  // Patel: Parent 1 — Priya, PAYE
  {
    assessmentId: ASSESS_PATEL_ID,
    earnerLabel: "PARENT_1" as const,
    employmentStatus: "PAYE" as const,
    netPay: 37800,
    netDividends: 0,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 0,
    benefitsIncludedDetail: {},
    benefitsExcluded: 0,
    benefitsExcludedDetail: {},
    totalIncome: 37800,
  },
  // Patel: Parent 2 — Rajesh, Director
  {
    assessmentId: ASSESS_PATEL_ID,
    earnerLabel: "PARENT_2" as const,
    employmentStatus: "SELF_EMPLOYED_DIRECTOR" as const,
    netPay: 10500,
    netDividends: 35000,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 0,
    benefitsIncludedDetail: {},
    benefitsExcluded: 0,
    benefitsExcludedDetail: {},
    totalIncome: 45500,
  },
  // Williams Marcus: Parent 1 — Sarah, PAYE (sole parent)
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    earnerLabel: "PARENT_1" as const,
    employmentStatus: "PAYE" as const,
    netPay: 27900,
    netDividends: 0,
    netSelfEmployedProfit: 0,
    pensionAmount: 0,
    benefitsIncluded: 2400,   // Child tax credit included in income calculation
    benefitsIncludedDetail: { childTaxCredit: 2400 },
    benefitsExcluded: 1500,   // Child benefit excluded
    benefitsExcludedDetail: { childBenefit: 1500 },
    totalIncome: 30300,
  },
];

// ─── Assessment Properties ─────────────────────────────────────────────────────

export const assessmentProperties = [
  // Okafor — renting, modest savings
  {
    assessmentId: ASSESS_OKAFOR_ID,
    isMortgageFree: false,
    additionalPropertyCount: 0,
    additionalPropertyIncome: 0,
    cashSavings: 12000,
    isasPepsShares: 8500,
    schoolAgeChildrenCount: 2,
    derivedSavingsAnnualTotal: 1460,  // (12000+8500) / 7 remaining years / 2 children simplified
  },
  // Patel — mortgaged, more savings, business loan
  {
    assessmentId: ASSESS_PATEL_ID,
    isMortgageFree: false,
    additionalPropertyCount: 0,
    additionalPropertyIncome: 0,
    cashSavings: 22000,
    isasPepsShares: 35000,
    schoolAgeChildrenCount: 2,
    derivedSavingsAnnualTotal: 5700,  // (22000+35000) / 5 remaining years / 2
  },
  // Williams Marcus — renting, minimal savings
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    isMortgageFree: false,
    additionalPropertyCount: 0,
    additionalPropertyIncome: 0,
    cashSavings: 3500,
    isasPepsShares: 0,
    schoolAgeChildrenCount: 2,        // Marcus + Amara (school age)
    derivedSavingsAnnualTotal: 437,   // 3500 / 4 years / 2
  },
];

// ─── Assessment Checklists ─────────────────────────────────────────────────────

export const assessmentChecklists = [
  // Okafor checklists (completed assessment)
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "BURSARY_DETAILS" as const,
    notes:
      "New application, Year 7 entry. Both parents PAYE, NHS and teaching. Renting in Croydon. Cat 3 family. No previous bursary. Straightforward application.",
  },
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "LIVING_CONDITIONS" as const,
    notes:
      "Family renting at £1,850/month in Croydon. Notional rent applies (Cat 3: £18,000). No property ownership. Rent confirmed against bank statements.",
  },
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "DEBT" as const,
    notes: "Car loan outstanding £6,500 at £280/month. No other significant debts. Credit checks satisfactory.",
  },
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "OTHER_FEES" as const,
    notes: "No other independent school fees. Younger sibling at state primary.",
  },
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "STAFF" as const,
    notes: "No connection to school staff or Foundation trustees identified.",
  },
  {
    assessmentId: ASSESS_OKAFOR_ID,
    tab: "FINANCIAL_PROFILE" as const,
    notes:
      "P60s verified for both parents. Bank statements reviewed for 3 months. Income consistent with declared figures. Savings in line with stated amounts. No anomalies detected.",
  },
  // Williams Marcus checklists (completed re-assessment)
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "BURSARY_DETAILS" as const,
    notes:
      "Re-assessment Year 9. Sole parent household, no change in circumstances from 2025/26 assessment. Sibling Amara now applying for Trinity (TS-2601). Sibling income absorption modelled.",
  },
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "LIVING_CONDITIONS" as const,
    notes:
      "Renting at £1,350/month, Cat 1 notional rent £13,000 applies. No property assets.",
  },
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "DEBT" as const,
    notes: "No debts. Clean credit profile.",
  },
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "OTHER_FEES" as const,
    notes: "Amara's Trinity application (TS-2601) being assessed separately. Sibling link created.",
  },
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "STAFF" as const,
    notes: "No connections identified.",
  },
  {
    assessmentId: ASSESS_WILLIAMS_M_ID,
    tab: "FINANCIAL_PROFILE" as const,
    notes:
      "Single P60 verified. Bank statements show consistent income. Child Tax Credit and Child Benefit confirmed. Low savings are consistent with sole parent income level. No concerns.",
  },
  // Patel checklists (partial — assessment paused)
  {
    assessmentId: ASSESS_PATEL_ID,
    tab: "BURSARY_DETAILS" as const,
    notes:
      "Re-assessment Year 9. Director income requires company accounts verification. Awaiting certified accounts for Patel IT Solutions Ltd.",
  },
  {
    assessmentId: ASSESS_PATEL_ID,
    tab: "LIVING_CONDITIONS" as const,
    notes: "Owner-occupier, mortgaged. Property value £580k, outstanding mortgage £240k.",
  },
  {
    assessmentId: ASSESS_PATEL_ID,
    tab: "DEBT" as const,
    notes: "Business loan £18,000. No personal debts.",
  },
];

// ─── Recommendations ──────────────────────────────────────────────────────────

export const recommendations = [
  {
    id: REC_OKAFOR_ID,
    assessmentId: ASSESS_OKAFOR_ID,
    bursaryAccountId: ACCOUNT_OKAFOR_ID,
    familySynopsis:
      "Two-parent PAYE family, renting in Croydon. NHS clinical lead and secondary school teacher. Two dependent children. No property assets. Modest savings. Straightforward application with no concerns.",
    accommodationStatus: "Renting",
    incomeCategory: "Middle income — combined net £78,700",
    propertyCategory: 1,
    bursaryAward: 22456,
    yearlyPayableFees: 11155,
    monthlyPayableFees: 929.58,
    dishonestyFlag: false,
    creditRiskFlag: false,
    summary:
      "Recommend bursary award of £22,456 (70.7% of gross fees). Family demonstrates genuine need and the application is fully supported by documentary evidence. No concerns identified.",
  },
  {
    id: REC_WILLIAMS_M_ID,
    assessmentId: ASSESS_WILLIAMS_M_ID,
    bursaryAccountId: ACCOUNT_WILLIAMS_M_ID,
    familySynopsis:
      "Sole parent household. Mother employed PAYE with London Borough of Croydon. Two dependent children, Marcus (Whitgift) and Amara (applying Trinity). Renting. Minimal savings. Unchanged circumstances from 2025/26.",
    accommodationStatus: "Renting",
    incomeCategory: "Low income — net £27,900 (sole parent)",
    propertyCategory: 1,
    bursaryAward: 29532,
    yearlyPayableFees: 2664,
    monthlyPayableFees: 222,
    dishonestyFlag: false,
    creditRiskFlag: false,
    summary:
      "Recommend continued bursary award of £29,532 (93.0% of gross fees). Sole parent with genuinely low income and no material change in circumstances. High award level fully justified. Sibling application (TS-2601) to be assessed separately with income already absorbed here.",
  },
];

// ─── Recommendation Reason Codes ──────────────────────────────────────────────
// code 1 = "No real change in circumstances" — used for Williams Marcus re-assessment

export const recommendationReasonCodes = [
  // Williams Marcus: no change (code 1)
  { recommendationId: REC_WILLIAMS_M_ID, reasonCodeCode: 1 },
];

// ─── Sibling Links ────────────────────────────────────────────────────────────

export const siblingLinks = [
  {
    familyGroupId: WILLIAMS_FAMILY_GROUP_ID,
    bursaryAccountId: ACCOUNT_WILLIAMS_M_ID,
    priorityOrder: 1,   // Marcus absorbs income first (existing bursary)
  },
  {
    familyGroupId: WILLIAMS_FAMILY_GROUP_ID,
    bursaryAccountId: ACCOUNT_WILLIAMS_A_ID,
    priorityOrder: 2,   // Amara absorbs remaining income
  },
];
