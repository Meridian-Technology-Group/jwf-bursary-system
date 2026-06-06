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

// ─── PARENTS_INCOME (legacy flat model — preserved until the income rebuild) ──

function incomeRules(earner: Earner): DocumentRule[] {
  const { suffix, label, prefix } = earnerMeta(earner);
  const inc = `${prefix}Income`;
  // Parent 2 income rules only apply when the Parent 2 income block exists in
  // the saved blob (mirrors the legacy "if (data.parent2Income)" gate).
  const onlyIfExistsPath = earner === "PARENT_2" ? inc : undefined;
  return [
    {
      kind: "requiredAlways",
      id: `P60${suffix}`,
      onlyIfExistsPath,
      label: `P60 for ${label} is required`,
      fieldRef: `${inc}.p60DocumentId`,
      doc: { docIdPath: `${inc}.p60DocumentId`, slot: `P60${suffix}` },
    },
    {
      kind: "requiredIfValueGt0",
      id: `SELF_ASSESSMENT${suffix}`,
      onlyIfExistsPath,
      valuePaths: [
        `${inc}.allDividendIncome`,
        `${inc}.grossRentsReceived`,
        `${inc}.allIncomeBonds`,
      ],
      label: `Self-assessment tax return (SA302) for ${label} is required when dividend, rental, or bond income is declared`,
      fieldRef: `${inc}.selfAssessmentDocumentId`,
      doc: {
        docIdPath: `${inc}.selfAssessmentDocumentId`,
        slot: `SELF_ASSESSMENT${suffix}`,
      },
    },
    {
      kind: "requiredIfValueGt0",
      id: `BENEFITS_EVIDENCE${suffix}`,
      onlyIfExistsPath,
      valuePaths: [
        `${inc}.workingTaxCredits`,
        `${inc}.otherBenefitsAndCommissions`,
      ],
      label: `Benefits evidence for ${label} is required when tax credits or benefits income is declared`,
      fieldRef: `${inc}.benefitsEvidenceDocumentId`,
      doc: {
        docIdPath: `${inc}.benefitsEvidenceDocumentId`,
        slot: `BENEFITS_EVIDENCE${suffix}`,
      },
    },
    {
      kind: "requiredIfTrue",
      id: `CAPITAL_REPAYMENTS${suffix}`,
      truePath: `${inc}.hasCapitalRepayments`,
      onlyIfExistsPath,
      label: `Capital repayments evidence for ${label} is required`,
      fieldRef: `${inc}.capitalRepaymentsDocumentId`,
      doc: {
        docIdPath: `${inc}.capitalRepaymentsDocumentId`,
        slot: `CAPITAL_REPAYMENTS${suffix}`,
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
  DEPENDENT_ELDERLY: [],
  OTHER_INFO: [],
  PARENTS_INCOME: [...incomeRules("PARENT_1"), ...incomeRules("PARENT_2")],
  ASSETS_LIABILITIES: assetsRules,
  ADDITIONAL_INFO: [],
  DECLARATION: [],
};

// Re-export the earner rule builders so the income rebuild PR can compose the
// status-driven sub-table rules without re-deriving the suffix/label/prefix.
export { earnerMeta, parentDetailsRules, incomeRules };
