/**
 * section-rules.ts — the declarative rule set per ApplicationSectionType.
 *
 * Consumed by `section-gaps.ts` through the generic evaluator in
 * `document-rules.ts`. This file is the single place required-document and
 * structural rules are declared; adding a rule is a data edit here, not a new
 * hand-coded evaluator.
 *
 * The rules below reproduce the legacy `SECTION_EVALUATORS` behaviour exactly so
 * the engine swap is provably behaviour-preserving (see section-rules.test.ts).
 * Income sub-table rules (status-driven) are layered on in a follow-up PR; the
 * current PARENTS_INCOME rules match today's flat model.
 */

import type {
  DocumentRule,
  SectionType,
  StructuralRule,
} from "@/lib/portal/document-rules";
import {
  familyIdSlot,
  ilrDocumentIdOf,
  passportDocumentIdOf,
} from "@/lib/portal/family-id-documents";

// ─── per-parent rule builders ────────────────────────────────────────────────

type Earner = "PARENT_1" | "PARENT_2";

function earnerMeta(earner: Earner) {
  const suffix = earner === "PARENT_1" ? "_PARENT_1" : "_PARENT_2";
  const label = earner === "PARENT_1" ? "Parent/Guardian 1" : "Parent/Guardian 2";
  const prefix = earner === "PARENT_1" ? "parent1" : "parent2";
  return { suffix, label, prefix };
}

// ─── PARENT_DETAILS ──────────────────────────────────────────────────────────

function parentDetailsRules(earner: Earner): DocumentRule[] {
  const { suffix, label, prefix } = earnerMeta(earner);
  const empPath = `${prefix}Employment`;
  // Parent 2 rules only apply when the Parent 2 employment block exists in the
  // saved blob (mirrors the legacy "if (data.parent2Employment)" gate).
  const onlyIfExistsPath = earner === "PARENT_2" ? empPath : undefined;
  // This page's P45 / redundancy uploads use their OWN dedicated slots
  // (EMPLOYMENT_P45 / EMPLOYMENT_REDUNDANCY), separate from the income section's
  // P45 / REDUNDANCY slots — the applicant uploads in each section independently.
  return [
    {
      kind: "requiredIfTrue",
      id: `EMPLOYMENT_P45${suffix}`,
      truePath: `${empPath}.leftEmployment`,
      onlyIfExistsPath,
      label: `Evidence (P45) for ${label} is required because they left employment in the last 12 months`,
      fieldRef: `${empPath}.p45DocumentId`,
      doc: {
        docIdPath: `${empPath}.p45DocumentId`,
        slot: `EMPLOYMENT_P45${suffix}`,
      },
    },
    {
      kind: "requiredIfTrue",
      id: `EMPLOYMENT_REDUNDANCY${suffix}`,
      truePath: `${empPath}.receivedRedundancy`,
      onlyIfExistsPath,
      label: `Evidence of redundancy / severance package for ${label} is required`,
      fieldRef: `${empPath}.redundancyDocumentId`,
      doc: {
        docIdPath: `${empPath}.redundancyDocumentId`,
        slot: `EMPLOYMENT_REDUNDANCY${suffix}`,
      },
    },
  ];
}

// ─── PARENT_DETAILS household evidence (Epic 09) ─────────────────────────────
//
// Household-level (not per-earner) evidence asks driven by the relationship
// status. Death certificate (H3 widowed) is an equality gate → a structural
// predicate, an error-severity gap that blocks submit until the document is
// provided, mirroring the left-self-employment / scholarship asks.
//
// The guardianship-evidence gate (H4, D16) was removed alongside the foster
// carer / legal guardian question on the Parent/Guardian Details page; the
// engine's `isGuardian` facet is retained only for back-compat.

function householdEvidenceRules(): DocumentRule[] {
  return [
    {
      kind: "structural",
      id: "DEATH_CERTIFICATE",
      label: "A death certificate is required for a widowed parent/guardian",
      fieldRef: "deathCertificateDocumentId",
      predicate: (blob, uploadedSlots) => {
        if (blob.relationshipStatus !== "WIDOWED") return true; // not applicable
        const id = blob.deathCertificateDocumentId;
        return (
          (typeof id === "string" && id.length > 0) ||
          uploadedSlots.has("DEATH_CERTIFICATE")
        );
      },
    },
  ];
}

// ─── PARENTS_INCOME (status-driven sub-tables — Epic 02, D3) ──────────────────
//
// The workbook rule: "if a sub-section has a value other than £0, its upload is
// mandatory — except Child Benefit." Each rule is gated on the relevant
// sub-block existing in the saved blob (`onlyIfExistsPath`) AND on the value
// being > 0 (`requiredIfValueGt0`) or, for the Employed P60-or-payslip pair, on
// the salary being > 0 (`requiredOneOf` gate). Parent 2 rules carry an
// additional `${inc}` existence gate so they never fire for a sole parent.

function incomeRules(earner: Earner): DocumentRule[] {
  const { suffix, label, prefix } = earnerMeta(earner);
  const inc = `${prefix}Income`;
  const emp = `${inc}.employed`;
  const se = `${inc}.selfEmployed`;
  const ben = `${inc}.benefits`;
  const unemp = `${inc}.unemployed`;
  const ret = `${inc}.retired`;
  const div = `${inc}.divorcedSeparated`;

  return [
    // Employed — both a P60 AND a March payslip required when salary > 0.
    {
      kind: "requiredIfValueGt0",
      id: `EMPLOYED_P60${suffix}`,
      onlyIfExistsPath: emp,
      valuePaths: [`${emp}.annualSalaryPaye`],
      label: `${label}: a P60 is required for declared employed income`,
      fieldRef: `${emp}.p60DocumentId`,
      doc: { docIdPath: `${emp}.p60DocumentId`, slot: `P60${suffix}` },
    },
    {
      kind: "requiredIfValueGt0",
      id: `EMPLOYED_MARCH_PAYSLIP${suffix}`,
      onlyIfExistsPath: emp,
      valuePaths: [`${emp}.annualSalaryPaye`],
      label: `${label}: a March payslip is required for declared employed income`,
      fieldRef: `${emp}.marchPayslipDocumentId`,
      doc: {
        docIdPath: `${emp}.marchPayslipDocumentId`,
        slot: `MARCH_PAYSLIP${suffix}`,
      },
    },

    // Self-employed — SA302 required when any SE cell > 0.
    {
      kind: "requiredIfValueGt0",
      id: `SA302${suffix}`,
      onlyIfExistsPath: se,
      valuePaths: [
        `${se}.grossSalaried`,
        `${se}.propertyIncome`,
        `${se}.dividends`,
        `${se}.otherInvestmentIncome`,
      ],
      label: `${label}: an SA302 tax calculation is required for declared self-employed income`,
      fieldRef: `${se}.sa302DocumentId`,
      doc: { docIdPath: `${se}.sa302DocumentId`, slot: `SA302${suffix}` },
    },

    // Benefits — UC statement + monthly when UC > 0.
    {
      kind: "requiredIfValueGt0",
      id: `UC_STATEMENT${suffix}`,
      onlyIfExistsPath: ben,
      valuePaths: [`${ben}.universalCredit`],
      label: `${label}: a Universal Credit 12-month statement is required`,
      fieldRef: `${ben}.ucStatementDocumentId`,
      doc: {
        docIdPath: `${ben}.ucStatementDocumentId`,
        slot: `UC_STATEMENT${suffix}`,
      },
    },
    // CF-28 — this label has always said "3", but the check was satisfied by a
    // single upload, so Charlotte received applications carrying one month's
    // evidence (sometimes the SAME file three times) where three months were
    // asked for. `minCount: 3` makes the rule mean what the label says; with
    // the statement above it, Universal Credit now needs 4 documents in total.
    // The three sibling slots are the repeat-upload block in the income form;
    // the legacy single `UC_MONTHLY…` slot stays first in the list so documents
    // uploaded before this change still count.
    {
      kind: "requiredIfValueGt0",
      id: `UC_MONTHLY${suffix}`,
      onlyIfExistsPath: ben,
      valuePaths: [`${ben}.universalCredit`],
      label: `${label}: 3 monthly Universal Credit payment documents are required (3 different months)`,
      fieldRef: `${ben}.ucMonthlyDocumentIds`,
      doc: {
        docIdPath: `${ben}.ucMonthlyDocumentIds`,
        slot: `UC_MONTHLY${suffix}`,
        slots: [
          `UC_MONTHLY_1${suffix}`,
          `UC_MONTHLY_2${suffix}`,
          `UC_MONTHLY_3${suffix}`,
        ],
        minCount: 3,
      },
    },
    // Housing Benefit — award letter when HB > 0.
    {
      kind: "requiredIfValueGt0",
      id: `HOUSING_BENEFIT${suffix}`,
      onlyIfExistsPath: ben,
      valuePaths: [`${ben}.housingBenefit`],
      label: `${label}: a Housing Benefit award letter is required`,
      fieldRef: `${ben}.housingBenefitDocumentId`,
      doc: {
        docIdPath: `${ben}.housingBenefitDocumentId`,
        slot: `HOUSING_BENEFIT${suffix}`,
      },
    },
    // Other benefits — evidence when any non-CB benefit > 0. Child Benefit is
    // INTENTIONALLY excluded from valuePaths (workbook: CB upload non-mandatory).
    {
      kind: "requiredIfValueGt0",
      id: `OTHER_BENEFITS${suffix}`,
      onlyIfExistsPath: ben,
      valuePaths: [
        `${ben}.childWorkingTaxCredit`,
        `${ben}.esa`,
        `${ben}.pipOrDla`,
        `${ben}.carersAllowance`,
        `${ben}.childcareSupport`,
        `${ben}.other`,
      ],
      label: `${label}: evidence of the declared benefits (tax credits / ESA / PIP / Carer's / childcare / other) is required`,
      fieldRef: `${ben}.otherBenefitsDocumentId`,
      doc: {
        docIdPath: `${ben}.otherBenefitsDocumentId`,
        slot: `OTHER_BENEFITS${suffix}`,
      },
    },

    // Unemployed — per-row uploads when the matching cell > 0.
    {
      kind: "requiredIfValueGt0",
      id: `P45${suffix}`,
      onlyIfExistsPath: unemp,
      valuePaths: [`${unemp}.finalGrossPay`],
      label: `${label}: a P45 is required for declared final gross pay`,
      fieldRef: `${unemp}.p45DocumentId`,
      doc: { docIdPath: `${unemp}.p45DocumentId`, slot: `P45${suffix}` },
    },
    {
      kind: "requiredIfValueGt0",
      id: `REDUNDANCY${suffix}`,
      onlyIfExistsPath: unemp,
      valuePaths: [`${unemp}.redundancy`],
      label: `${label}: a redundancy / severance letter is required`,
      fieldRef: `${unemp}.redundancyDocumentId`,
      doc: {
        docIdPath: `${unemp}.redundancyDocumentId`,
        slot: `REDUNDANCY${suffix}`,
      },
    },
    {
      kind: "requiredIfValueGt0",
      id: `JSA${suffix}`,
      onlyIfExistsPath: unemp,
      valuePaths: [`${unemp}.jsa`],
      label: `${label}: a Job Seeker's Allowance award letter is required`,
      fieldRef: `${unemp}.jsaDocumentId`,
      doc: { docIdPath: `${unemp}.jsaDocumentId`, slot: `JSA${suffix}` },
    },
    {
      kind: "requiredIfValueGt0",
      id: `GRANT_SUPPORT${suffix}`,
      onlyIfExistsPath: unemp,
      valuePaths: [`${unemp}.grantSupport`],
      label: `${label}: a grant / support letter is required`,
      fieldRef: `${unemp}.grantSupportDocumentId`,
      doc: {
        docIdPath: `${unemp}.grantSupportDocumentId`,
        slot: `GRANT_SUPPORT${suffix}`,
      },
    },
    {
      kind: "requiredIfValueGt0",
      id: `LEAVE_PAY${suffix}`,
      onlyIfExistsPath: unemp,
      valuePaths: [`${unemp}.leavePay`],
      label: `${label}: a status-change document for parental / adoption / sickness pay is required`,
      fieldRef: `${unemp}.leavePayDocumentId`,
      doc: {
        docIdPath: `${unemp}.leavePayDocumentId`,
        slot: `LEAVE_PAY${suffix}`,
      },
    },

    // Retired — pension docs when any pension > 0.
    {
      kind: "requiredIfValueGt0",
      id: `PENSION${suffix}`,
      onlyIfExistsPath: ret,
      valuePaths: [`${ret}.statePension`, `${ret}.privatePension`],
      label: `${label}: pension documentation is required for declared pension income`,
      fieldRef: `${ret}.pensionDocumentId`,
      doc: { docIdPath: `${ret}.pensionDocumentId`, slot: `PENSION${suffix}` },
    },

    // Divorced / separated — maintenance letter when received > 0.
    {
      kind: "requiredIfValueGt0",
      id: `MAINTENANCE${suffix}`,
      onlyIfExistsPath: div,
      valuePaths: [`${div}.maintenanceReceived`],
      label: `${label}: a letter evidencing the child maintenance received is required`,
      fieldRef: `${div}.maintenanceDocumentId`,
      doc: {
        docIdPath: `${div}.maintenanceDocumentId`,
        slot: `MAINTENANCE${suffix}`,
      },
    },
  ];
}

// ─── DEPENDENT_CHILDREN structural rules ─────────────────────────────────────

const dependentChildrenStructural: StructuralRule[] = [
  {
    kind: "structural",
    id: "at_least_one",
    label: "At least one dependent child must be added",
    fieldRef: "children",
    predicate: (blob) => {
      const children = blob.children;
      return Array.isArray(children) && children.length > 0;
    },
  },
  {
    kind: "structural",
    id: "named_child",
    label: "Exactly one child must be marked as the named child of this application",
    fieldRef: "children",
    predicate: (blob) => {
      const children = blob.children;
      if (!Array.isArray(children) || children.length === 0) return true; // covered by at_least_one
      const named = children.filter(
        (c) => (c as { isNamedChild?: unknown })?.isNamedChild === true
      ).length;
      return named === 1;
    },
  },
];

// ─── ASSETS_LIABILITIES rules ────────────────────────────────────────────────

const assetsRules: DocumentRule[] = [
  // Council tax letter — always required once the section is started (workbook Q4).
  {
    kind: "requiredAlways",
    id: "COUNCIL_TAX",
    label: "Council tax bill is required",
    fieldRef: "councilTaxDocumentId",
    doc: { docIdPath: "councilTaxDocumentId", slot: "COUNCIL_TAX" },
  },
  // OWN branch — latest main mortgage statement when a mortgage is declared.
  // Gated on propertyOwnership too: the upload only renders inside the OWN
  // branch, so without that guard a stale `hasMortgage` left behind by
  // switching OWN → RENT raises a gap the applicant cannot see or satisfy.
  {
    kind: "structural",
    id: "MAIN_MORTGAGE_STATEMENT",
    label: "Your latest mortgage statement is required",
    fieldRef: "mortgageStatementDocumentId",
    predicate: (blob, uploadedSlots) => {
      if (blob.propertyOwnership !== "OWN") return true; // branch not shown
      if (blob.hasMortgage !== true) return true; // not applicable
      const id = blob.mortgageStatementDocumentId;
      return (
        (typeof id === "string" && id.length > 0) ||
        uploadedSlots.has("MAIN_MORTGAGE_STATEMENT")
      );
    },
  },
  // RENT branch — tenancy agreement when renting privately or from the council.
  {
    kind: "structural",
    id: "TENANCY_AGREEMENT",
    label: "A tenancy agreement is required for your rent arrangement",
    fieldRef: "tenancyAgreementDocumentId",
    predicate: (blob, uploadedSlots) => {
      if (blob.propertyOwnership !== "RENT") return true; // branch not shown
      const type = blob.rentAgreementType;
      if (type !== "PRIVATE" && type !== "COUNCIL") return true; // not applicable
      const id = blob.tenancyAgreementDocumentId;
      return (
        (typeof id === "string" && id.length > 0) ||
        uploadedSlots.has("TENANCY_AGREEMENT")
      );
    },
  },
  // RENT branch — housing benefit letter when renting from the council, no rent.
  {
    kind: "structural",
    id: "HOUSING_BENEFIT_LETTER",
    label: "A housing benefit letter is required for your rent arrangement",
    fieldRef: "housingBenefitLetterDocumentId",
    predicate: (blob, uploadedSlots) => {
      if (blob.propertyOwnership !== "RENT") return true; // branch not shown
      if (blob.rentAgreementType !== "COUNCIL_NO_RENT") return true; // not applicable
      const id = blob.housingBenefitLetterDocumentId;
      return (
        (typeof id === "string" && id.length > 0) ||
        uploadedSlots.has("HOUSING_BENEFIT_LETTER")
      );
    },
  },
  // RENT branch — relative letter when living with relatives.
  {
    kind: "structural",
    id: "RELATIVE_LETTER",
    label:
      "A letter from your relative is required for your living arrangement",
    fieldRef: "relativeLetterDocumentId",
    predicate: (blob, uploadedSlots) => {
      if (blob.propertyOwnership !== "RENT") return true; // branch not shown
      if (blob.rentAgreementType !== "RELATIVES") return true; // not applicable
      const id = blob.relativeLetterDocumentId;
      return (
        (typeof id === "string" && id.length > 0) ||
        uploadedSlots.has("RELATIVE_LETTER")
      );
    },
  },
  // Per other-property: latest mortgage statement required when a mortgage
  // balance is declared (workbook §6/7 Q2). Gated on `hasOtherProperties` like
  // CREDIT_CARD_STATEMENT above: the property cards — and the per-property
  // upload control — render only inside that branch, so a stale
  // `otherProperties` entry left behind by switching the branch off must not
  // raise a gap the applicant has no way to satisfy.
  {
    kind: "arrayForEach",
    id: "OTHER_PROPERTY_MORTGAGE_STATEMENT",
    label: "A mortgage statement is required for each mortgaged property",
    arrayPath: "otherProperties",
    elementDoc: {
      docIdPath: "mortgageStatementDocumentId",
      slotPrefix: "OTHER_PROPERTY_MORTGAGE_",
    },
    elementGate: (el, blob) => {
      if (blob.hasOtherProperties !== true) return false; // not applicable
      return Number(el.mortgageBalance ?? 0) > 0;
    },
    elementLabel: (i) =>
      `A latest mortgage statement is required for other property ${i}`,
  },
  // Current-account bank statements — Parent/Guardian 1 always (≥1).
  {
    kind: "structural",
    id: "BANK_STATEMENT_CURRENT_PARENT_1",
    label:
      "At least one current-account statement for Parent/Guardian 1 is required",
    fieldRef: "parent1CurrentAccountDocumentIds",
    predicate: (blob, uploadedSlots) => {
      const ids = blob.parent1CurrentAccountDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("BANK_STATEMENT_CURRENT_PARENT_1");
    },
  },
  // Current-account bank statements — Parent/Guardian 2, only when the P2 block
  // was shown (its array key is present in the saved blob, OR a P2 slot exists).
  // Mirrors the legacy "p2WasShown" gate exactly.
  {
    kind: "structural",
    id: "BANK_STATEMENT_CURRENT_PARENT_2",
    label:
      "At least one current-account statement for Parent/Guardian 2 is required",
    fieldRef: "parent2CurrentAccountDocumentIds",
    predicate: (blob, uploadedSlots) => {
      const ids = blob.parent2CurrentAccountDocumentIds;
      const inSlot = uploadedSlots.has("BANK_STATEMENT_CURRENT_PARENT_2");
      const wasShown = Array.isArray(ids) || inSlot;
      if (!wasShown) return true;
      return (Array.isArray(ids) && ids.length > 0) || inSlot;
    },
  },
  // Investment documents — Parent/Guardian 1 when they own investments.
  {
    kind: "structural",
    id: "INVESTMENT_PARENT_1",
    label: "Investment / portfolio documents for Parent/Guardian 1 are required",
    fieldRef: "parent1InvestmentDocumentIds",
    predicate: (blob, uploadedSlots) => {
      if (blob.parent1OwnsInvestments !== true) return true; // not applicable
      const ids = blob.parent1InvestmentDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("INVESTMENT_PARENT_1");
    },
  },
  // Investment documents — Parent/Guardian 2 when they own investments.
  {
    kind: "structural",
    id: "INVESTMENT_PARENT_2",
    label: "Investment / portfolio documents for Parent/Guardian 2 are required",
    fieldRef: "parent2InvestmentDocumentIds",
    predicate: (blob, uploadedSlots) => {
      if (blob.parent2OwnsInvestments !== true) return true; // not applicable
      const ids = blob.parent2InvestmentDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("INVESTMENT_PARENT_2");
    },
  },
  // Credit card statement — when personal debt is declared AND a balance > 0.
  {
    kind: "structural",
    id: "CREDIT_CARD_STATEMENT",
    label: "A credit card statement is required for the declared balance",
    fieldRef: "creditCardStatementDocumentIds",
    predicate: (blob, uploadedSlots) => {
      if (blob.hasPersonalDebt !== true) return true; // not applicable
      if (Number(blob.creditCardBalance ?? 0) <= 0) return true; // no balance
      const ids = blob.creditCardStatementDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("CREDIT_CARD_STATEMENT");
    },
  },
  // Loan statement AND loan agreement — both required when a credit-agency loan
  // balance is declared (CF-30: the statement is no longer optional, and the
  // agreement is a new compulsory ask). Gated on `hasPersonalDebt` exactly like
  // CREDIT_CARD_STATEMENT above: both uploads render only inside that branch.
  {
    kind: "structural",
    id: "LOAN_STATEMENT",
    label: "A loan statement is required for the declared loan balance",
    fieldRef: "loanStatementDocumentIds",
    predicate: (blob, uploadedSlots) => {
      if (blob.hasPersonalDebt !== true) return true; // not applicable
      if (Number(blob.loansToAgencies ?? 0) <= 0) return true; // no balance
      const ids = blob.loanStatementDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("LOAN_STATEMENT");
    },
  },
  {
    kind: "structural",
    id: "LOAN_AGREEMENT",
    label: "A loan agreement is required for the declared loan balance",
    fieldRef: "loanAgreementDocumentIds",
    predicate: (blob, uploadedSlots) => {
      if (blob.hasPersonalDebt !== true) return true; // not applicable
      if (Number(blob.loansToAgencies ?? 0) <= 0) return true; // no balance
      const ids = blob.loanAgreementDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("LOAN_AGREEMENT");
    },
  },
];

// ─── DEPENDENT_ELDERLY rules ─────────────────────────────────────────────────

const dependentElderlyRules: DocumentRule[] = [
  // Per in-care elder: latest care-home invoice required (workbook §4 Q13).
  // Gated on `hasElderlyInCare` for the same reason as
  // OTHER_PROPERTY_MORTGAGE_STATEMENT: the elder cards — and the per-elder
  // upload control — render only inside that branch, so an entry stranded by
  // switching the branch back off must not raise an unsatisfiable gap.
  {
    kind: "arrayForEach",
    id: "CARE_HOME_INVOICE",
    label: "A care-home invoice is required for each elderly dependant in care",
    arrayPath: "elderlyInCare",
    elementDoc: {
      docIdPath: "careHomeInvoiceDocumentId",
      slotPrefix: "CARE_HOME_INVOICE_",
    },
    elementGate: (_el, blob) => blob.hasElderlyInCare === true,
    elementLabel: (i, el) =>
      `A latest care-home invoice is required for ${
        (el.firstName as string) ?? `dependant ${i}`
      }`,
  },
];

// ─── OTHER_INFO rules ────────────────────────────────────────────────────────

const otherInfoRules: DocumentRule[] = [
  {
    kind: "requiredIfTrue",
    id: "COURT_ORDER_EVIDENCE",
    truePath: "hasCOurtOrder",
    label: "Evidence of the court order for school fees is required",
    fieldRef: "courtOrderDocumentId",
    doc: { docIdPath: "courtOrderDocumentId", slot: "COURT_ORDER" },
  },
  {
    kind: "requiredIfTrue",
    id: "INSURANCE_POLICY_EVIDENCE",
    truePath: "hasInsurancePolicy",
    label: "Evidence of the school-fee insurance policy is required",
    fieldRef: "insurancePolicyDocumentId",
    doc: { docIdPath: "insurancePolicyDocumentId", slot: "INSURANCE_POLICY" },
  },
  // Decree absolute required when YOU pay maintenance AND you are divorced
  // (workbook §5 Q2).
  {
    kind: "requiredIfTrue",
    id: "MAINTENANCE_DECREE_ABSOLUTE",
    truePath: "maintenanceIsDivorced",
    label: "A decree absolute is required",
    fieldRef: "maintenanceDecreeAbsoluteDocumentId",
    doc: {
      docIdPath: "maintenanceDecreeAbsoluteDocumentId",
      slot: "MAINTENANCE_DECREE_ABSOLUTE",
    },
  },
];

// ─── CHILD_DETAILS ───────────────────────────────────────────────────────────

const childDetailsRules: DocumentRule[] = [
  {
    kind: "requiredAlways",
    id: "BIRTH_CERTIFICATE",
    label: "Birth certificate is required",
    fieldRef: "birthCertificateDocumentId",
    doc: {
      docIdPath: "birthCertificateDocumentId",
      slot: "BIRTH_CERTIFICATE",
    },
  },
];

// ─── FAMILY_ID (identity for all family members — workbook §3 Q10) ────────────
//
// Per family member: British citizen → UK passport; otherwise → passport AND
// evidence of Indefinite Leave to Remain. The form stores per-member doc ids on
// the member object and uploads to indexed slots (FAMILY_ID_PASSPORT_<i> /
// FAMILY_ID_ILR_<i>). This replaces the old `FAMILY_ID: []` no-op (Epic 02 PR-4).
//
// One passport per member, whatever their citizenship: `passportDocumentIdOf`
// reads the current field and falls back to the legacy `ukPassportDocumentId`,
// so applications saved before F2 keep passing (see family-id-documents.ts).
//
// Emitted as a single aggregate structural gap (the per-member upload prompts in
// the form itself give granular guidance); the gate only blocks submission when
// the member's required identity document(s) are missing.

const familyIdRules: DocumentRule[] = [
  {
    kind: "structural",
    id: "MEMBER_IDENTITY",
    label:
      "Identity documents are required for every family member (UK passport, or passport + evidence of Indefinite Leave to Remain)",
    fieldRef: "familyMembers",
    predicate: (blob, uploadedSlots) => {
      const members = blob.familyMembers;
      if (!Array.isArray(members)) return true; // not started
      return members.every((m, i) => {
        if (!m || typeof m !== "object") return true;
        const member = m as Record<string, unknown>;
        const has = (id: unknown, slot: string) =>
          (typeof id === "string" && id.length > 0) || uploadedSlots.has(slot);
        const hasPassport = () =>
          has(passportDocumentIdOf(member), familyIdSlot("PASSPORT", i));
        if (member.isBritishCitizen === true) {
          return hasPassport();
        }
        if (member.isBritishCitizen === false) {
          return (
            hasPassport() &&
            has(ilrDocumentIdOf(member), familyIdSlot("ILR", i))
          );
        }
        // citizenship not yet answered → don't block here (the form requires it)
        return true;
      });
    },
  },
  // Q1: the named child AND the named parent/guardian must each have an identity
  // document uploaded — a single document against the child alone no longer
  // completes the section. (These two rows are auto-added and always required;
  // any extra members the applicant adds are validated by MEMBER_IDENTITY only.)
  {
    kind: "structural",
    id: "CHILD_AND_GUARDIAN_DOCUMENTED",
    label:
      "Upload an identity document for both the child and the parent/guardian named on the application",
    fieldRef: "familyMembers",
    predicate: (blob, uploadedSlots) => {
      const members = blob.familyMembers;
      if (!Array.isArray(members)) return true; // not started
      const hasAnyDoc = (member: Record<string, unknown>, i: number) => {
        const has = (id: unknown, slot: string) =>
          (typeof id === "string" && id.length > 0) || uploadedSlots.has(slot);
        return (
          has(passportDocumentIdOf(member), familyIdSlot("PASSPORT", i)) ||
          has(ilrDocumentIdOf(member), familyIdSlot("ILR", i))
        );
      };
      const roleDocumented = (role: string) =>
        members.some((m, i) => {
          if (!m || typeof m !== "object") return false;
          const member = m as Record<string, unknown>;
          return member.role === role && hasAnyDoc(member, i);
        });
      return roleDocumented("CHILD") && roleDocumented("GUARDIAN");
    },
  },
];

// ─── registry ────────────────────────────────────────────────────────────────

export const SECTION_RULES: Partial<Record<SectionType, DocumentRule[]>> = {
  CHILD_DETAILS: childDetailsRules,
  FAMILY_ID: familyIdRules,
  PARENT_DETAILS: [
    ...parentDetailsRules("PARENT_1"),
    ...parentDetailsRules("PARENT_2"),
    ...householdEvidenceRules(),
  ],
  DEPENDENT_CHILDREN: dependentChildrenStructural,
  DEPENDENT_ELDERLY: dependentElderlyRules,
  OTHER_INFO: otherInfoRules,
  PARENTS_INCOME: [...incomeRules("PARENT_1"), ...incomeRules("PARENT_2")],
  ASSETS_LIABILITIES: assetsRules,
  ADDITIONAL_INFO: [],
  DECLARATION: [],
};

// Re-export the earner rule builders so the income rebuild PR can compose the
// status-driven sub-table rules without re-deriving the suffix/label/prefix.
export { earnerMeta, parentDetailsRules, incomeRules, householdEvidenceRules };
