import { z } from "zod";

export const elderlyDependantSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1, "First name is required"),
  middleNames: z.string().optional(),
  surname: z.string().min(1, "Surname is required"),
  dateOfBirth: z.string().optional(),
  isOver100: z.boolean().default(false),
  // Care home specific fields
  careHomeName: z.string().optional(),
  careHomeFees: z.coerce.number().nonnegative().optional(),
  careHomeInvoiceDocumentId: z.string().optional(),
});

export const dependentElderlySchema = z
  .object({
    hasElderlyAtHome: z.boolean(),
    elderlyAtHomeCount: z.coerce.number().int().min(0).optional(),
    elderlyAtHome: z.array(elderlyDependantSchema).default([]),
    hasElderlyInCare: z.boolean(),
    elderlyInCareCount: z.coerce.number().int().min(0).optional(),
    elderlyInCare: z.array(elderlyDependantSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.hasElderlyAtHome && !data.elderlyAtHomeCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter the number of elderly dependants at home",
        path: ["elderlyAtHomeCount"],
      });
    }
    if (data.hasElderlyInCare && !data.elderlyInCareCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter the number of elderly dependants in care",
        path: ["elderlyInCareCount"],
      });
    }
    // Per-elder care-home details (workbook §4 Q13): first/surname/care-home
    // name/yearly fees are required for each in-care dependant entered.
    if (data.hasElderlyInCare) {
      data.elderlyInCare.forEach((elder, i) => {
        if (!elder.careHomeName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter the care home name",
            path: ["elderlyInCare", i, "careHomeName"],
          });
        }
        if (elder.careHomeFees === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter the yearly care home fees",
            path: ["elderlyInCare", i, "careHomeFees"],
          });
        }
      });
    }
  });

export type DependentElderlyFormValues = z.infer<typeof dependentElderlySchema>;
