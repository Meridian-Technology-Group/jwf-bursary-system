import { z } from "zod";

export const familyMemberIdentitySchema = z.object({
  id: z.string(),
  familyMemberName: z.string().min(1, "Family member name is required"),
  isBritishCitizen: z.boolean(),
  ukPassportDocumentId: z.string().optional(),
  passportDocumentId: z.string().optional(),
  ilrDocumentId: z.string().optional(),
});

export const familyIdSchema = z.object({
  familyMembers: z
    .array(familyMemberIdentitySchema)
    .min(1, "At least one family member must be added"),
});

export type FamilyIdFormValues = z.infer<typeof familyIdSchema>;
