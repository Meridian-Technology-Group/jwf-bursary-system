import { z } from "zod";

const currencyField = z.coerce
  .number({ error: "Please enter a number (use 0 if not applicable)" })
  .nonnegative("Enter 0 if not applicable")
  .default(0);

export const parentIncomeRecordSchema = z.object({
  salaryWagesPension: currencyField,
  supplementsAndBonus: currencyField,
  otherBenefitsAndCommissions: currencyField,
  amountFromPartner: currencyField,
  workingTaxCredits: currencyField,
  grossInterestReceived: currencyField,
  allDividendIncome: currencyField,
  grossRentsReceived: currencyField,
  allIncomeBonds: currencyField,
  otherGrossIncomes: currencyField,
  maintenanceOrEquivalents: currencyField,
  bursariesOrSponsorships: currencyField,
  otherIncomeNotIncluded: currencyField,
  otherIncome: currencyField,
  hasCapitalRepayments: z.boolean().default(false),
  capitalRepaymentsDocumentId: z.string().optional(),
  p60DocumentId: z.string().optional(),
  selfAssessmentDocumentId: z.string().optional(),
  benefitsEvidenceDocumentId: z.string().optional(),
  documentsConfirmed: z.boolean().refine((v) => v === true, {
    message: "You must confirm documents are current and legible",
  }),
});

export const parentsIncomeSchema = z.object({
  parent1Income: parentIncomeRecordSchema,
  parent2Income: parentIncomeRecordSchema.optional(),
});

export type ParentsIncomeFormValues = z.infer<typeof parentsIncomeSchema>;
