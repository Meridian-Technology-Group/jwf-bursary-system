import { z } from "zod";

export const familyMemberIdentitySchema = z.object({
  id: z.string(),
  familyMemberName: z.string().min(1, "Family member name is required"),
  // CHILD = the child named on the application, GUARDIAN = the named
  // parent/guardian (the applicant). Both are auto-added, name-locked and
  // always required. OTHER = any additional dependent the applicant chooses to
  // add — those must be classified child/adult via `memberType` (Q1).
  role: z.enum(["CHILD", "GUARDIAN", "OTHER"]).default("OTHER"),
  // Only meaningful for OTHER rows; required for them via the refinement below.
  memberType: z.enum(["CHILD", "ADULT"]).optional(),
  isBritishCitizen: z.boolean(),
  ukPassportDocumentId: z.string().optional(),
  passportDocumentId: z.string().optional(),
  ilrDocumentId: z.string().optional(),
});

export const familyIdSchema = z
  .object({
    familyMembers: z
      .array(familyMemberIdentitySchema)
      .min(1, "At least one family member must be added"),
  })
  .superRefine((data, ctx) => {
    data.familyMembers.forEach((m, i) => {
      if (m.role === "OTHER" && !m.memberType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please indicate whether this is a child or an adult",
          path: ["familyMembers", i, "memberType"],
        });
      }
    });
  });

export type FamilyIdFormValues = z.infer<typeof familyIdSchema>;
