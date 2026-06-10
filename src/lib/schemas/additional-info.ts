import { z } from "zod";

/**
 * Additional Information — a free-form section where the applicant can add any
 * contextual comments and attach supporting documents not covered elsewhere.
 * Both the narrative and the uploads are OPTIONAL.
 */
export const additionalInfoSchema = z.object({
  additionalNarrative: z
    .string()
    .trim()
    .max(3000, "Additional information must be under 3,000 characters")
    .optional(),
  additionalDocumentIds: z.array(z.string()).default([]),
});

export type AdditionalInfoFormValues = z.infer<typeof additionalInfoSchema>;
