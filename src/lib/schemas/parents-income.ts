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
    // Explicit acknowledgment required only when the total income is £0 — the
    // form surfaces a confirmation tick so a £0 return is a deliberate
    // declaration, not an accidental empty submission.
    noIncomeConfirmed: z.boolean().optional(),
    documentsConfirmed: z.boolean().refine((v) => v === true, {
      message: "You must confirm documents are current and legible",
    }),
  })
  .superRefine((data, ctx) => {
    if (
      newIncomeTotal(data as Parameters<typeof newIncomeTotal>[0]) === 0 &&
      data.noIncomeConfirmed !== true
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please confirm this parent/guardian received no income or benefit support during the tax year.",
        path: ["noIncomeConfirmed"],
      });
    }
  });

export const parentsIncomeSchema = z.object({
  parent1Income: parentIncomeRecordSchema,
  parent2Income: parentIncomeRecordSchema.optional(),
});

export type ParentsIncomeFormValues = z.infer<typeof parentsIncomeSchema>;
