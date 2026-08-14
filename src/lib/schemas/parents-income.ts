import { z } from "zod";
import { newIncomeTotal } from "@/lib/portal/income-model";

/**
 * Parents' Income — status-driven sub-tables (Epic 02, decision D3).
 *
 * Each sub-block is optional and only present for the employment statuses a
 * parent declared. Numeric cells coerce to a non-negative number (the workbook's
 * "enter 0 where not applicable"). Required-document rules (P60-or-payslip,
 * SA302/P45/benefits if value > 0, Child Benefit non-mandatory) are enforced by
 * the rule engine (lib/portal/section-rules.ts) — not duplicated here — so the
 * schema stays a pure shape/type gate and the doc rules stay in one place.
 */

const currencyField = z.coerce
  .number({ error: "Please enter a number (use 0 if not applicable)" })
  .nonnegative("Enter 0 if not applicable")
  .default(0);

const docId = z.string().optional();

export const employedIncomeSchema = z.object({
  annualSalaryPaye: currencyField,
  p60DocumentId: docId,
  marchPayslipDocumentId: docId,
});

export const selfEmployedIncomeSchema = z.object({
  grossSalaried: currencyField,
  propertyIncome: currencyField,
  dividends: currencyField,
  otherInvestmentIncome: currencyField,
  sa302DocumentId: docId,
});

export const benefitsIncomeSchema = z.object({
  universalCredit: currencyField,
  housingBenefit: currencyField,
  childBenefit: currencyField,
  childWorkingTaxCredit: currencyField,
  esa: currencyField,
  pipOrDla: currencyField,
  carersAllowance: currencyField,
  childcareSupport: currencyField,
  other: currencyField,
  ucStatementDocumentId: docId,
  ucMonthlyDocumentIds: z.array(z.string()).optional(),
  housingBenefitDocumentId: docId,
  otherBenefitsDocumentId: docId,
});

export const unemployedIncomeSchema = z.object({
  finalGrossPay: currencyField,
  redundancy: currencyField,
  jsa: currencyField,
  grantSupport: currencyField,
  leavePay: currencyField,
  p45DocumentId: docId,
  redundancyDocumentId: docId,
  jsaDocumentId: docId,
  grantSupportDocumentId: docId,
  leavePayDocumentId: docId,
});

export const retiredIncomeSchema = z.object({
  statePension: currencyField,
  privatePension: currencyField,
  pensionDocumentId: docId,
});

export const divorcedSeparatedIncomeSchema = z.object({
  maintenanceReceived: currencyField,
  sharedCustodyNote: z.string().default(""),
  maintenanceDocumentId: docId,
});

export const thirdPartyIncomeSchema = z.object({
  incomeSupportReceived: currencyField,
  supportNote: z.string().default(""),
});

export const parentIncomeRecordSchema = z
  .object({
    employed: employedIncomeSchema.optional(),
    selfEmployed: selfEmployedIncomeSchema.optional(),
    benefits: benefitsIncomeSchema.optional(),
    unemployed: unemployedIncomeSchema.optional(),
    retired: retiredIncomeSchema.optional(),
    divorcedSeparated: divorcedSeparatedIncomeSchema.optional(),
    thirdParty: thirdPartyIncomeSchema.optional(),
    total: z.coerce.number().nonnegative().default(0),
    // Exactly ONE acknowledgment is required per parent, and which one depends on
    // the declared total (see the superRefine below):
    //
    //   total  = £0 → `noIncomeConfirmed` — an explicit "no income at all"
    //                 declaration, so a £0 return is deliberate rather than an
    //                 accidental empty submission.
    //   total  > £0 → `documentsConfirmed` — the legibility tick covering the
    //                 uploads this page asked for.
    //
    // CF-21: `documentsConfirmed` used to be an UNCONDITIONAL `refine(v => v === true)`.
    // That blocked the genuinely-zero-income household: at £0 the form renders no
    // upload controls at all (every income document rule is `requiredIfValueGt0`),
    // so the applicant was asked to confirm the legibility of documents that do
    // not exist — and, because a failing field-level check aborts the object parse
    // before `superRefine` runs, the £0 declaration they HAD ticked was never even
    // evaluated. Both ticks are plain booleans here; the requirement is expressed
    // once, in the superRefine, so the two can never disagree and neither can
    // short-circuit the other.
    noIncomeConfirmed: z.boolean().optional(),
    documentsConfirmed: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const total = newIncomeTotal(data as Parameters<typeof newIncomeTotal>[0]);

    // £0 declared: the no-income tick is the deliberate declaration, and it is
    // what keeps a blank section distinguishable from an intentional £0 one.
    // Nothing on the page needed a document, so the legibility tick is not asked
    // for (the form hides it at £0 to match).
    if (total === 0) {
      if (data.noIncomeConfirmed !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Please confirm this parent/guardian received no income or benefit support during the tax year.",
          path: ["noIncomeConfirmed"],
        });
      }
      return;
    }

    // Income declared: at least one figure is > £0, so this page did ask for
    // supporting documents — the legibility tick is mandatory, exactly as before.
    if (data.documentsConfirmed !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You must confirm documents are current and legible",
        path: ["documentsConfirmed"],
      });
    }
  });

export const parentsIncomeSchema = z.object({
  parent1Income: parentIncomeRecordSchema,
  parent2Income: parentIncomeRecordSchema.optional(),
});

export type ParentsIncomeFormValues = z.infer<typeof parentsIncomeSchema>;
