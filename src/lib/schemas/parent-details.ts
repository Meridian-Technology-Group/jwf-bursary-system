import { z } from "zod";

export const parentTitleSchema = z.enum(
  ["MR", "MRS", "MS", "MISS", "DR", "PROF", "OTHER"] as const,
  { message: "Please select a title" }
);

export const relationshipStatusSchema = z.enum(
  [
    "SINGLE",
    "MARRIED",
    "WIDOWED",
    "SEPARATED",
    "DIVORCED",
    "CIVIL_PARTNERSHIP",
    "COHABITING",
  ] as const,
  { message: "Please select a relationship status" }
);

export const employmentStatusSchema = z.enum(
  [
    "EMPLOYED",
    "UNEMPLOYED",
    "SELF_EMPLOYED",
    "SELF_EMPLOYED_CIS",
    "SELF_EMPLOYED_AND_EMPLOYED",
    "RETIRED",
  ] as const,
  { message: "Please select an employment status" }
);

export const parentContactSchema = z.object({
  title: parentTitleSchema,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  telephone: z.string().optional(),
  telephone2: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City or town is required"),
  postcode: z
    .string()
    .min(1, "Postcode is required")
    .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, "Enter a valid UK postcode"),
  country: z.string().min(1, "Country is required"),
});

export const parentEmploymentSchema = z
  .object({
    status: employmentStatusSchema,
    profession: z.string().optional(),
    employerAddress: z.string().optional(),
    bookYearEndDate: z.string().optional(),
    isDirector: z.boolean().optional(),
    sharePercentage: z.string().optional(),
    certifiedAccountsDocumentId: z.string().optional(),
    balanceSheetDocumentId: z.string().optional(),
    leftSelfEmployment: z.boolean().optional(),
    leftSelfEmploymentDocumentId: z.string().optional(),
    grossPay: z.coerce.number().nonnegative("Gross pay must be 0 or more").optional(),
    receivesScholarship: z.boolean().optional(),
    scholarshipDocumentId: z.string().optional(),
    unemployedDetails: z.string().optional(),
    declarationAccepted: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const isWorking = [
      "EMPLOYED",
      "SELF_EMPLOYED",
      "SELF_EMPLOYED_CIS",
      "SELF_EMPLOYED_AND_EMPLOYED",
    ].includes(data.status);

    if (isWorking) {
      if (!data.profession) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Profession or trade is required",
          path: ["profession"],
        });
      }
      if (!data.employerAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Employer/business address is required",
          path: ["employerAddress"],
        });
      }
    }

    if (data.status === "UNEMPLOYED" && !data.unemployedDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide details about your circumstances",
        path: ["unemployedDetails"],
      });
    }

    if (data.isDirector) {
      if (!data.sharePercentage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Share percentage is required for directors",
          path: ["sharePercentage"],
        });
      }
    }

    if (data.leftSelfEmployment && !data.leftSelfEmploymentDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload evidence of previous self-employment",
        path: ["leftSelfEmploymentDocumentId"],
      });
    }

    if (data.receivesScholarship && !data.scholarshipDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload scholarship/maintenance evidence",
        path: ["scholarshipDocumentId"],
      });
    }
  });

export const parentDetailsSchema = z
  .object({
    isSoleParent: z.boolean(),
    relationshipStatus: relationshipStatusSchema,
    parent1Contact: parentContactSchema,
    parent1Employment: parentEmploymentSchema,
    parent2Contact: parentContactSchema.optional(),
    parent2Employment: parentEmploymentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isSoleParent) {
      if (!data.parent2Contact) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parent/Guardian 2 contact details are required",
          path: ["parent2Contact"],
        });
      }
      if (!data.parent2Employment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parent/Guardian 2 employment details are required",
          path: ["parent2Employment"],
        });
      }
    }
  });

export type ParentDetailsFormValues = z.infer<typeof parentDetailsSchema>;
