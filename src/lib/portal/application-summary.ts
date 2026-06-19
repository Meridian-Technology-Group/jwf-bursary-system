/**
 * Submitted-application summary builder — Epic 05 (plan §3.3, §5.2).
 *
 * Pure (no JSX) transformation of an application's section JSONB into a
 * read-only, parent-facing summary structure. Used by BOTH:
 *   - the on-screen submitted summary (`(portal)/submitted`), and
 *   - the submission PDF renderer (`lib/pdf/submission-pdf.tsx`).
 *
 * Rendering from the live JSONB is safe post-submission: the form is immutable
 * (Epic 01 write-once `submittedAt` + status guard), so what is shown always
 * reads as it was submitted, even after a later missing-document upload (which
 * retro-populates documents but never the answer blob in a way that changes the
 * submitted figures). See plan §5.1 — a frozen snapshot is deferred unless that
 * invariant is broken.
 *
 * Keeping this as data (not components) means the PDF and the web view share one
 * source of truth for which answers a parent sees.
 */

import { ENTRY_YEAR_GROUP_LABELS } from "@/lib/assessment/schooling-years";
import { humaniseSlot } from "@/lib/documents/slots";
import {
  parentIncomeTotal,
  readIncomeItems,
} from "@/lib/portal/income-model";
import type {
  ChildDetailsData,
  FamilyIdData,
  ParentDetailsData,
  DependentChildrenData,
  DependentElderlyData,
  OtherInfoData,
  ParentsIncomeData,
  AssetsLiabilitiesData,
  AdditionalInfoData,
} from "@/types/application";

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryTable {
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface SummarySection {
  sectionType: string;
  title: string;
  rows: SummaryRow[];
  tables?: SummaryTable[];
  /** Documents uploaded against this section (filename + human slot label). */
  documents?: { slot: string; label: string; filename: string }[];
}

export interface SubmittedSummary {
  sections: SummarySection[];
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

export function fmtCurrency(value: number | undefined | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtSchool(school: string | undefined | null): string {
  if (!school) return "—";
  if (school === "TRINITY") return "Trinity School";
  if (school === "WHITGIFT") return "Whitgift School";
  return school;
}

function parseSafe<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  return raw as T;
}

const SECTION_TITLES: Record<string, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information Required",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Parents' Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

/** The section order shown in the summary (DECLARATION handled separately). */
const SUMMARY_SECTION_ORDER = [
  "CHILD_DETAILS",
  "FAMILY_ID",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
  "OTHER_INFO",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO",
] as const;

// ─── Per-section row builders ───────────────────────────────────────────────

function childDetailsRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<ChildDetailsData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [
    { label: "Name", value: d.childFullName || "—" },
    { label: "Date of birth", value: fmtDate(d.dateOfBirth) },
    { label: "School applying for", value: fmtSchool(d.school) },
    {
      label: "Year of entry",
      value: d.entryYearGroup
        ? ENTRY_YEAR_GROUP_LABELS[d.entryYearGroup] ?? d.entryYearGroup
        : "—",
    },
    { label: "Current school", value: d.currentSchool || "—" },
    { label: "Place of birth", value: d.placeOfBirth || "—" },
  ];
  if (!d.sameAddressAsParent1 && d.childAddress) {
    rows.push({
      label: "Child's address",
      value: [
        d.childAddress.addressLine1,
        d.childAddress.city,
        d.childAddress.postcode,
      ]
        .filter(Boolean)
        .join(", "),
    });
  }
  return rows;
}

function familyIdRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<FamilyIdData>(raw);
  if (!d || !Array.isArray(d.familyMembers)) return [];
  return d.familyMembers.map((m) => ({
    label: m.familyMemberName || "Member",
    value: m.isBritishCitizen ? "British citizen" : "Non-British citizen",
  }));
}

function parentDetailsRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<ParentDetailsData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  const p1 = d.parent1Contact;
  if (p1) {
    rows.push({
      label: "Parent / Guardian 1",
      value: [p1.firstName, p1.lastName].filter(Boolean).join(" ") || "—",
    });
    if (p1.addressLine1) {
      rows.push({
        label: "Address",
        value: [p1.addressLine1, p1.city, p1.postcode]
          .filter(Boolean)
          .join(", "),
      });
    }
    if (d.parent1Employment?.status) {
      rows.push({
        label: "Employment",
        value: d.parent1Employment.status.replace(/_/g, " "),
      });
    }
  }
  if (!d.isSoleParent && d.parent2Contact) {
    const p2 = d.parent2Contact;
    rows.push({
      label: "Parent / Guardian 2",
      value: [p2.firstName, p2.lastName].filter(Boolean).join(" ") || "—",
    });
    if (d.parent2Employment?.status) {
      rows.push({
        label: "P2 Employment",
        value: d.parent2Employment.status.replace(/_/g, " "),
      });
    }
  }
  if (d.isSoleParent) {
    rows.push({ label: "Sole parent / guardian", value: "Yes" });
  }
  return rows;
}

function dependentChildren(raw: unknown): {
  rows: SummaryRow[];
  table?: SummaryTable;
} {
  const d = parseSafe<DependentChildrenData>(raw);
  if (!d) return { rows: [] };
  const children = Array.isArray(d.children) ? d.children : [];
  const rows: SummaryRow[] = [
    {
      label: "Number of dependent children",
      value: String(children.length || d.numberOfDependentChildren || 0),
    },
  ];
  if (children.length === 0) return { rows };
  return {
    rows,
    table: {
      caption: "Dependent children",
      columns: ["Name", "Date registered", "Named on application"],
      rows: children.map((c) => [
        c.name || "—",
        fmtDate(c.dependentStatusDate),
        c.isNamedChild ? "Yes" : "No",
      ]),
    },
  };
}

function dependentElderlyRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<DependentElderlyData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  if (d.hasElderlyAtHome) {
    rows.push({
      label: "Elderly at home",
      value: `Yes — ${d.elderlyAtHome?.length ?? 0} person(s)`,
    });
  } else if (d.hasElderlyAtHome === false) {
    rows.push({ label: "Elderly at home", value: "No" });
  }
  if (d.hasElderlyInCare) {
    rows.push({
      label: "Elderly in care",
      value: `Yes — ${d.elderlyInCare?.length ?? 0} person(s)`,
    });
  } else if (d.hasElderlyInCare === false) {
    rows.push({ label: "Elderly in care", value: "No" });
  }
  return rows;
}

function otherInfoRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<OtherInfoData>(raw);
  if (!d) return [];
  const rows: SummaryRow[] = [];
  if (d.hasCOurtOrder) {
    const amt = d.courtOrderYearAmount
      ? `${fmtCurrency(d.courtOrderYearAmount)}/year`
      : "";
    rows.push({
      label: "Court order / maintenance",
      value: `Yes${amt ? ` — ${amt}` : ""}`,
    });
  }
  if (d.hasInsurancePolicy) {
    rows.push({
      label: "Insurance policy",
      value: `Yes${
        d.insurancePolicyAmount
          ? ` — ${fmtCurrency(d.insurancePolicyAmount)}`
          : ""
      }`,
    });
  }
  if (d.hasOutstandingFees) {
    rows.push({
      label: "Outstanding school fees",
      value: `Yes${
        d.outstandingFeesAmount
          ? ` — ${fmtCurrency(d.outstandingFeesAmount)}`
          : ""
      }`,
    });
  }
  if (rows.length === 0) {
    rows.push({ label: "No special circumstances declared", value: "" });
  }
  return rows;
}

function parentsIncome(raw: unknown): {
  rows: SummaryRow[];
  tables: SummaryTable[];
} {
  const d = parseSafe<ParentsIncomeData>(raw);
  if (!d) return { rows: [], tables: [] };
  const tables: SummaryTable[] = [];
  let combined = 0;
  // The income readers accept `unknown` (back-compat: both the new
  // status-driven shape and any legacy flat draft), so take unknown here.
  const buildFor = (inc: unknown, label: string) => {
    if (!inc) return;
    const total = parentIncomeTotal(inc);
    combined += total;
    const items = readIncomeItems(inc).filter((i) => i.value > 0);
    tables.push({
      caption: `${label} — total ${fmtCurrency(total)}`,
      columns: ["Income source", "Amount"],
      rows:
        items.length > 0
          ? items.map((i) => [i.label, fmtCurrency(i.value)])
          : [["No income items declared", "—"]],
    });
  };
  buildFor(d.parent1Income, "Parent / Guardian 1");
  buildFor(d.parent2Income, "Parent / Guardian 2");
  return {
    rows: [{ label: "Combined total income", value: fmtCurrency(combined) }],
    tables,
  };
}

function assetsRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<AssetsLiabilitiesData>(raw);
  if (!d) return [];
  const otherProperties = Array.isArray(d.otherProperties)
    ? d.otherProperties
    : [];
  const assets =
    (d.residenceValue ?? 0) +
    (d.carValue ?? 0) +
    (d.otherPossessionsValue ?? 0) +
    (d.otherNonFinancialAssetsValue ?? 0) +
    (d.totalCashBalance ?? 0) +
    (d.investmentsValue ?? 0) +
    otherProperties.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const liabilities =
    (d.mortgageBalance ?? 0) +
    otherProperties.reduce((sum, p) => sum + (p.mortgageBalance ?? 0), 0) +
    (d.chargingOrderValue ?? 0) +
    (d.creditCardBalance ?? 0) +
    (d.bankOverdraft ?? 0) +
    (d.loansToAgencies ?? 0) +
    (d.loansToFriendsFamily ?? 0) +
    (d.schoolFeesOwed ?? 0);
  const rows: SummaryRow[] = [
    {
      label: "Property",
      value:
        d.propertyOwnership === "OWN"
          ? "Owns home"
          : d.propertyOwnership === "RENT"
            ? "Rents home"
            : "—",
    },
    { label: "Total assets", value: fmtCurrency(assets) },
    { label: "Total liabilities", value: fmtCurrency(liabilities) },
    { label: "Net assets", value: fmtCurrency(assets - liabilities) },
  ];
  if (d.hasOtherProperties && d.otherProperties?.length) {
    rows.push({
      label: "Other properties",
      value: String(d.otherProperties.length),
    });
  }
  return rows;
}

function additionalInfoRows(raw: unknown): SummaryRow[] {
  const d = parseSafe<AdditionalInfoData>(raw);
  if (!d) return [];
  if (d.additionalNarrative) {
    return [{ label: "Additional information", value: d.additionalNarrative }];
  }
  return [{ label: "Additional information", value: "None provided" }];
}

// ─── Document grouping ──────────────────────────────────────────────────────

const SECTION_DOC_SLOTS: Record<string, string[]> = {
  CHILD_DETAILS: ["BIRTH_CERTIFICATE"],
  FAMILY_ID: [
    "UK_PASSPORT_PARENT_1",
    "PASSPORT_PARENT_1",
    "UK_PASSPORT_PARENT_2",
    "PASSPORT_PARENT_2",
  ],
  PARENT_DETAILS: [
    "EMPLOYMENT_P45_PARENT_1",
    "EMPLOYMENT_P45_PARENT_2",
    "EMPLOYMENT_REDUNDANCY_PARENT_1",
    "EMPLOYMENT_REDUNDANCY_PARENT_2",
  ],
  PARENTS_INCOME: [
    "P60_PARENT_1",
    "P60_PARENT_2",
    "SELF_ASSESSMENT_PARENT_1",
    "SELF_ASSESSMENT_PARENT_2",
    "BENEFITS_EVIDENCE_PARENT_1",
    "BENEFITS_EVIDENCE_PARENT_2",
    "CAPITAL_REPAYMENTS_PARENT_1",
    "CAPITAL_REPAYMENTS_PARENT_2",
    "P45_PARENT_1",
    "P45_PARENT_2",
    "REDUNDANCY_PARENT_1",
    "REDUNDANCY_PARENT_2",
  ],
  ASSETS_LIABILITIES: [
    "COUNCIL_TAX",
    "MAIN_MORTGAGE_STATEMENT",
    "TENANCY_AGREEMENT",
    "HOUSING_BENEFIT_LETTER",
    "RELATIVE_LETTER",
    "BANK_STATEMENT_CURRENT_PARENT_1",
    "BANK_STATEMENT_CURRENT_PARENT_2",
    "BANK_STATEMENT_SAVINGS_PARENT_1",
    "BANK_STATEMENT_SAVINGS_PARENT_2",
    "INVESTMENT_PARENT_1",
    "INVESTMENT_PARENT_2",
    "CREDIT_CARD_STATEMENT",
    "LOAN_STATEMENT",
    "OTHER_DEBT_DOCUMENT",
    "CAR_LEASE_AGREEMENT",
  ],
};

function documentsForSection(
  sectionType: string,
  allDocs: { slot: string; filename: string }[]
): { slot: string; label: string; filename: string }[] {
  const slots = SECTION_DOC_SLOTS[sectionType];
  if (!slots) return [];
  return allDocs
    .filter((d) => slots.includes(d.slot))
    .map((d) => ({
      slot: d.slot,
      label: humaniseSlot(d.slot),
      filename: d.filename,
    }));
}

// ─── Public builder ─────────────────────────────────────────────────────────

export interface SummaryInput {
  /** Section blobs keyed by ApplicationSectionType. */
  sections: { section: string; data: unknown }[];
  /** All documents uploaded against the application. */
  documents: { slot: string; filename: string }[];
}

/**
 * Builds the ordered, read-only summary of a submitted application. Sections
 * with no derivable rows are omitted so the summary never shows empty cards.
 */
export function buildSubmittedSummary(input: SummaryInput): SubmittedSummary {
  const dataMap = new Map<string, unknown>();
  for (const s of input.sections) dataMap.set(s.section, s.data);

  const sections: SummarySection[] = [];

  for (const sectionType of SUMMARY_SECTION_ORDER) {
    const raw = dataMap.get(sectionType);
    let rows: SummaryRow[] = [];
    let tables: SummaryTable[] | undefined;

    switch (sectionType) {
      case "CHILD_DETAILS":
        rows = childDetailsRows(raw);
        break;
      case "FAMILY_ID":
        rows = familyIdRows(raw);
        break;
      case "PARENT_DETAILS":
        rows = parentDetailsRows(raw);
        break;
      case "DEPENDENT_CHILDREN": {
        const dc = dependentChildren(raw);
        rows = dc.rows;
        tables = dc.table ? [dc.table] : undefined;
        break;
      }
      case "DEPENDENT_ELDERLY":
        rows = dependentElderlyRows(raw);
        break;
      case "OTHER_INFO":
        rows = otherInfoRows(raw);
        break;
      case "PARENTS_INCOME": {
        const pi = parentsIncome(raw);
        rows = pi.rows;
        tables = pi.tables.length ? pi.tables : undefined;
        break;
      }
      case "ASSETS_LIABILITIES":
        rows = assetsRows(raw);
        break;
      case "ADDITIONAL_INFO":
        rows = additionalInfoRows(raw);
        break;
    }

    const documents = documentsForSection(sectionType, input.documents);

    // Skip a section that has nothing to show (e.g. FAMILY_ID on a rolling-over
    // application, or an empty optional section).
    if (rows.length === 0 && !tables && documents.length === 0) continue;

    sections.push({
      sectionType,
      title: SECTION_TITLES[sectionType] ?? sectionType,
      rows,
      tables,
      documents: documents.length ? documents : undefined,
    });
  }

  return { sections };
}
