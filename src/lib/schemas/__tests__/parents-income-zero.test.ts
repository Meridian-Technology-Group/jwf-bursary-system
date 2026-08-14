import { describe, it, expect } from "vitest";
import { parentsIncomeSchema } from "@/lib/schemas/parents-income";

/**
 * The £0 prompter: when a parent's total income is £0, the applicant must
 * explicitly tick `noIncomeConfirmed` — a £0 return has to be a deliberate
 * declaration, not an accidental empty submission. A non-zero total needs no
 * such acknowledgment (it needs the legibility tick instead).
 *
 * CF-21 (A4): the genuinely-zero-income household must be able to COMPLETE the
 * section. `documentsConfirmed` used to be an unconditional
 * `refine(v => v === true)`, so a household on benefits with £0 earned income
 * was asked to confirm the legibility of documents the page never asked for —
 * and, because a failing field-level check aborts the object parse before
 * `superRefine` runs, their ticked £0 declaration was never even evaluated. The
 * requirement now lives entirely in the superRefine and is keyed on the total.
 */
describe("parentsIncomeSchema — £0 income confirmation", () => {
  const base = { documentsConfirmed: true };

  const issuePaths = (blob: unknown) => {
    const r = parentsIncomeSchema.safeParse(blob);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("blocks a £0 total that is not explicitly confirmed", () => {
    expect(issuePaths({ parent1Income: { ...base } })).toContain(
      "parent1Income.noIncomeConfirmed"
    );
  });

  it("accepts a £0 total once explicitly confirmed", () => {
    expect(
      issuePaths({ parent1Income: { ...base, noIncomeConfirmed: true } })
    ).toEqual([]);
  });

  it("does not require the confirmation when income is declared", () => {
    expect(
      issuePaths({
        parent1Income: { ...base, employed: { annualSalaryPaye: 30000 } },
      })
    ).toEqual([]);
  });

  it("requires the confirmation independently for parent 2", () => {
    expect(
      issuePaths({
        parent1Income: { ...base, employed: { annualSalaryPaye: 30000 } },
        parent2Income: { ...base },
      })
    ).toContain("parent2Income.noIncomeConfirmed");
  });
});

// ─── CF-21 · the zero-income path completes ──────────────────────────────────

/**
 * Exactly the blob the form produces for a household with no income at all: the
 * mount-time seeding effect writes every sub-block with its cells at 0, the
 * applicant leaves them alone (or types 0.00 over them) and ticks the "received
 * no income" declaration for each parent shown.
 */
function seededZeroRecord(): Record<string, unknown> {
  return {
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
    // Seeded false by the form for BOTH parents; the applicant ticks the £0 box.
    noIncomeConfirmed: false,
    documentsConfirmed: false,
  };
}

const confirmedZero = (): Record<string, unknown> => ({
  ...seededZeroRecord(),
  noIncomeConfirmed: true,
});

describe("parentsIncomeSchema — CF-21 zero-income path", () => {
  const parse = (blob: unknown) => parentsIncomeSchema.safeParse(blob);
  const issues = (blob: unknown) => {
    const r = parse(blob);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("completes for a sole parent with every cell at £0 and the £0 box ticked", () => {
    expect(issues({ parent1Income: confirmedZero() })).toEqual([]);
  });

  it("completes for BOTH parents at £0 with both £0 boxes ticked", () => {
    const r = parse({
      parent1Income: confirmedZero(),
      parent2Income: confirmedZero(),
    });
    expect(r.success).toBe(true);
  });

  it("does not demand the documents-legibility tick at £0 — for either parent", () => {
    // The £0 page renders no upload controls at all, so there is nothing to
    // confirm. Both parents leave the tick at its seeded `false`.
    expect(
      issues({ parent1Income: confirmedZero(), parent2Income: confirmedZero() })
    ).not.toContain("parent1Income.documentsConfirmed");
    expect(
      issues({ parent1Income: confirmedZero(), parent2Income: confirmedZero() })
    ).not.toContain("parent2Income.documentsConfirmed");
  });

  it("completes at £0 even when the legibility tick key is absent entirely", () => {
    const p1 = confirmedZero();
    const p2 = confirmedZero();
    delete p1.documentsConfirmed;
    delete p2.documentsConfirmed;
    expect(parse({ parent1Income: p1, parent2Income: p2 }).success).toBe(true);
  });

  it("still requires the legibility tick once ANY figure is > £0 — for either parent", () => {
    const earning = confirmedZero();
    (earning.benefits as Record<string, number>).universalCredit = 4200;

    expect(issues({ parent1Income: earning })).toContain(
      "parent1Income.documentsConfirmed"
    );
    expect(
      issues({
        parent1Income: { ...confirmedZero() },
        parent2Income: earning,
      })
    ).toContain("parent2Income.documentsConfirmed");
  });

  it("reports the legibility failure in plain English, not a raw type error", () => {
    const earning = { ...seededZeroRecord() };
    (earning.employed as Record<string, number>).annualSalaryPaye = 21000;
    delete earning.documentsConfirmed;

    expect(messagesOf({ parent1Income: earning })).toEqual([
      "You must confirm documents are current and legible",
    ]);
  });

  // ─── the hole this fix must NOT open ───────────────────────────────────────

  it("still blocks a blank/never-filled section — for either parent", () => {
    // A blank section and a deliberate £0 are only told apart by the explicit
    // declaration, so the untouched record must still fail.
    expect(issues({ parent1Income: {} })).toContain(
      "parent1Income.noIncomeConfirmed"
    );
    expect(
      issues({ parent1Income: confirmedZero(), parent2Income: {} })
    ).toContain("parent2Income.noIncomeConfirmed");
  });

  it("still blocks an all-zero section whose £0 box was left unticked", () => {
    expect(
      issues({
        parent1Income: seededZeroRecord(),
        parent2Income: seededZeroRecord(),
      })
    ).toEqual([
      "parent1Income.noIncomeConfirmed",
      "parent2Income.noIncomeConfirmed",
    ]);
  });

  it("still blocks when only ONE of the two parents confirmed their £0", () => {
    expect(
      issues({
        parent1Income: confirmedZero(),
        parent2Income: seededZeroRecord(),
      })
    ).toEqual(["parent2Income.noIncomeConfirmed"]);
  });

  it("requires the £0 declaration afresh — a stale legibility tick is not a substitute", () => {
    const zeroWithStaleTick = {
      ...seededZeroRecord(),
      documentsConfirmed: true,
    };
    expect(issues({ parent1Income: zeroWithStaleTick })).toContain(
      "parent1Income.noIncomeConfirmed"
    );
  });
});

function messagesOf(blob: unknown): string[] {
  const r = parentsIncomeSchema.safeParse(blob);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}
