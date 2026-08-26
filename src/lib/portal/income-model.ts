/**
 * income-model.ts — status-driven income helpers + legacy back-compat reader.
 *
 * Epic 02 (D3) replaced the flat 14-line income record with status-driven
 * sub-tables (`ParentIncomeRecord` in types/application.ts). Two kinds of stored
 * blob therefore exist in the wild:
 *
 *   - NEW   — `{ employed?, selfEmployed?, benefits?, … total, documentsConfirmed }`
 *   - LEGACY — the flat `{ salaryWagesPension, supplementsAndBonus, … }` (old
 *             drafts on staging and every already-submitted application, which
 *             are immutable — Epic 01).
 *
 * This module is the single place that understands both shapes:
 *   - `parentIncomeTotal()` sums the numeric cells of EITHER shape.
 *   - `isLegacyIncomeRecord()` discriminates.
 *   - `readIncomeItems()` returns a flat label/value list for the review screen,
 *     working for both shapes (so old drafts/submissions still render).
 *
 * Pure module (no DB / server-only) — usable from the client form and the
 * server review page alike.
 */

import type {
  ParentIncomeRecord,
  LegacyParentIncomeRecord,
} from "@/types/application";

function n(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
}

/**
 * True when the blob is the LEGACY flat shape. We detect it positively: a legacy
 * record has at least one of the old flat keys and none of the new sub-block
 * keys. (A fresh new-shape record has only sub-blocks + total + documentsConfirmed.)
 */
export function isLegacyIncomeRecord(
  rec: unknown
): rec is LegacyParentIncomeRecord {
  if (!rec || typeof rec !== "object") return false;
  const r = rec as Record<string, unknown>;
  const NEW_KEYS = [
    "employed",
    "selfEmployed",
    "benefits",
    "unemployed",
    "retired",
    "divorcedSeparated",
    "thirdParty",
  ];
  if (NEW_KEYS.some((k) => k in r)) return false;
  const LEGACY_KEYS = [
    "salaryWagesPension",
    "supplementsAndBonus",
    "otherBenefitsAndCommissions",
    "amountFromPartner",
    "workingTaxCredits",
    "grossInterestReceived",
    "allDividendIncome",
    "grossRentsReceived",
    "allIncomeBonds",
    "otherGrossIncomes",
    "maintenanceOrEquivalents",
    "bursariesOrSponsorships",
    "otherIncomeNotIncluded",
    "otherIncome",
  ];
  return LEGACY_KEYS.some((k) => k in r);
}

// ─── totals ──────────────────────────────────────────────────────────────────

function legacyTotal(rec: LegacyParentIncomeRecord): number {
  return (
    n(rec.salaryWagesPension) +
    n(rec.supplementsAndBonus) +
    n(rec.otherBenefitsAndCommissions) +
    n(rec.amountFromPartner) +
    n(rec.workingTaxCredits) +
    n(rec.grossInterestReceived) +
    n(rec.allDividendIncome) +
    n(rec.grossRentsReceived) +
    n(rec.allIncomeBonds) +
    n(rec.otherGrossIncomes) +
    n(rec.maintenanceOrEquivalents) +
    n(rec.bursariesOrSponsorships) +
    n(rec.otherIncomeNotIncluded) +
    n(rec.otherIncome)
  );
}

/** Sums the numeric cells of a NEW-shape record across all present sub-blocks. */
export function newIncomeTotal(rec: Partial<ParentIncomeRecord>): number {
  let t = 0;
  if (rec.employed) t += n(rec.employed.annualSalaryPaye);
  if (rec.selfEmployed) {
    t +=
      n(rec.selfEmployed.grossSalaried) +
      n(rec.selfEmployed.propertyIncome) +
      n(rec.selfEmployed.dividends) +
      n(rec.selfEmployed.otherInvestmentIncome);
  }
  if (rec.benefits) {
    const b = rec.benefits;
    t +=
      n(b.universalCredit) +
      n(b.housingBenefit) +
      n(b.childBenefit) +
      n(b.childWorkingTaxCredit) +
      n(b.esa) +
      n(b.pipOrDla) +
      n(b.pip) +
      n(b.carersAllowance) +
      n(b.childcareSupport) +
      n(b.other);
  }
  if (rec.unemployed) {
    const u = rec.unemployed;
    t +=
      n(u.finalGrossPay) +
      n(u.redundancy) +
      n(u.jsa) +
      n(u.grantSupport) +
      n(u.leavePay);
  }
  if (rec.retired) {
    t += n(rec.retired.statePension) + n(rec.retired.privatePension);
  }
  if (rec.divorcedSeparated) {
    t += n(rec.divorcedSeparated.maintenanceReceived);
  }
  if (rec.thirdParty) {
    t += n(rec.thirdParty.incomeSupportReceived);
  }
  return t;
}

/** Total for EITHER shape — the single entry point. */
export function parentIncomeTotal(rec: unknown): number {
  if (isLegacyIncomeRecord(rec)) return legacyTotal(rec);
  if (rec && typeof rec === "object")
    return newIncomeTotal(rec as Partial<ParentIncomeRecord>);
  return 0;
}

// ─── review-screen itemisation (both shapes) ──────────────────────────────────

export interface IncomeItem {
  label: string;
  value: number;
}

function legacyItems(rec: LegacyParentIncomeRecord): IncomeItem[] {
  return [
    { label: "Salary / wages / pension", value: n(rec.salaryWagesPension) },
    { label: "Supplements & bonus", value: n(rec.supplementsAndBonus) },
    { label: "Benefits & commissions", value: n(rec.otherBenefitsAndCommissions) },
    { label: "Amount from partner", value: n(rec.amountFromPartner) },
    { label: "Working tax credits", value: n(rec.workingTaxCredits) },
    { label: "Gross interest", value: n(rec.grossInterestReceived) },
    { label: "Dividend income", value: n(rec.allDividendIncome) },
    { label: "Rental income", value: n(rec.grossRentsReceived) },
    { label: "Income bonds", value: n(rec.allIncomeBonds) },
    { label: "Other gross income", value: n(rec.otherGrossIncomes) },
    { label: "Maintenance / equivalents", value: n(rec.maintenanceOrEquivalents) },
    { label: "Bursaries / sponsorships", value: n(rec.bursariesOrSponsorships) },
    {
      label: "Other income",
      value: n(rec.otherIncomeNotIncluded) + n(rec.otherIncome),
    },
  ];
}

function newItems(rec: Partial<ParentIncomeRecord>): IncomeItem[] {
  const items: IncomeItem[] = [];
  if (rec.employed) {
    items.push({
      label: "Employed — annual salary (PAYE)",
      value: n(rec.employed.annualSalaryPaye),
    });
  }
  if (rec.selfEmployed) {
    const s = rec.selfEmployed;
    items.push(
      { label: "Self-employed — gross earned income", value: n(s.grossSalaried) },
      { label: "Self-employed — property income", value: n(s.propertyIncome) },
      { label: "Self-employed — dividends", value: n(s.dividends) },
      {
        label: "Self-employed — other investment income",
        value: n(s.otherInvestmentIncome),
      }
    );
  }
  if (rec.benefits) {
    const b = rec.benefits;
    items.push(
      { label: "Universal Credit", value: n(b.universalCredit) },
      { label: "Housing Benefit", value: n(b.housingBenefit) },
      { label: "Child Benefit", value: n(b.childBenefit) },
      { label: "Child / Working Tax Credit", value: n(b.childWorkingTaxCredit) },
      { label: "ESA", value: n(b.esa) },
      // CH-58 — DLA and PIP are distinct, recurring, and often large. Reported
      // separately so the assessor sees the composition, and summed separately
      // above so PIP actually counts: with no cell of its own it was not being
      // captured at all, which under-reported income by the whole PIP amount.
      // CH-59 — her wording: applicants know PIP, but not DLA.
      { label: "Disability Allowance", value: n(b.pipOrDla) },
      { label: "PIP", value: n(b.pip) },
      { label: "Carer's Allowance", value: n(b.carersAllowance) },
      { label: "Childcare Support", value: n(b.childcareSupport) },
      { label: "Other benefits", value: n(b.other) }
    );
  }
  if (rec.unemployed) {
    const u = rec.unemployed;
    items.push(
      { label: "Final gross pay", value: n(u.finalGrossPay) },
      { label: "Redundancy / severance", value: n(u.redundancy) },
      { label: "Job Seeker's Allowance", value: n(u.jsa) },
      { label: "Grant / support", value: n(u.grantSupport) },
      { label: "Parental / adoption / sickness pay", value: n(u.leavePay) }
    );
  }
  if (rec.retired) {
    items.push(
      { label: "State Pension", value: n(rec.retired.statePension) },
      { label: "Private Pension & other plan", value: n(rec.retired.privatePension) }
    );
  }
  if (rec.divorcedSeparated) {
    items.push({
      label: "Child Maintenance received",
      value: n(rec.divorcedSeparated.maintenanceReceived),
    });
  }
  if (rec.thirdParty) {
    items.push({
      label: "Additional income support",
      value: n(rec.thirdParty.incomeSupportReceived),
    });
  }
  return items;
}

/**
 * Flat label/value list for the review screen, working for EITHER shape. Callers
 * typically filter to value > 0 for display.
 */
export function readIncomeItems(rec: unknown): IncomeItem[] {
  if (isLegacyIncomeRecord(rec)) return legacyItems(rec);
  if (rec && typeof rec === "object")
    return newItems(rec as Partial<ParentIncomeRecord>);
  return [];
}

// ─── legacy → new normalisation (form load) ──────────────────────────────────

/**
 * Maps a LEGACY flat income record into the NEW status-driven shape so an
 * in-flight draft can be re-edited under the new form without crashing. The
 * mapping is best-effort and unambiguous-only:
 *   - salary/wages/pension → employed.annualSalaryPaye (the bulk of legacy
 *     drafts), carrying the old P60 doc id forward.
 *   - dividends/rents/bonds → selfEmployed cells, carrying the SA302 doc id.
 *   - tax credits/other benefits → benefits cells, carrying the benefits doc id.
 *   - maintenance → divorcedSeparated.maintenanceReceived.
 * Anything that cannot be placed cleanly is dropped; the applicant re-enters it.
 * The caller marks PARENTS_INCOME incomplete so the form re-validates (Epic 02
 * §5.1 migration note).
 */
export function normaliseLegacyIncomeRecord(
  rec: LegacyParentIncomeRecord
): ParentIncomeRecord {
  const out: ParentIncomeRecord = {
    total: 0,
    documentsConfirmed: false,
  };

  const salary =
    n(rec.salaryWagesPension) +
    n(rec.supplementsAndBonus) +
    n(rec.otherBenefitsAndCommissions) +
    n(rec.amountFromPartner) +
    n(rec.bursariesOrSponsorships) +
    n(rec.otherGrossIncomes) +
    n(rec.otherIncomeNotIncluded) +
    n(rec.otherIncome) +
    n(rec.grossInterestReceived);
  if (salary > 0 || rec.p60DocumentId) {
    out.employed = {
      annualSalaryPaye: salary,
      p60DocumentId: rec.p60DocumentId,
    };
  }

  if (
    n(rec.allDividendIncome) > 0 ||
    n(rec.grossRentsReceived) > 0 ||
    n(rec.allIncomeBonds) > 0 ||
    rec.selfAssessmentDocumentId
  ) {
    out.selfEmployed = {
      grossSalaried: 0,
      propertyIncome: n(rec.grossRentsReceived),
      dividends: n(rec.allDividendIncome),
      otherInvestmentIncome: n(rec.allIncomeBonds),
      sa302DocumentId: rec.selfAssessmentDocumentId,
    };
  }

  if (n(rec.workingTaxCredits) > 0 || rec.benefitsEvidenceDocumentId) {
    out.benefits = {
      universalCredit: 0,
      housingBenefit: 0,
      childBenefit: 0,
      childWorkingTaxCredit: n(rec.workingTaxCredits),
      esa: 0,
      pipOrDla: 0,
      pip: 0,
      carersAllowance: 0,
      childcareSupport: 0,
      other: 0,
      otherBenefitsDocumentId: rec.benefitsEvidenceDocumentId,
    };
  }

  if (n(rec.maintenanceOrEquivalents) > 0) {
    out.divorcedSeparated = {
      maintenanceReceived: n(rec.maintenanceOrEquivalents),
      sharedCustodyNote: "",
    };
  }

  out.total = newIncomeTotal(out);
  return out;
}
