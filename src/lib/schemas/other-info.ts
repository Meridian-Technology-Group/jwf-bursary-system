import { z } from "zod";

/**
 * F5: the three yes/no questions below are REQUIRED and start UNANSWERED — the
 * form seeds them `undefined` precisely so no answer is presumed. A bare
 * `z.boolean()` therefore failed its base type check and showed the applicant
 * the raw "Invalid input: expected boolean, received undefined", naming no
 * field. Seeding `false` would have been worse (it would answer "No" on their
 * behalf), so each carries a custom message instead — matching the pattern
 * already used throughout `assets-liabilities.ts`. Nothing here is more or less
 * required than before; only the wording the applicant reads has changed.
 */
export const otherInfoSchema = z
  .object({
    hasCOurtOrder: z.boolean({
      error:
        "Please indicate whether you have a court order for the payment of school fees",
    }),
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
    hasInsurancePolicy: z.boolean({
      error:
        "Please indicate whether you have the benefit of any insurance policies specifically to pay school fees",
    }),
    insurancePolicyAmount: z.coerce.number().nonnegative().optional(),
    insurancePolicySchoolYear: z.string().optional(),
    insurancePolicyStartDate: z.string().optional(),
    insurancePolicyEndDate: z.string().optional(),
    insurancePolicyDocumentId: z.string().optional(),
    hasOutstandingFees: z.boolean({
      error:
        "Please indicate whether any outstanding school fees are owed at any other school",
    }),
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
      data.maintenancePayer !== undefined &&
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
