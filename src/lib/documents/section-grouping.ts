/**
 * section-grouping.ts — Epic 14 C3: which application-form section a document
 * slot belongs to.
 *
 * The APPLICATION FORM tab lists, under each section, the TITLES of the
 * documents uploaded for it (viewer lives on the UPLOADED DOCUMENTS DISPLAY
 * tab). Slots are stable SCREAMING_SNAKE identifiers (see
 * `src/lib/documents/slots.ts` + `src/lib/portal/section-rules.ts`), so the
 * mapping is a first-match prefix table. Anything unrecognised lands in the
 * `null` bucket, which renders as "Other documents" — honest, never silently
 * dropped.
 */

import type { ApplicationSectionType } from "@prisma/client";

/** First match wins — order matters (e.g. HOUSING_BENEFIT_LETTER before HOUSING_BENEFIT). */
const SLOT_SECTION_PREFIXES: readonly [RegExp, ApplicationSectionType][] = [
  [/^BIRTH_CERTIFICATE/, "CHILD_DETAILS"],
  // Family identification — per-member passports / ILR evidence.
  [/^FAMILY_ID_/, "FAMILY_ID"],
  [/^(UK_)?PASSPORT_/, "FAMILY_ID"],
  [/^ILR_/, "FAMILY_ID"],
  // Parent details — employment-change evidence.
  [/^(EMPLOYMENT_)?(P45|REDUNDANCY)/, "PARENT_DETAILS"],
  // Other information — court orders, bereavement, insurance, decree absolute.
  [/^(COURT_ORDER|DEATH_CERTIFICATE|INSURANCE_POLICY|MAINTENANCE_)/, "OTHER_INFO"],
  // Assets & liabilities — before the income rules so the housing-benefit
  // LETTER (assets) doesn't get swallowed by the income HOUSING_BENEFIT slot.
  // CH-62 — OTHER_PROPERTY_MORTGAGE_{index} (the per-property mortgage
  // statement from the `otherProperties` repeater) is not in
  // ALL_DOCUMENT_SLOTS, so it used to fall through to "Other documents" at the
  // bottom of the page instead of listing with the property it belongs to.
  [
    /^(COUNCIL_TAX|MAIN_MORTGAGE|OTHER_PROPERTY_MORTGAGE|TENANCY|HOUSING_BENEFIT_LETTER|RELATIVE_LETTER|CAR_LEASE|BANK_STATEMENT|INVESTMENT|CREDIT_CARD|LOAN_|OTHER_DEBT)/,
    "ASSETS_LIABILITIES",
  ],
  // Parents' income — per-earner suffixed slots.
  [
    /^(P60|MARCH_PAYSLIP|SA302|SELF_ASSESSMENT|UC_|HOUSING_BENEFIT|OTHER_BENEFITS|BENEFITS_EVIDENCE|CAPITAL_REPAYMENTS|THIRD_PARTY)/,
    "PARENTS_INCOME",
  ],
  [/^ADDITIONAL_DOCUMENT/, "ADDITIONAL_INFO"],
];

/** The section a slot's documents display under; null = "Other documents". */
export function sectionForDocumentSlot(
  slot: string
): ApplicationSectionType | null {
  for (const [re, section] of SLOT_SECTION_PREFIXES) {
    if (re.test(slot)) return section;
  }
  return null;
}

export interface GroupableDocument {
  id: string;
  slot: string;
  filename: string;
}

/**
 * Groups documents by section for the APPLICATION FORM tab. Unmatched slots
 * come back under the `other` key.
 */
export function groupDocumentsBySection<T extends GroupableDocument>(
  documents: readonly T[]
): { bySection: Map<ApplicationSectionType, T[]>; other: T[] } {
  const bySection = new Map<ApplicationSectionType, T[]>();
  const other: T[] = [];
  for (const doc of documents) {
    const section = sectionForDocumentSlot(doc.slot);
    if (!section) {
      other.push(doc);
      continue;
    }
    const bucket = bySection.get(section);
    if (bucket) bucket.push(doc);
    else bySection.set(section, [doc]);
  }
  return { bySection, other };
}

// ─── Application rejection: documents to remove, by group (17 Oct 2026) ──────

/**
 * Charlotte, 17 Oct: "the system could suggest to clear the documents per
 * section (income, property, bank statements), or give me the option to do it
 * manually". The groups split Assets & liabilities, where most rejected
 * documents sit, into property and bank statements.
 */
export const REJECTION_DOCUMENT_GROUPS = [
  { key: "INCOME", label: "Income" },
  { key: "PROPERTY", label: "Property & housing" },
  { key: "BANK_STATEMENTS", label: "Bank statements" },
  { key: "OTHER_ASSETS", label: "Savings, investments & debts" },
  { key: "IDENTITY", label: "Identity & family" },
  { key: "OTHER", label: "Other documents" },
] as const;

export type RejectionDocumentGroup = (typeof REJECTION_DOCUMENT_GROUPS)[number]["key"];

export function rejectionGroupForSlot(slot: string): RejectionDocumentGroup {
  if (/^BANK_STATEMENT/.test(slot)) return "BANK_STATEMENTS";
  if (/^(COUNCIL_TAX|MAIN_MORTGAGE|OTHER_PROPERTY_MORTGAGE|TENANCY|HOUSING_BENEFIT_LETTER|RELATIVE_LETTER)/.test(slot)) {
    return "PROPERTY";
  }
  switch (sectionForDocumentSlot(slot)) {
    case "PARENTS_INCOME":
      return "INCOME";
    case "ASSETS_LIABILITIES":
      return "OTHER_ASSETS";
    case "CHILD_DETAILS":
    case "FAMILY_ID":
    case "PARENT_DETAILS":
      return "IDENTITY";
    default:
      return "OTHER";
  }
}

/** One document offered for removal in the rejection window. */
export interface RejectionDocument {
  id: string;
  slot: string;
  filename: string;
  group: RejectionDocumentGroup;
}
