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

/**
 * F5: both yes/no questions are REQUIRED and start UNANSWERED (the form seeds
 * them `undefined` so no answer is presumed). A bare `z.boolean()` failed its
 * base type check and showed the raw "Invalid input: expected boolean, received
 * undefined", naming no field; seeding `false` would have answered "No" for the
 * applicant. Each therefore carries a custom message — same requirement, legible
 * copy. See `src/lib/portal/section-defaults.ts`.
 */
export const dependentElderlySchema = z
  .object({
    hasElderlyAtHome: z.boolean({
      error:
        "Please indicate whether you have any elderly dependant that you are providing for at home",
    }),
    elderlyAtHomeCount: z.coerce.number().int().min(0).optional(),
    elderlyAtHome: z.array(elderlyDependantSchema).default([]),
    hasElderlyInCare: z.boolean({
      error:
        "Please indicate whether you have any elderly dependant that you are providing for in a care home",
    }),
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
    // The number of in-care entries must match the declared count: declaring 1
    // or 2 elderly dependants in a care home requires that many full entries
    // before the section (and the application) can be submitted.
    if (
      data.hasElderlyInCare &&
      typeof data.elderlyInCareCount === "number" &&
      data.elderlyInCareCount > 0 &&
      data.elderlyInCare.length !== data.elderlyInCareCount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `You told us you have ${data.elderlyInCareCount} elderly ${
          data.elderlyInCareCount === 1 ? "dependant" : "dependants"
        } in a care home, but ${data.elderlyInCare.length} ${
          data.elderlyInCare.length === 1 ? "entry has" : "entries have"
        } been added. Please add details for every elderly dependant in care so the numbers match.`,
        path: ["elderlyInCare"],
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
