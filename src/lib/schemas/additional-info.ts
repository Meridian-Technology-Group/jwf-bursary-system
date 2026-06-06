import { z } from "zod";

const circumstanceItemSchema = z.object({
  applies: z.boolean().default(false),
  documentId: z.string().optional(),
});

export const additionalInfoSchema = z.object({
  divorced: circumstanceItemSchema,
  separated: circumstanceItemSchema,
  sickUnableToWork: circumstanceItemSchema,
  rent: circumstanceItemSchema,
  madeRedundant: circumstanceItemSchema,
  receivingBenefits: circumstanceItemSchema,
  // Workbook §7: a mandatory free-text field — at least one character to
  // proceed. (Enter "N/A" or "None" if there is nothing further to add.)
  additionalNarrative: z
    .string()
    .trim()
    .min(1, "Please provide any additional information (enter N/A if none).")
    .max(3000, "Additional narrative must be under 3,000 characters"),
  additionalDocumentIds: z.array(z.string()).default([]),
});

export type AdditionalInfoFormValues = z.infer<typeof additionalInfoSchema>;
