import { z } from "zod";

export const familyMemberIdentitySchema = z
  .object({
    id: z.string(),
    familyMemberName: z.string().min(1, "Family member name is required"),
    isBritishCitizen: z.boolean(),
    ukPassportDocumentId: z.string().optional(),
    passportDocumentId: z.string().optional(),
    ilrDocumentId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isBritishCitizen && !data.ukPassportDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload a UK passport",
        path: ["ukPassportDocumentId"],
      });
    }
    if (!data.isBritishCitizen && !data.passportDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload a passport",
        path: ["passportDocumentId"],
      });
    }
    if (!data.isBritishCitizen && !data.ilrDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload evidence of Indefinite Leave to Remain",
        path: ["ilrDocumentId"],
      });
    }
  });

export const familyIdSchema = z.object({
  familyMembers: z
    .array(familyMemberIdentitySchema)
    .min(1, "At least one family member must be added"),
});

export type FamilyIdFormValues = z.infer<typeof familyIdSchema>;
