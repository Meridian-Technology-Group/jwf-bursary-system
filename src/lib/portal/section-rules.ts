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
  return [
    {
      kind: "requiredIfTrue",
      id: `LEFT_SELF_EMPLOYMENT${suffix}`,
      truePath: `${empPath}.leftSelfEmployment`,
      onlyIfExistsPath,
      label: `Evidence of previous self-employment for ${label} is required`,
      fieldRef: `${empPath}.leftSelfEmploymentDocumentId`,
      doc: {
        docIdPath: `${empPath}.leftSelfEmploymentDocumentId`,
        slot: `LEFT_SELF_EMPLOYMENT${suffix}`,
      },
    },
    {
      kind: "requiredIfTrue",
      id: `SCHOLARSHIP${suffix}`,
      truePath: `${empPath}.receivesScholarship`,
      onlyIfExistsPath,
      label: `Scholarship / maintenance evidence for ${label} is required`,
      fieldRef: `${empPath}.scholarshipDocumentId`,
      doc: {
        docIdPath: `${empPath}.scholarshipDocumentId`,
        slot: `SCHOLARSHIP${suffix}`,
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
    // Employed — P60 OR March payslip required when salary > 0.
    {
      kind: "requiredOneOf",
      id: `EMPLOYED_P60_OR_PAYSLIP${suffix}`,
      onlyIfExistsPath: emp,
      gateValuePaths: [`${emp}.annualSalaryPaye`],
      label: `${label}: a P60 or March payslip is required for declared employed income`,
      fieldRef: `${emp}.p60DocumentId`,
      docs: [
        { docIdPath: `${emp}.p60DocumentId`, slot: `P60${suffix}` },
        {
          docIdPath: `${emp}.marchPayslipDocumentId`,
          slot: `MARCH_PAYSLIP${suffix}`,
        },
      ],
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
    {
      kind: "requiredIfValueGt0",
      id: `UC_MONTHLY${suffix}`,
      onlyIfExistsPath: ben,
      valuePaths: [`${ben}.universalCredit`],
      label: `${label}: 3 monthly Universal Credit payment documents are required`,
      fieldRef: `${ben}.ucMonthlyDocumentIds`,
      doc: {
        docIdPath: `${ben}.ucMonthlyDocumentIds`,
        slot: `UC_MONTHLY${suffix}`,
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
  {
    kind: "requiredAlways",
    id: "COUNCIL_TAX",
    label: "Council tax bill is required",
    fieldRef: "councilTaxDocumentId",
    doc: { docIdPath: "councilTaxDocumentId", slot: "COUNCIL_TAX" },
  },
  {
    kind: "structural",
    id: "BANK_STATEMENT_PARENT_1",
    label: "At least one bank statement for Parent/Guardian 1 is required",
    fieldRef: "parent1BankStatementDocumentIds",
    predicate: (blob, uploadedSlots) => {
      const ids = blob.parent1BankStatementDocumentIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      return uploadedSlots.has("BANK_STATEMENT_PARENT_1");
    },
  },
  {
    kind: "structural",
    id: "BANK_STATEMENT_PARENT_2",
    label: "At least one bank statement for Parent/Guardian 2 is required",
    fieldRef: "parent2BankStatementDocumentIds",
    predicate: (blob, uploadedSlots) => {
      const ids = blob.parent2BankStatementDocumentIds;
      const inSlot = uploadedSlots.has("BANK_STATEMENT_PARENT_2");
      // Only enforced when the Parent 2 block was shown (its key is present in
      // the saved blob, OR a P2 statement slot exists). Mirrors the legacy
      // "p2WasShown" gate exactly.
      const wasShown = Array.isArray(ids) || inSlot;
      if (!wasShown) return true;
      return (Array.isArray(ids) && ids.length > 0) || inSlot;
    },
  },
  // Per other-property: latest mortgage statement required when a mortgage
  // balance is declared (workbook §6/7 Q2).
  {
    kind: "arrayForEach",
    id: "OTHER_PROPERTY_MORTGAGE_STATEMENT",
    label: "A mortgage statement is required for each mortgaged property",
    arrayPath: "otherProperties",
    elementDoc: {
      docIdPath: "mortgageStatementDocumentId",
      slotPrefix: "OTHER_PROPERTY_MORTGAGE_",
    },
    elementGate: (el) => Number(el.mortgageBalance ?? 0) > 0,
    elementLabel: (i) =>
      `A latest mortgage statement is required for other property ${i}`,
  },
];

// ─── DEPENDENT_ELDERLY rules ─────────────────────────────────────────────────

const dependentElderlyRules: DocumentRule[] = [
  // Per in-care elder: latest care-home invoice required (workbook §4 Q13).
  {
    kind: "arrayForEach",
    id: "CARE_HOME_INVOICE",
    label: "A care-home invoice is required for each elderly dependant in care",
    arrayPath: "elderlyInCare",
    elementDoc: {
      docIdPath: "careHomeInvoiceDocumentId",
      slotPrefix: "CARE_HOME_INVOICE_",
    },
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

// ─── registry ────────────────────────────────────────────────────────────────

export const SECTION_RULES: Partial<Record<SectionType, DocumentRule[]>> = {
  CHILD_DETAILS: childDetailsRules,
  FAMILY_ID: [],
  PARENT_DETAILS: [
    ...parentDetailsRules("PARENT_1"),
    ...parentDetailsRules("PARENT_2"),
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
export { earnerMeta, parentDetailsRules, incomeRules };
