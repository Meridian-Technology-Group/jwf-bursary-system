/**
 * section-gaps.ts — Single source of truth for portal section completeness.
 *
 * Extends the coarse DB boolean (ApplicationSection.isComplete) with
 * derived gap analysis: required-document checks (conditional on form answers)
 * and structural rules (e.g. dependent-children list constraints).
 *
 * Server-only. Import from Server Components and route handlers only.
 */

import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ApplicationSectionType } from "@prisma/client";
import type {
  ChildDetailsData,
  ParentDetailsData,
  ParentsIncomeData,
  AssetsLiabilitiesData,
  DependentChildrenData,
} from "@/types/application";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SectionType = ApplicationSectionType;

export type GapSeverity = "error" | "warning";

export interface SectionGap {
  /** Stable key — used as a React key and deep-link anchor target. */
  id: string;
  sectionType: SectionType;
  /** Human-readable label shown in the review summary issues panel. */
  label: string;
  severity: GapSeverity;
  /** Optional field path or URL fragment for deep-linking from review summary. */
  fieldRef?: string;
}

export interface SectionGapStatus {
  sectionType: SectionType;
  /** True once the applicant has saved data for this section at least once. */
  isStarted: boolean;
  /** The raw ApplicationSection.isComplete flag stored in the DB. */
  isDbComplete: boolean;
  /** Derived gap list after evaluating document + structural rules. */
  gaps: SectionGap[];
  /**
   * True only when isDbComplete AND no error-severity gaps remain.
   * Warnings do not block validity.
   */
  isFullyValid: boolean;
  /**
   * Numeric progress inputs for a partial-fill progress bar (B2 consumer).
   * total  = 1 (saved form) + required-doc count + structural-rule count
   * satisfied = 1 (if isStarted) + uploaded-required-doc count + satisfied-rule count
   * safe: if total is 0, both are 0 (callers must guard against 0/0).
   */
  progress: { satisfied: number; total: number };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the set of slot strings that have at least one uploaded document. */
async function getUploadedSlots(applicationId: string): Promise<Set<string>> {
  const rows = await prisma.document.findMany({
    where: { applicationId },
    select: { slot: true },
  });
  return new Set(rows.map((r) => r.slot));
}

/** Safely parse a Prisma Json field as a typed object; returns null on failure. */
function parseSectionData<T>(data: unknown): T | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return null;
  return data as T;
}

// ─── Gap evaluator type ───────────────────────────────────────────────────────

/**
 * Each section rule-set is a function:
 *   (formData | null, uploadedSlots) → SectionGap[]
 *
 * formData is null when the section has never been saved.
 * evaluateGaps must handle null gracefully (return [] or minimal gaps).
 */
type GapEvaluator = (
  formData: unknown,
  uploadedSlots: Set<string>
) => SectionGap[];

// ─── Section rule registry ─────────────────────────────────────────────────────
//
// To add a new rule:
//   1. Write a GapEvaluator for the target section.
//   2. Add it to SECTION_EVALUATORS below under the matching SectionType key.
//   3. The progress calculation picks up any new required-doc count automatically.
//
// Convention for gap IDs: "<SECTION_TYPE>:<doc-slot|rule-key>"
// Convention for fieldRef: matches the form field name or URL fragment

const SECTION_EVALUATORS: Partial<Record<SectionType, GapEvaluator>> = {

  // ── Section 1: CHILD_DETAILS ────────────────────────────────────────────────
  // Rule: birth certificate is always required when section has been saved.
  CHILD_DETAILS: (raw, uploadedSlots) => {
    const gaps: SectionGap[] = [];
    const data = parseSectionData<ChildDetailsData>(raw);
    if (!data) return gaps; // Not started yet — no gaps until data exists.

    const hasBirthCert =
      (typeof data.birthCertificateDocumentId === "string" &&
        data.birthCertificateDocumentId.length > 0) ||
      uploadedSlots.has("BIRTH_CERTIFICATE");

    if (!hasBirthCert) {
      gaps.push({
        id: "CHILD_DETAILS:BIRTH_CERTIFICATE",
        sectionType: "CHILD_DETAILS",
        label: "Birth certificate is required",
        severity: "error",
        fieldRef: "birthCertificateDocumentId",
      });
    }

    return gaps;
  },

  // ── Section 2: FAMILY_ID ────────────────────────────────────────────────────
  // Passport/ILR doc requirements are complex (per family member, conditional
  // on citizenship) and stored under dynamic slot keys (FAMILY_ID_PASSPORT_0,
  // FAMILY_ID_ILR_0, …).  The rule logic is left for B2/A4 to encode once the
  // upload UI is finalised.  Pass through with empty gaps for now.
  FAMILY_ID: () => [],

  // ── Section 3: PARENT_DETAILS ───────────────────────────────────────────────
  // Director certified accounts / balance sheet are stored as documentIds in
  // the form data (not as named Document rows with a canonical slot).  The
  // slots are declared in types/application.ts but the FileUpload component
  // for parent-details was not included in the initial scope for gap-checking.
  // B2/A4 should revisit once CERTIFIED_ACCOUNTS_PARENT_* slots are wired.
  PARENT_DETAILS: () => [],

  // ── Section 4: DEPENDENT_CHILDREN ──────────────────────────────────────────
  // Structural rules:
  //   R1 — at least one child must be added to the children array
  //   R2 — exactly one child must be flagged isNamedChild
  DEPENDENT_CHILDREN: (raw) => {
    const gaps: SectionGap[] = [];
    const data = parseSectionData<DependentChildrenData>(raw);
    if (!data) return gaps;

    const children = Array.isArray(data.children) ? data.children : [];

    if (children.length === 0) {
      gaps.push({
        id: "DEPENDENT_CHILDREN:at_least_one",
        sectionType: "DEPENDENT_CHILDREN",
        label: "At least one dependent child must be added",
        severity: "error",
        fieldRef: "children",
      });
    } else {
      const namedCount = children.filter((c) => c.isNamedChild === true).length;
      if (namedCount === 0) {
        gaps.push({
          id: "DEPENDENT_CHILDREN:named_child_missing",
          sectionType: "DEPENDENT_CHILDREN",
          label: "One child must be marked as the named child of this application",
          severity: "error",
          fieldRef: "children",
        });
      } else if (namedCount > 1) {
        gaps.push({
          id: "DEPENDENT_CHILDREN:named_child_duplicate",
          sectionType: "DEPENDENT_CHILDREN",
          label: "Exactly one child should be marked as the named child (currently more than one)",
          severity: "error",
          fieldRef: "children",
        });
      }
    }

    return gaps;
  },

  // ── Section 5: DEPENDENT_ELDERLY ───────────────────────────────────────────
  // Care home invoice docs are stored in form data; B2/A4 to add rules once
  // upload slots are canonical.
  DEPENDENT_ELDERLY: () => [],

  // ── Section 6: OTHER_INFO ───────────────────────────────────────────────────
  // Court order / maintenance docs are optional evidence fields.
  // B2/A4 to encode conditional rules if these become required.
  OTHER_INFO: () => [],

  // ── Section 7: PARENTS_INCOME ──────────────────────────────────────────────
  // Document rules (per earner, conditional on income data):
  //   - P60:              always required for the earner (error if missing)
  //   - SA302/Self-Ass:   required when allDividendIncome > 0 OR grossRentsReceived > 0
  //                       OR allIncomeBonds > 0 (self-assessment income sources)
  //   - Benefits evidence: required when workingTaxCredits > 0
  //                        OR otherBenefitsAndCommissions > 0
  //   - Capital repayments doc: required when hasCapitalRepayments === true
  //
  // Whether parent2 is required is determined by isSoleParent from PARENT_DETAILS.
  // We fetch that separately below; the evaluator receives the full raw section
  // data which includes both parent1Income and parent2Income objects.
  PARENTS_INCOME: (raw, uploadedSlots) => {
    const gaps: SectionGap[] = [];
    const data = parseSectionData<ParentsIncomeData>(raw);
    if (!data) return gaps;

    function evaluateEarner(
      income: ParentsIncomeData["parent1Income"] | undefined,
      earner: "PARENT_1" | "PARENT_2"
    ) {
      if (!income) return;

      const suffix = earner === "PARENT_1" ? "_PARENT_1" : "_PARENT_2";
      const label = earner === "PARENT_1" ? "Parent/Guardian 1" : "Parent/Guardian 2";
      const fieldPrefix = earner === "PARENT_1" ? "parent1Income" : "parent2Income";

      // P60 — always required
      const hasP60 =
        (typeof income.p60DocumentId === "string" && income.p60DocumentId.length > 0) ||
        uploadedSlots.has(`P60${suffix}`);

      if (!hasP60) {
        gaps.push({
          id: `PARENTS_INCOME:P60${suffix}`,
          sectionType: "PARENTS_INCOME",
          label: `P60 for ${label} is required`,
          severity: "error",
          fieldRef: `${fieldPrefix}.p60DocumentId`,
        });
      }

      // SA302 / Self-Assessment — required when dividend, rent, or bond income present
      const needsSelfAssessment =
        (income.allDividendIncome ?? 0) > 0 ||
        (income.grossRentsReceived ?? 0) > 0 ||
        (income.allIncomeBonds ?? 0) > 0;

      if (needsSelfAssessment) {
        const hasSelfAssessment =
          (typeof income.selfAssessmentDocumentId === "string" &&
            income.selfAssessmentDocumentId.length > 0) ||
          uploadedSlots.has(`SELF_ASSESSMENT${suffix}`);

        if (!hasSelfAssessment) {
          gaps.push({
            id: `PARENTS_INCOME:SELF_ASSESSMENT${suffix}`,
            sectionType: "PARENTS_INCOME",
            label: `Self-assessment tax return (SA302) for ${label} is required when dividend, rental, or bond income is declared`,
            severity: "error",
            fieldRef: `${fieldPrefix}.selfAssessmentDocumentId`,
          });
        }
      }

      // Benefits evidence — required when working tax credits or other benefits declared
      const needsBenefitsEvidence =
        (income.workingTaxCredits ?? 0) > 0 ||
        (income.otherBenefitsAndCommissions ?? 0) > 0;

      if (needsBenefitsEvidence) {
        const hasBenefitsEvidence =
          (typeof income.benefitsEvidenceDocumentId === "string" &&
            income.benefitsEvidenceDocumentId.length > 0) ||
          uploadedSlots.has(`BENEFITS_EVIDENCE${suffix}`);

        if (!hasBenefitsEvidence) {
          gaps.push({
            id: `PARENTS_INCOME:BENEFITS_EVIDENCE${suffix}`,
            sectionType: "PARENTS_INCOME",
            label: `Benefits evidence for ${label} is required when tax credits or benefits income is declared`,
            severity: "error",
            fieldRef: `${fieldPrefix}.benefitsEvidenceDocumentId`,
          });
        }
      }

      // Capital repayments document — required when hasCapitalRepayments is true
      if (income.hasCapitalRepayments === true) {
        const hasCapDoc =
          (typeof income.capitalRepaymentsDocumentId === "string" &&
            income.capitalRepaymentsDocumentId.length > 0) ||
          uploadedSlots.has(`CAPITAL_REPAYMENTS${suffix}`);

        if (!hasCapDoc) {
          gaps.push({
            id: `PARENTS_INCOME:CAPITAL_REPAYMENTS${suffix}`,
            sectionType: "PARENTS_INCOME",
            label: `Capital repayments evidence for ${label} is required`,
            severity: "error",
            fieldRef: `${fieldPrefix}.capitalRepaymentsDocumentId`,
          });
        }
      }
    }

    evaluateEarner(data.parent1Income, "PARENT_1");
    // parent2Income is evaluated when present in the saved form data.
    // The PARENTS_INCOME form only includes parent2 when isSoleParent is false,
    // so its presence in the data blob is sufficient to trigger the checks.
    if (data.parent2Income) {
      evaluateEarner(data.parent2Income, "PARENT_2");
    }

    return gaps;
  },

  // ── Section 8: ASSETS_LIABILITIES ──────────────────────────────────────────
  // Document rules:
  //   - Council tax bill:          always required (error)
  //   - Bank statements Parent 1:  always required (error) — at least one
  //   - Bank statements Parent 2:  required when parent2BankStatementDocumentIds
  //                                is present in data (i.e. form was shown)
  //                                OR BANK_STATEMENT_PARENT_2 slot is present
  ASSETS_LIABILITIES: (raw, uploadedSlots) => {
    const gaps: SectionGap[] = [];
    const data = parseSectionData<AssetsLiabilitiesData>(raw);
    if (!data) return gaps;

    // Council tax bill — always required
    const hasCouncilTax =
      (typeof data.councilTaxDocumentId === "string" &&
        data.councilTaxDocumentId.length > 0) ||
      uploadedSlots.has("COUNCIL_TAX");

    if (!hasCouncilTax) {
      gaps.push({
        id: "ASSETS_LIABILITIES:COUNCIL_TAX",
        sectionType: "ASSETS_LIABILITIES",
        label: "Council tax bill is required",
        severity: "error",
        fieldRef: "councilTaxDocumentId",
      });
    }

    // Bank statements — Parent 1 (always required: at least one statement)
    const p1Statements = Array.isArray(data.parent1BankStatementDocumentIds)
      ? data.parent1BankStatementDocumentIds
      : [];
    const hasP1BankStatement =
      p1Statements.length > 0 ||
      uploadedSlots.has("BANK_STATEMENT_PARENT_1");

    if (!hasP1BankStatement) {
      gaps.push({
        id: "ASSETS_LIABILITIES:BANK_STATEMENT_PARENT_1",
        sectionType: "ASSETS_LIABILITIES",
        label: "At least one bank statement for Parent/Guardian 1 is required",
        severity: "error",
        fieldRef: "parent1BankStatementDocumentIds",
      });
    }

    // Bank statements — Parent 2 (required when the field appeared in the form,
    // which we detect by the data key being present and the parent not being sole)
    const p2StatementIds = data.parent2BankStatementDocumentIds;
    const p2StatementInSlot = uploadedSlots.has("BANK_STATEMENT_PARENT_2");
    // If parent2 data was included in the saved blob, we know P2 income was shown
    const p2WasShown =
      Array.isArray(p2StatementIds) || p2StatementInSlot;

    if (p2WasShown) {
      const hasP2BankStatement =
        (Array.isArray(p2StatementIds) && p2StatementIds.length > 0) ||
        p2StatementInSlot;

      if (!hasP2BankStatement) {
        gaps.push({
          id: "ASSETS_LIABILITIES:BANK_STATEMENT_PARENT_2",
          sectionType: "ASSETS_LIABILITIES",
          label: "At least one bank statement for Parent/Guardian 2 is required",
          severity: "error",
          fieldRef: "parent2BankStatementDocumentIds",
        });
      }
    }

    return gaps;
  },

  // ── Section 9: ADDITIONAL_INFO ──────────────────────────────────────────────
  // Circumstance evidence docs are optional; B2/A4 to encode if required.
  ADDITIONAL_INFO: () => [],

  // ── Section 10: DECLARATION ─────────────────────────────────────────────────
  // No documents; DB isComplete flag is sufficient.
  DECLARATION: () => [],
};

// ─── Progress counting helper ─────────────────────────────────────────────────

/**
 * Count how many required-doc items the section rule-set would evaluate,
 * and how many are already satisfied given the current uploadedSlots.
 *
 * We derive this by running the evaluator and counting gaps that relate to
 * documents vs. structural rules (structural rules that would add a gap
 * lower the satisfied count by 1 per unsatisfied rule).
 *
 * Simple model:
 *   total     = 1 (the saved-form item) + (gap slots that exist in the rule-set)
 *   satisfied = 1 (if isStarted) + (required items with no gap)
 *
 * Rather than trying to enumerate "how many total required docs exist" from
 * the evaluator (which is hard without running it in two modes), we instead
 * use the gap list to compute satisfied = total - error_gaps.
 */
function computeProgress(
  isStarted: boolean,
  gaps: SectionGap[],
  sectionType: SectionType
): { satisfied: number; total: number } {
  const hasEvaluator = sectionType in SECTION_EVALUATORS;

  // For sections without an evaluator, total = 1 (saved form), satisfied = 1 if started.
  if (!hasEvaluator) {
    return { satisfied: isStarted ? 1 : 0, total: 1 };
  }

  const errorGaps = gaps.filter((g) => g.severity === "error");

  // total = 1 (form saved item) + number of unique error-contributing slots/rules
  // We compute total dynamically: a section with N potential required items
  // will report exactly those N items when none are satisfied, so
  // total_items = errorGaps.length + (items already satisfied, which we don't know).
  //
  // Conservative approach: total = 1 + error_count_when_nothing_satisfied.
  // But we only know the error count after evaluating, which reflects the
  // *current* state. To get the "maximum possible items", we'd need to call the
  // evaluator with empty data and empty slots, which is expensive.
  //
  // Simpler contract used by B2: satisfied/total reflects current state.
  //   If all required items are provided, gaps=[] → satisfied=total.
  //   If some are missing, satisfied < total.
  //
  // total = 1 (form) + count of required doc/rule items currently PRESENT (satisfied)
  //       + count of required doc/rule items currently MISSING (errorGaps)
  // satisfied = 1 (if isStarted, the form contribution) + count of items NOT in errorGaps
  //
  // Because we don't enumerate "total required items" in the evaluator,
  // we compute it post-hoc from the gap list:
  //
  //   items_total = number of unique gap IDs that WOULD appear when nothing is satisfied
  //
  // The safest approximation: when we have gaps, each gap is one unsatisfied item.
  // We cannot know the satisfied items without a dual-call, so instead:
  //   satisfied = errorGap-count items that ARE satisfied (implied by no gap)
  //   total = satisfied_implied + errorGaps.length
  //
  // Since we can't enumerate "satisfied items" directly from this evaluator model,
  // we use a pragmatic fallback based on known rule counts per section.
  // Known required-item counts per section (including the 1 for form-saved):
  const SECTION_ITEM_TOTALS: Partial<Record<SectionType, number>> = {
    CHILD_DETAILS: 2,           // form(1) + birth_cert(1)
    DEPENDENT_CHILDREN: 3,      // form(1) + at_least_one_child(1) + named_child(1)
    PARENTS_INCOME: 3,          // form(1) + P60_P1(1) + [conditional per P1 answers] — min 2
    // actual total varies; we use 3 as a reasonable minimum
    ASSETS_LIABILITIES: 3,      // form(1) + council_tax(1) + bank_stmt_p1(1)
  };

  const knownTotal = SECTION_ITEM_TOTALS[sectionType];

  if (knownTotal !== undefined) {
    const errCount = errorGaps.length;
    const total = Math.max(knownTotal, 1 + errCount); // never less than 1+current gaps
    const satisfied = isStarted ? Math.max(0, total - errCount) : 0;
    return { satisfied, total };
  }

  // Default: form(1) item only
  return { satisfied: isStarted ? 1 : 0, total: 1 };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns a SectionGapStatus for every ApplicationSectionType, in canonical order.
 *
 * Makes 2 DB round-trips:
 *   1. Load all ApplicationSection rows for the application (data + isComplete).
 *   2. Load all Document rows (slot only) to build the uploaded-slots set.
 */
export async function getSectionGapStatuses(
  applicationId: string
): Promise<SectionGapStatus[]> {
  const [sectionRows, uploadedSlots] = await Promise.all([
    prisma.applicationSection.findMany({
      where: { applicationId },
      select: { section: true, data: true, isComplete: true },
    }),
    getUploadedSlots(applicationId),
  ]);

  // Build quick lookup: SectionType → row
  const rowMap = new Map<
    SectionType,
    { data: unknown; isComplete: boolean }
  >();
  for (const row of sectionRows) {
    rowMap.set(row.section, { data: row.data, isComplete: row.isComplete });
  }

  // Canonical section order (matches portal stepper)
  const SECTION_ORDER: SectionType[] = [
    "CHILD_DETAILS",
    "FAMILY_ID",
    "PARENT_DETAILS",
    "DEPENDENT_CHILDREN",
    "DEPENDENT_ELDERLY",
    "OTHER_INFO",
    "PARENTS_INCOME",
    "ASSETS_LIABILITIES",
    "ADDITIONAL_INFO",
    "DECLARATION",
  ];

  return SECTION_ORDER.map((sectionType) => {
    const row = rowMap.get(sectionType);
    const isStarted = row !== undefined;
    const isDbComplete = row?.isComplete ?? false;

    const evaluator = SECTION_EVALUATORS[sectionType];
    const gaps: SectionGap[] = evaluator
      ? evaluator(row?.data ?? null, uploadedSlots)
      : [];

    const errorGaps = gaps.filter((g) => g.severity === "error");
    const isFullyValid = isDbComplete && errorGaps.length === 0;

    const progress = computeProgress(isStarted, gaps, sectionType);

    return {
      sectionType,
      isStarted,
      isDbComplete,
      gaps,
      isFullyValid,
      progress,
    };
  });
}
