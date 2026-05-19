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

/**
 * Portal-side employment status. Reconciled with the assessor-side
 * Prisma EmploymentStatus enum so values can flow straight into Stage 1
 * without a translation step. See B11 in docs/PRODUCTION_READINESS.md.
 */
export const employmentStatusSchema = z.enum(
  [
    "PAYE",
    "BENEFITS",
    "SELF_EMPLOYED_DIRECTOR",
    "SELF_EMPLOYED_SOLE",
    "OLD_AGE_PENSION",
    "PAST_PENSION",
    "UNEMPLOYED",
  ] as const,
  { message: "Please select an employment status" }
);

/** Statuses that should reveal the profession/employer/director fields. */
const WORKING_STATUSES = [
  "PAYE",
  "SELF_EMPLOYED_DIRECTOR",
  "SELF_EMPLOYED_SOLE",
] as const;

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

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
  postcode: z.string().min(1, "Postcode is required"),
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
    const isWorking = (WORKING_STATUSES as readonly string[]).includes(data.status);

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

/** Validate UK postcode on a contact object. */
function validateContactPostcode(
  contact: z.infer<typeof parentContactSchema>,
  ctx: z.RefinementCtx,
  pathPrefix: string
) {
  const { country, postcode } = contact;
  if (
    (!country || country === "United Kingdom") &&
    postcode &&
    !UK_POSTCODE_RE.test(postcode)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid UK postcode",
      path: [pathPrefix, "postcode"],
    });
  }
}

/** Check if a value is a non-empty object (has at least one meaningful key). */
function isPopulatedObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === "object" && Object.keys(val).length > 0;
}

/**
 * Parent details schema.
 *
 * parent2Contact/parent2Employment use z.any().optional() so that
 * empty objects ({}) from react-hook-form don't cause parse failures.
 * They are validated manually in superRefine only when isSoleParent is false.
 */
export const parentDetailsSchema = z
  .object({
    isSoleParent: z.boolean(),
    relationshipStatus: relationshipStatusSchema,
    parent1Contact: parentContactSchema,
    parent1Employment: parentEmploymentSchema,
    parent2Contact: z.any().optional(),
    parent2Employment: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    // UK postcode validation for parent 1
    validateContactPostcode(data.parent1Contact, ctx, "parent1Contact");

    // Skip parent 2 validation entirely when sole parent
    if (data.isSoleParent) return;

    // ── Validate parent 2 contact ─────────────────────────────────────────
    if (!isPopulatedObject(data.parent2Contact)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Parent/Guardian 2 contact details are required",
        path: ["parent2Contact"],
      });
    } else {
      const p2cResult = parentContactSchema.safeParse(data.parent2Contact);
      if (!p2cResult.success) {
        for (const issue of p2cResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["parent2Contact", ...issue.path],
          });
        }
      } else {
        validateContactPostcode(p2cResult.data, ctx, "parent2Contact");
      }
    }

    // ── Validate parent 2 employment ──────────────────────────────────────
    if (!isPopulatedObject(data.parent2Employment)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Parent/Guardian 2 employment details are required",
        path: ["parent2Employment"],
      });
    } else {
      const p2eResult = parentEmploymentSchema.safeParse(data.parent2Employment);
      if (!p2eResult.success) {
        for (const issue of p2eResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["parent2Employment", ...issue.path],
          });
        }
      }
    }
  });

export type ParentDetailsFormValues = z.infer<typeof parentDetailsSchema>;
