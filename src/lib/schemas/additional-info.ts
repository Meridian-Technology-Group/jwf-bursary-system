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
  additionalNarrative: z
    .string()
    .max(3000, "Additional narrative must be under 3,000 characters")
    .optional(),
  additionalDocumentIds: z.array(z.string()).default([]),
});

export type AdditionalInfoFormValues = z.infer<typeof additionalInfoSchema>;
