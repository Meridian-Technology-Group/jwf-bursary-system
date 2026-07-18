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
 * Parent-facing employment status — a 3-way classifier only. It does NOT map
 * to the assessor-side Prisma EmploymentStatus enum; the assessor sets the
 * granular earner status independently, and the detailed income breakdown is
 * captured in the Income section.
 */
export const employmentStatusSchema = z.enum(
  ["UNEMPLOYED_OR_RETIRED", "EMPLOYED", "SELF_EMPLOYED"] as const,
  { message: "Please select an employment status" }
);

/** Self-employment "Position" within the self-employment details sub-panel. */
export const selfEmploymentPositionSchema = z.enum(
  ["DIRECTOR", "PARTNER", "SOLE_TRADER"] as const,
  { message: "Please select your position" }
);

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

export const parentContactSchema = z
  .object({
    title: parentTitleSchema,
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    telephone: z.string().optional(),
    telephone2: z.string().optional(),
    mobile: z.string().optional(),
    // Email is MANDATORY (meeting-findings) — captured explicitly even when the
    // family was invited by email.
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Enter a valid email address"),
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City or town is required"),
    postcode: z.string().min(1, "Postcode is required"),
    country: z.string().min(1, "Country is required"),
  })
  .superRefine((data, ctx) => {
    // A contact telephone is MANDATORY (meeting-findings). At least one of
    // mobile / telephone must be provided.
    const hasPhone =
      (data.mobile && data.mobile.trim().length > 0) ||
      (data.telephone && data.telephone.trim().length > 0);
    if (!hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A contact telephone or mobile number is required",
        path: ["mobile"],
      });
    }
  });

export const parentEmploymentSchema = z
  .object({
    status: employmentStatusSchema,
    profession: z.string().optional(),
    employerAddress: z.string().optional(),
    isDirector: z.boolean().optional(),
    sharePercentage: z.string().optional(),
    selfEmploymentCompanyName: z.string().optional(),
    selfEmploymentPosition: selfEmploymentPositionSchema.optional(),
    leftEmployment: z.boolean().optional(),
    p45DocumentId: z.string().optional(),
    receivedRedundancy: z.boolean().optional(),
    redundancyDocumentId: z.string().optional(),
    declarationAccepted: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "EMPLOYED") {
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
      if (data.isDirector === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please tell us whether you are a director",
          path: ["isDirector"],
        });
      }
      if (data.isDirector === true && !data.sharePercentage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Share percentage is required for directors",
          path: ["sharePercentage"],
        });
      }
    }

    if (data.status === "SELF_EMPLOYED") {
      if (!data.profession) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Profession or trade is required",
          path: ["profession"],
        });
      }
      if (!data.selfEmploymentCompanyName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Company name is required",
          path: ["selfEmploymentCompanyName"],
        });
      }
      if (!data.selfEmploymentPosition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select your position",
          path: ["selfEmploymentPosition"],
        });
      }
    }

    // Shared "left employment" sub-branch — asked for ALL statuses.
    if (data.leftEmployment === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please tell us whether you have left employment in the last 12 months",
        path: ["leftEmployment"],
      });
    }

    if (data.leftEmployment === true && data.receivedRedundancy === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please tell us whether you received a redundancy / severance package",
        path: ["receivedRedundancy"],
      });
    }

    // NOTE: the P45 and redundancy-evidence DOCUMENTS are NOT required at the
    // per-section level — they are enforced as error-severity gaps in
    // section-rules.ts (EMPLOYMENT_P45 / EMPLOYMENT_REDUNDANCY), which block the
    // final submitApplication until the document is provided.
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
/** Shared-custody arrangement (Epic 09, D15). Mirrors the Prisma enum. */
export const custodyArrangementSchema = z.enum(
  ["SOLE", "SHARED_5050", "SHARED_MAIN_LIMITED"] as const,
  { message: "Please select the custody arrangement" }
);

/**
 * Relationship statuses that imply a two-parent household (a resident partner
 * who is the child's other parent). Selecting any of these opens both parents'
 * details and both income columns regardless of the sole-parent answer, and
 * resolves the contradiction of "sole parent = yes" coexisting with a coupled
 * status.
 */
export const COUPLED_RELATIONSHIP_STATUSES = [
  "MARRIED",
  "CIVIL_PARTNERSHIP",
  "COHABITING",
] as const;

/**
 * A household is treated as two-parent when the applicant is explicitly NOT a
 * sole parent, OR when their current relationship status with the child's other
 * parent is married / civil partnership / cohabiting.
 */
export function isTwoParentHousehold(input: {
  isSoleParent?: boolean | null;
  relationshipStatus?: string | null;
}): boolean {
  if (input.isSoleParent === false) return true;
  return (COUPLED_RELATIONSHIP_STATUSES as readonly string[]).includes(
    input.relationshipStatus ?? ""
  );
}

const parentDetailsObject = z
  .object({
    isSoleParent: z.boolean(),
    relationshipStatus: relationshipStatusSchema,
    // ── Epic 09 household facets (D15/D16/D17). All optional + additive so
    // existing drafts and immutable submitted blobs validate unchanged; the
    // rules engine treats absent facets as their defaults (SOLE / not guardian /
    // not remarried / finances stable). ─────────────────────────────────────
    /** D16 — foster carer / legal guardian facet. Drives the guardianship ask. */
    isGuardian: z.boolean().optional(),
    /** D15 — shared-custody split (only meaningful for shared care). */
    custodyArrangement: custodyArrangementSchema.optional(),
    /** D17 — remarried sole parent (resident household + absent natural parent). */
    isRemarriedSoleParent: z.boolean().optional(),
    /** H9 — mid-divorce, finances not yet disentangled (assessor may-defer flag). */
    financesNotDisentangled: z.boolean().optional(),
    /**
     * H7 discriminator — "Is there a court order specifically for school fees?"
     * Only asked (and the cannot-support notice only shown) when DIVORCED. The
     * authoritative store remains OTHER_INFO.hasCOurtOrder; this mirror lets the
     * notice render live on the parent-details step. Optional/back-compat.
     */
    hasSchoolFeesCourtOrder: z.boolean().optional(),
    /** H3 — death certificate of the deceased parent (widowed). */
    deathCertificateDocumentId: z.string().optional(),
    /** H4 — evidence of guardianship / foster status (D16). */
    guardianshipDocumentId: z.string().optional(),
    parent1Contact: parentContactSchema,
    parent1Employment: parentEmploymentSchema,
    parent2Contact: z.any().optional(),
    parent2Employment: z.any().optional(),
  });

/**
 * Parent 2 validation, factored so the portal (primary applicant) schema can
 * require the second parent whenever the household is two-parent — including a
 * coupled relationship status picked alongside sole-parent = yes — while the
 * secondary-parent contribute flow (which forces isSoleParent=true and never
 * shows the Parent 2 block) keys the requirement on the sole-parent flag alone.
 */
function refineParentDetails(requireSecondParentWhenCoupled: boolean) {
  return (
    data: z.infer<typeof parentDetailsObject>,
    ctx: z.RefinementCtx
  ) => {
    // UK postcode validation for parent 1
    validateContactPostcode(data.parent1Contact, ctx, "parent1Contact");

    // Skip parent 2 validation entirely for a single-parent household.
    const twoParent = requireSecondParentWhenCoupled
      ? isTwoParentHousehold(data)
      : data.isSoleParent === false;
    if (!twoParent) return;

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
  };
}

/** Portal (primary applicant) schema — two-parent when sole=no OR coupled. */
export const parentDetailsSchema = parentDetailsObject.superRefine(
  refineParentDetails(true)
);

/**
 * Secondary-parent (dual-parent invite) schema — the second parent only ever
 * supplies their own details, so Parent 2 is never required regardless of the
 * relationship status they select.
 */
export const secondaryParentDetailsSchema = parentDetailsObject.superRefine(
  refineParentDetails(false)
);

export type ParentDetailsFormValues = z.infer<typeof parentDetailsSchema>;
