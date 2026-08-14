/**
 * Behaviour-preservation tests for the section rule set.
 *
 * These assert that the declarative rules reproduce the legacy
 * `SECTION_EVALUATORS` gap output exactly (same gap ids, same conditions), so
 * the engine swap is provably non-regressive for the sidebar tri-state and the
 * submit gate.
 */
import { describe, it, expect } from "vitest";
import { evaluateRules } from "@/lib/portal/document-rules";
import { SECTION_RULES } from "@/lib/portal/section-rules";

const empty = new Set<string>();

function gapIds(sectionType: Parameters<typeof evaluateRules>[0], blob: unknown, slots = empty) {
  const rules = SECTION_RULES[sectionType] ?? [];
  return evaluateRules(sectionType, rules, blob as Record<string, unknown> | null, slots)
    .map((g) => g.id)
    .sort();
}

describe("CHILD_DETAILS", () => {
  it("requires birth certificate once saved", () => {
    expect(gapIds("CHILD_DETAILS", {})).toEqual(["CHILD_DETAILS:BIRTH_CERTIFICATE"]);
    expect(gapIds("CHILD_DETAILS", { birthCertificateDocumentId: "x" })).toEqual([]);
    expect(gapIds("CHILD_DETAILS", {}, new Set(["BIRTH_CERTIFICATE"]))).toEqual([]);
  });
  it("no gaps when unsaved (null)", () => {
    expect(gapIds("CHILD_DETAILS", null)).toEqual([]);
  });
});

describe("PARENT_DETAILS", () => {
  it("P45 required when they left employment in the last 12 months", () => {
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: { leftEmployment: true },
      })
    ).toEqual(["PARENT_DETAILS:EMPLOYMENT_P45_PARENT_1"]);
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: { leftEmployment: true, p45DocumentId: "x" },
      })
    ).toEqual([]);
  });
  it("redundancy evidence required when a redundancy package was received", () => {
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: { receivedRedundancy: true },
      })
    ).toEqual(["PARENT_DETAILS:EMPLOYMENT_REDUNDANCY_PARENT_1"]);
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: { receivedRedundancy: true, redundancyDocumentId: "x" },
      })
    ).toEqual([]);
  });
  it("parent 2 rules only fire when the parent2Employment block exists", () => {
    // No parent2Employment key — no P2 gaps even if flags would have fired.
    expect(
      gapIds("PARENT_DETAILS", { parent1Employment: { leftEmployment: false } })
    ).toEqual([]);
    // parent2Employment present with a flag → P2 gap.
    expect(
      gapIds("PARENT_DETAILS", {
        parent1Employment: {},
        parent2Employment: { leftEmployment: true },
      })
    ).toEqual(["PARENT_DETAILS:EMPLOYMENT_P45_PARENT_2"]);
  });

  // ── Epic 09 household evidence ──────────────────────────────────────────────
  it("widowed → death certificate required until uploaded", () => {
    expect(
      gapIds("PARENT_DETAILS", { relationshipStatus: "WIDOWED" })
    ).toEqual(["PARENT_DETAILS:DEATH_CERTIFICATE"]);
    expect(
      gapIds("PARENT_DETAILS", {
        relationshipStatus: "WIDOWED",
        deathCertificateDocumentId: "doc-1",
      })
    ).toEqual([]);
    expect(
      gapIds(
        "PARENT_DETAILS",
        { relationshipStatus: "WIDOWED" },
        new Set(["DEATH_CERTIFICATE"])
      )
    ).toEqual([]);
  });

  it("death certificate NOT required for a non-widowed parent", () => {
    expect(gapIds("PARENT_DETAILS", { relationshipStatus: "SINGLE" })).toEqual([]);
    expect(gapIds("PARENT_DETAILS", { relationshipStatus: "DIVORCED" })).toEqual([]);
  });

  it("guardian facet no longer produces a guardianship-evidence gap", () => {
    // The foster carer / legal guardian question and its evidence upload were
    // removed from the Parent/Guardian Details page; no gap should fire even if
    // a legacy blob still carries the facet.
    expect(gapIds("PARENT_DETAILS", { isGuardian: true })).toEqual([]);
    expect(gapIds("PARENT_DETAILS", { isGuardian: false })).toEqual([]);
  });
});

describe("PARENTS_INCOME (status-driven sub-tables — D3)", () => {
  it("no income rules fire when no sub-block is declared", () => {
    expect(gapIds("PARENTS_INCOME", { parent1Income: {} })).toEqual([]);
  });

  // CF-21 (A4). The zero-income household's block was diagnosed as a VALIDATION
  // failure, not a phantom document gap. This pins the other half of that
  // diagnosis: with every sub-block present for BOTH parents and every figure at
  // £0 — the exact blob the form's mount-time seeding produces — the document
  // rules emit nothing, because every PARENTS_INCOME rule is `requiredIfValueGt0`
  // and no upload control is even rendered at £0. If a future rule is added here
  // that fires at zero, this test fails and the zero path is blocked again.
  it("no document rules fire for an all-zero blob — both parents (CF-21)", () => {
    const zeroSubBlocks = {
      employed: { annualSalaryPaye: 0 },
      selfEmployed: {
        grossSalaried: 0,
        propertyIncome: 0,
        dividends: 0,
        otherInvestmentIncome: 0,
      },
      benefits: {
        universalCredit: 0,
        housingBenefit: 0,
        childBenefit: 0,
        childWorkingTaxCredit: 0,
        esa: 0,
        pipOrDla: 0,
        carersAllowance: 0,
        childcareSupport: 0,
        other: 0,
      },
      unemployed: {
        finalGrossPay: 0,
        redundancy: 0,
        jsa: 0,
        grantSupport: 0,
        leavePay: 0,
      },
      retired: { statePension: 0, privatePension: 0 },
      divorcedSeparated: { maintenanceReceived: 0, sharedCustodyNote: "" },
      thirdParty: { incomeSupportReceived: 0, supportNote: "" },
      total: 0,
      noIncomeConfirmed: true,
      documentsConfirmed: false,
    };
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: zeroSubBlocks,
        parent2Income: zeroSubBlocks,
      })
    ).toEqual([]);
  });

  it("employed: BOTH P60 and March payslip required when salary > 0, not when 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { employed: { annualSalaryPaye: 0 } },
      })
    ).toEqual([]);
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { employed: { annualSalaryPaye: 30000 } },
      })
    ).toEqual([
      "PARENTS_INCOME:EMPLOYED_MARCH_PAYSLIP_PARENT_1",
      "PARENTS_INCOME:EMPLOYED_P60_PARENT_1",
    ]);
  });

  it("employed: only satisfied when BOTH P60 and March payslip present", () => {
    // P60 alone → payslip still outstanding.
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { employed: { annualSalaryPaye: 30000, p60DocumentId: "x" } },
      })
    ).toEqual(["PARENTS_INCOME:EMPLOYED_MARCH_PAYSLIP_PARENT_1"]);
    // Payslip alone → P60 still outstanding.
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          employed: { annualSalaryPaye: 30000, marchPayslipDocumentId: "y" },
        },
      })
    ).toEqual(["PARENTS_INCOME:EMPLOYED_P60_PARENT_1"]);
    // Both present → no gap.
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          employed: {
            annualSalaryPaye: 30000,
            p60DocumentId: "x",
            marchPayslipDocumentId: "y",
          },
        },
      })
    ).toEqual([]);
  });

  it("self-employed: SA302 required when any SE cell > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          selfEmployed: {
            grossSalaried: 0, propertyIncome: 5000, dividends: 0, otherInvestmentIncome: 0,
          },
        },
      })
    ).toEqual(["PARENTS_INCOME:SA302_PARENT_1"]);
  });

  it("benefits: UC statement + monthly required when UC > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { benefits: { universalCredit: 1200 } },
      })
    ).toEqual([
      "PARENTS_INCOME:UC_MONTHLY_PARENT_1",
      "PARENTS_INCOME:UC_STATEMENT_PARENT_1",
    ]);
  });

  // ── CF-28 — the UC monthly rule means "3", not "at least one" ────────────
  //
  // The label always promised 3 monthly documents; before D2 a single upload
  // satisfied it, so applications arrived carrying one month's evidence. The
  // statement is a separate rule, so Universal Credit needs 4 documents total.
  it("benefits: two monthly UC documents are NOT enough", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          benefits: {
            universalCredit: 1200,
            ucStatementDocumentId: "stmt",
            ucMonthlyDocumentIds: ["m1", "m2"],
          },
        },
      })
    ).toEqual(["PARENTS_INCOME:UC_MONTHLY_PARENT_1"]);
  });

  it("benefits: three monthly UC documents + the statement clear the section", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          benefits: {
            universalCredit: 1200,
            ucStatementDocumentId: "stmt",
            ucMonthlyDocumentIds: ["m1", "m2", "m3"],
          },
        },
      })
    ).toEqual([]);
  });

  it("benefits: three monthly UC documents do NOT stand in for the statement", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          benefits: {
            universalCredit: 1200,
            ucMonthlyDocumentIds: ["m1", "m2", "m3"],
          },
        },
      })
    ).toEqual(["PARENTS_INCOME:UC_STATEMENT_PARENT_1"]);
  });

  it("benefits: the same document id in all three UC monthly entries counts once", () => {
    // "Could the form detect whether one same document is uploaded three
    // times?" — at the id level, yes. (Byte-identical *re-uploads* are caught
    // separately, by the digest check in the confirm route.)
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          benefits: {
            universalCredit: 1200,
            ucStatementDocumentId: "stmt",
            ucMonthlyDocumentIds: ["same", "same", "same"],
          },
        },
      })
    ).toEqual(["PARENTS_INCOME:UC_MONTHLY_PARENT_1"]);
  });

  it("benefits: positional gaps (null entries) never count as documents", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: {
          benefits: {
            universalCredit: 1200,
            ucStatementDocumentId: "stmt",
            ucMonthlyDocumentIds: [null, "m2", null],
          },
        },
      })
    ).toEqual(["PARENTS_INCOME:UC_MONTHLY_PARENT_1"]);
  });

  it("benefits: the three UC monthly upload slots satisfy the rule on their own", () => {
    const blob = {
      parent1Income: {
        benefits: { universalCredit: 1200, ucStatementDocumentId: "stmt" },
      },
    };
    // Two of the three repeat slots — still short.
    expect(
      gapIds(
        "PARENTS_INCOME",
        blob,
        new Set(["UC_MONTHLY_1_PARENT_1", "UC_MONTHLY_2_PARENT_1"])
      )
    ).toEqual(["PARENTS_INCOME:UC_MONTHLY_PARENT_1"]);
    // All three.
    expect(
      gapIds(
        "PARENTS_INCOME",
        blob,
        new Set([
          "UC_MONTHLY_1_PARENT_1",
          "UC_MONTHLY_2_PARENT_1",
          "UC_MONTHLY_3_PARENT_1",
        ])
      )
    ).toEqual([]);
    // The legacy single slot still counts as one of the three, so a document
    // uploaded before D2 is not thrown away.
    expect(
      gapIds(
        "PARENTS_INCOME",
        blob,
        new Set([
          "UC_MONTHLY_PARENT_1",
          "UC_MONTHLY_2_PARENT_1",
          "UC_MONTHLY_3_PARENT_1",
        ])
      )
    ).toEqual([]);
  });

  it("benefits: ids and slots are the same uploads, so they do not add up", () => {
    // 2 saved ids + the same 2 uploads seen as slots must not reach 3.
    expect(
      gapIds(
        "PARENTS_INCOME",
        {
          parent1Income: {
            benefits: {
              universalCredit: 1200,
              ucStatementDocumentId: "stmt",
              ucMonthlyDocumentIds: ["m1", "m2"],
            },
          },
        },
        new Set(["UC_MONTHLY_1_PARENT_1", "UC_MONTHLY_2_PARENT_1"])
      )
    ).toEqual(["PARENTS_INCOME:UC_MONTHLY_PARENT_1"]);
  });

  it("benefits: Child Benefit value alone requires NO upload (workbook exception)", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { benefits: { childBenefit: 2000 } },
      })
    ).toEqual([]);
  });

  it("benefits: other-benefits evidence required for non-CB benefit > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { benefits: { esa: 500 } },
      })
    ).toEqual(["PARENTS_INCOME:OTHER_BENEFITS_PARENT_1"]);
  });

  it("unemployed: P45 required when final gross pay > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { unemployed: { finalGrossPay: 8000 } },
      })
    ).toEqual(["PARENTS_INCOME:P45_PARENT_1"]);
  });

  it("retired: pension docs required when a pension > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { retired: { statePension: 9000 } },
      })
    ).toEqual(["PARENTS_INCOME:PENSION_PARENT_1"]);
  });

  it("divorced/separated: maintenance letter required when received > 0", () => {
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: { divorcedSeparated: { maintenanceReceived: 3000 } },
      })
    ).toEqual(["PARENTS_INCOME:MAINTENANCE_PARENT_1"]);
  });

  it("parent 2 rules only fire when the parent2Income block exists", () => {
    const parent1Complete = {
      employed: {
        annualSalaryPaye: 30000,
        p60DocumentId: "x",
        marchPayslipDocumentId: "y",
      },
    };
    expect(
      gapIds("PARENTS_INCOME", { parent1Income: parent1Complete })
    ).toEqual([]);
    expect(
      gapIds("PARENTS_INCOME", {
        parent1Income: parent1Complete,
        parent2Income: { employed: { annualSalaryPaye: 25000 } },
      })
    ).toEqual([
      "PARENTS_INCOME:EMPLOYED_MARCH_PAYSLIP_PARENT_2",
      "PARENTS_INCOME:EMPLOYED_P60_PARENT_2",
    ]);
  });
});

describe("DEPENDENT_CHILDREN structural rules", () => {
  it("requires at least one child", () => {
    expect(gapIds("DEPENDENT_CHILDREN", { children: [] })).toEqual([
      "DEPENDENT_CHILDREN:at_least_one",
    ]);
  });
  it("requires exactly one named child", () => {
    expect(
      gapIds("DEPENDENT_CHILDREN", { children: [{ isNamedChild: false }] })
    ).toEqual(["DEPENDENT_CHILDREN:named_child"]);
    expect(
      gapIds("DEPENDENT_CHILDREN", {
        children: [{ isNamedChild: true }, { isNamedChild: true }],
      })
    ).toEqual(["DEPENDENT_CHILDREN:named_child"]);
    expect(
      gapIds("DEPENDENT_CHILDREN", { children: [{ isNamedChild: true }] })
    ).toEqual([]);
  });
});

describe("ASSETS_LIABILITIES", () => {
  // Council tax + the Parent 1 current-account statement are the always-on gates.
  const base = { councilTaxDocumentId: "x", parent1CurrentAccountDocumentIds: ["a"] };

  it("council tax + current-account statement (P1) always required", () => {
    expect(gapIds("ASSETS_LIABILITIES", {})).toEqual([
      "ASSETS_LIABILITIES:BANK_STATEMENT_CURRENT_PARENT_1",
      "ASSETS_LIABILITIES:COUNCIL_TAX",
    ]);
  });
  it("satisfied by docs / slots", () => {
    expect(gapIds("ASSETS_LIABILITIES", base)).toEqual([]);
  });
  it("current-account statement P2 only enforced when the P2 block was shown", () => {
    // P2 array key absent → not enforced.
    expect(gapIds("ASSETS_LIABILITIES", base)).toEqual([]);
    // P2 array present but empty → enforced.
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, parent2CurrentAccountDocumentIds: [] })
    ).toEqual(["ASSETS_LIABILITIES:BANK_STATEMENT_CURRENT_PARENT_2"]);
  });
  it("mortgage statement required when hasMortgage, satisfied by the doc", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, propertyOwnership: "OWN", hasMortgage: true })
    ).toEqual(["ASSETS_LIABILITIES:MAIN_MORTGAGE_STATEMENT"]);
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        propertyOwnership: "OWN",
        hasMortgage: true,
        mortgageStatementDocumentId: "m",
      })
    ).toEqual([]);
  });
  it("rent-arrangement uploads gate by type", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        propertyOwnership: "RENT",
        rentAgreementType: "PRIVATE",
      })
    ).toEqual(["ASSETS_LIABILITIES:TENANCY_AGREEMENT"]);
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        propertyOwnership: "RENT",
        rentAgreementType: "COUNCIL_NO_RENT",
      })
    ).toEqual(["ASSETS_LIABILITIES:HOUSING_BENEFIT_LETTER"]);
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        propertyOwnership: "RENT",
        rentAgreementType: "RELATIVES",
      })
    ).toEqual(["ASSETS_LIABILITIES:RELATIVE_LETTER"]);
  });
  it("investment docs required per parent when stocks/bonds declared", () => {
    expect(gapIds("ASSETS_LIABILITIES", { ...base, parent1OwnsInvestments: true })).toEqual([
      "ASSETS_LIABILITIES:INVESTMENT_PARENT_1",
    ]);
  });
  it("credit-card statement required only when a debt balance is declared", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, hasPersonalDebt: true, creditCardBalance: 500 })
    ).toEqual(["ASSETS_LIABILITIES:CREDIT_CARD_STATEMENT"]);
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, hasPersonalDebt: true, creditCardBalance: 0 })
    ).toEqual([]);
  });

  // CF-30. A declared credit-agency loan makes BOTH the statement (previously
  // labelled optional) and the new agreement compulsory.
  it("loan statement AND agreement required when a loan balance is declared", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, hasPersonalDebt: true, loansToAgencies: 4000 })
    ).toEqual([
      "ASSETS_LIABILITIES:LOAN_AGREEMENT",
      "ASSETS_LIABILITIES:LOAN_STATEMENT",
    ]);
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        hasPersonalDebt: true,
        loansToAgencies: 4000,
        loanStatementDocumentIds: ["s"],
      })
    ).toEqual(["ASSETS_LIABILITIES:LOAN_AGREEMENT"]);
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        hasPersonalDebt: true,
        loansToAgencies: 4000,
        loanStatementDocumentIds: ["s"],
        loanAgreementDocumentIds: ["a"],
      })
    ).toEqual([]);
  });

  it("no loan documents required when no loan balance is declared", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, hasPersonalDebt: true, loansToAgencies: 0 })
    ).toEqual([]);
    expect(
      gapIds("ASSETS_LIABILITIES", { ...base, hasPersonalDebt: false })
    ).toEqual([]);
  });

  // ── Invisible-requirement guard ────────────────────────────────────────────
  // `ConditionalField` hides its children with CSS only — it never unmounts
  // them — so a value entered in a branch SURVIVES in the saved blob after the
  // branch is switched off. Every rule whose upload lives inside a branch must
  // therefore re-check that branch, or it raises a gap pointing at a control
  // the applicant cannot see, and the section can never be completed (the CF-17
  // / CF-21 failure mode). These pin the guards.
  it("stale loan balance raises nothing once personal debt is switched back to no", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        hasPersonalDebt: false,
        loansToAgencies: 4000,
        creditCardBalance: 500,
      })
    ).toEqual([]);
  });

  it("stale hasMortgage raises nothing once the household switches OWN → RENT", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        propertyOwnership: "RENT",
        rentAgreementType: "PRIVATE",
        tenancyAgreementDocumentId: "t",
        hasMortgage: true,
      })
    ).toEqual([]);
  });

  it("stale rentAgreementType raises nothing once the household switches RENT → OWN", () => {
    for (const type of ["PRIVATE", "COUNCIL", "COUNCIL_NO_RENT", "RELATIVES"]) {
      expect(
        gapIds("ASSETS_LIABILITIES", {
          ...base,
          propertyOwnership: "OWN",
          hasMortgage: false,
          rentAgreementType: type,
        })
      ).toEqual([]);
    }
  });
});

describe("no-op when nothing declared", () => {
  it.each(["FAMILY_ID", "DEPENDENT_ELDERLY", "OTHER_INFO", "ADDITIONAL_INFO", "DECLARATION"] as const)(
    "%s has no gaps for an empty/default blob",
    (s) => {
      expect(gapIds(s, {})).toEqual([]);
    }
  );
});

describe("DEPENDENT_ELDERLY — per in-care elder invoice (PR-3)", () => {
  it("requires an invoice for each in-care elder", () => {
    expect(
      gapIds("DEPENDENT_ELDERLY", {
        elderlyInCare: [{ firstName: "Ada" }, { firstName: "Bob" }],
      })
    ).toEqual([
      "DEPENDENT_ELDERLY:CARE_HOME_INVOICE_0",
      "DEPENDENT_ELDERLY:CARE_HOME_INVOICE_1",
    ]);
  });
  it("satisfied per elder by a doc id or slot", () => {
    expect(
      gapIds(
        "DEPENDENT_ELDERLY",
        { elderlyInCare: [{ firstName: "Ada", careHomeInvoiceDocumentId: "x" }, { firstName: "Bob" }] },
        new Set(["CARE_HOME_INVOICE_1"])
      )
    ).toEqual([]);
  });
});

describe("OTHER_INFO — court / insurance / maintenance uploads (PR-3)", () => {
  it("court-order evidence required when hasCOurtOrder", () => {
    expect(gapIds("OTHER_INFO", { hasCOurtOrder: true })).toEqual([
      "OTHER_INFO:COURT_ORDER_EVIDENCE",
    ]);
  });
  it("insurance evidence required when hasInsurancePolicy", () => {
    expect(gapIds("OTHER_INFO", { hasInsurancePolicy: true })).toEqual([
      "OTHER_INFO:INSURANCE_POLICY_EVIDENCE",
    ]);
  });
  it("decree absolute required when divorced maintenance payer", () => {
    expect(
      gapIds("OTHER_INFO", { hasChildMaintenance: true, maintenancePayer: "YOU", maintenanceIsDivorced: true })
    ).toEqual(["OTHER_INFO:MAINTENANCE_DECREE_ABSOLUTE"]);
  });
  it("no maintenance doc when separated (agreement note path)", () => {
    expect(
      gapIds("OTHER_INFO", { hasChildMaintenance: true, maintenancePayer: "YOU", maintenanceIsDivorced: false })
    ).toEqual([]);
  });
});

describe("ASSETS_LIABILITIES — per other-property mortgage statement (PR-3)", () => {
  const base = { councilTaxDocumentId: "x", parent1CurrentAccountDocumentIds: ["a"] };
  it("requires a mortgage statement only for properties with a balance > 0", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        otherProperties: [{ mortgageBalance: 100000 }, { mortgageBalance: 0 }],
      })
    ).toEqual(["ASSETS_LIABILITIES:OTHER_PROPERTY_MORTGAGE_STATEMENT_0"]);
  });
  it("satisfied by the per-property statement doc", () => {
    expect(
      gapIds("ASSETS_LIABILITIES", {
        ...base,
        otherProperties: [{ mortgageBalance: 100000, mortgageStatementDocumentId: "m" }],
      })
    ).toEqual([]);
  });
});

describe("FAMILY_ID — per-member identity documents (PR-4)", () => {
  it("no gaps when the section is unstarted (no members array)", () => {
    expect(gapIds("FAMILY_ID", {})).toEqual([]);
  });
  // A fully-documented guardian, so the child-and-guardian rule (Q1) is
  // satisfied and these tests isolate the per-member MEMBER_IDENTITY behaviour.
  const documentedGuardian = {
    role: "GUARDIAN",
    isBritishCitizen: true,
    ukPassportDocumentId: "a",
  };
  it("British citizen requires a UK passport", () => {
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [documentedGuardian, { role: "CHILD", isBritishCitizen: true }],
      })
    ).toEqual([
      "FAMILY_ID:CHILD_AND_GUARDIAN_DOCUMENTED",
      "FAMILY_ID:MEMBER_IDENTITY",
    ]);
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          documentedGuardian,
          { role: "CHILD", isBritishCitizen: true, ukPassportDocumentId: "x" },
        ],
      })
    ).toEqual([]);
  });
  it("non-British requires passport AND ILR", () => {
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          documentedGuardian,
          { role: "CHILD", isBritishCitizen: false, passportDocumentId: "p" },
        ],
      })
    ).toEqual([
      // Child has a passport (counts as documented), just missing ILR → only
      // the per-member identity gap fires.
      "FAMILY_ID:MEMBER_IDENTITY",
    ]);
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          documentedGuardian,
          {
            role: "CHILD",
            isBritishCitizen: false,
            passportDocumentId: "p",
            ilrDocumentId: "i",
          },
        ],
      })
    ).toEqual([]);
  });
  it("is satisfied via indexed upload slots", () => {
    expect(
      gapIds(
        "FAMILY_ID",
        {
          familyMembers: [documentedGuardian, { role: "CHILD", isBritishCitizen: true }],
        },
        new Set(["FAMILY_ID_PASSPORT_1"])
      )
    ).toEqual([]);
  });
  it("does not fire the per-member identity gap before citizenship is answered", () => {
    expect(gapIds("FAMILY_ID", { familyMembers: [{}] })).not.toContain(
      "FAMILY_ID:MEMBER_IDENTITY"
    );
  });
});

describe("FAMILY_ID — requires a documented child AND guardian (Q1)", () => {
  const withDoc = { isBritishCitizen: true, ukPassportDocumentId: "x" };
  it("a documented child alone does not complete the section", () => {
    expect(
      gapIds("FAMILY_ID", { familyMembers: [{ role: "CHILD", ...withDoc }] })
    ).toEqual(["FAMILY_ID:CHILD_AND_GUARDIAN_DOCUMENTED"]);
  });
  it("a documented child AND guardian completes it", () => {
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          { role: "CHILD", ...withDoc },
          { role: "GUARDIAN", ...withDoc },
        ],
      })
    ).toEqual([]);
  });
  it("a documented guardian but undocumented child still blocks", () => {
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          { role: "CHILD", isBritishCitizen: true },
          { role: "GUARDIAN", ...withDoc },
        ],
      })
    ).toEqual([
      "FAMILY_ID:CHILD_AND_GUARDIAN_DOCUMENTED",
      "FAMILY_ID:MEMBER_IDENTITY",
    ]);
  });
  it("extra (OTHER) members do not satisfy the child+guardian requirement", () => {
    expect(
      gapIds("FAMILY_ID", {
        familyMembers: [
          { role: "OTHER", memberType: "CHILD", ...withDoc },
          { role: "OTHER", memberType: "ADULT", ...withDoc },
        ],
      })
    ).toEqual(["FAMILY_ID:CHILD_AND_GUARDIAN_DOCUMENTED"]);
  });
});
