import { z } from "zod";

export const otherInfoSchema = z
  .object({
    hasCOurtOrder: z.boolean(),
    courtOrderTermAmount: z.coerce.number().nonnegative().optional(),
    courtOrderYearAmount: z.coerce.number().nonnegative().optional(),
    courtOrderDocumentId: z.string().optional(),
    maintenancePaymentDocumentId: z.string().optional(),
    hasInsurancePolicy: z.boolean(),
    insurancePolicyAmount: z.coerce.number().nonnegative().optional(),
    insurancePolicyStartDate: z.string().optional(),
    insurancePolicyEndDate: z.string().optional(),
    hasOutstandingFees: z.boolean(),
    outstandingFeesSchoolName: z.string().optional(),
    outstandingFeesAmount: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasCOurtOrder) {
      if (data.courtOrderTermAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the term amount",
          path: ["courtOrderTermAmount"],
        });
      }
      if (data.courtOrderYearAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the yearly amount",
          path: ["courtOrderYearAmount"],
        });
      }
    }
    if (data.hasInsurancePolicy) {
      if (data.insurancePolicyAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the insurance policy amount",
          path: ["insurancePolicyAmount"],
        });
      }
    }
    if (data.hasOutstandingFees) {
      if (!data.outstandingFeesSchoolName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the school name",
          path: ["outstandingFeesSchoolName"],
        });
      }
      if (data.outstandingFeesAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the amount owed",
          path: ["outstandingFeesAmount"],
        });
      }
    }
  });

export type OtherInfoFormValues = z.infer<typeof otherInfoSchema>;
