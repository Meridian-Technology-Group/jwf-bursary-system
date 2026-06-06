import { z } from "zod";

export const otherInfoSchema = z
  .object({
    hasCOurtOrder: z.boolean(),
    courtOrderTermAmount: z.coerce.number().nonnegative().optional(),
    courtOrderYearAmount: z.coerce.number().nonnegative().optional(),
    courtOrderSchoolYear: z.string().optional(),
    courtOrderDocumentId: z.string().optional(),
    maintenancePaymentDocumentId: z.string().optional(),
    // Child maintenance branch (workbook §5 Q2).
    hasChildMaintenance: z.boolean().optional(),
    maintenancePayer: z.enum(["YOU", "EX_PARTNER"] as const).optional(),
    maintenanceIsDivorced: z.boolean().optional(),
    maintenanceDecreeAbsoluteDocumentId: z.string().optional(),
    maintenanceAgreementNote: z.string().optional(),
    hasInsurancePolicy: z.boolean(),
    insurancePolicyAmount: z.coerce.number().nonnegative().optional(),
    insurancePolicySchoolYear: z.string().optional(),
    insurancePolicyStartDate: z.string().optional(),
    insurancePolicyEndDate: z.string().optional(),
    insurancePolicyDocumentId: z.string().optional(),
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
      if (!data.courtOrderSchoolYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter which school year the order relates to",
          path: ["courtOrderSchoolYear"],
        });
      }
    }
    if (data.hasChildMaintenance && data.maintenancePayer === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please indicate who pays the maintenance",
        path: ["maintenancePayer"],
      });
    }
    if (
      data.hasChildMaintenance &&
      data.maintenancePayer === "YOU" &&
      data.maintenanceIsDivorced === false &&
      !data.maintenanceAgreementNote
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please describe the mutual agreement",
        path: ["maintenanceAgreementNote"],
      });
    }
    if (data.hasInsurancePolicy) {
      if (data.insurancePolicyAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the insurance policy amount",
          path: ["insurancePolicyAmount"],
        });
      }
      if (!data.insurancePolicySchoolYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter which school year the policy relates to",
          path: ["insurancePolicySchoolYear"],
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
