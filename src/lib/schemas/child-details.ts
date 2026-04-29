import { z } from "zod";

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

/**
 * Required-string helper. Coerces nullish inputs to "" before validation so
 * users always see the domain-specific `.min()` message rather than Zod's
 * generic "expected string, received undefined" fallback (react-hook-form +
 * Radix Select sometimes drop the "" default into form state as undefined).
 */
const reqString = (minLen: number, message: string) =>
  z.preprocess(
    (v) => (v == null ? "" : v),
    z.string().min(minLen, message)
  );

export const childAddressSchema = z.object({
  addressLine1: reqString(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: reqString(1, "City or town is required"),
  postcode: reqString(1, "Postcode is required"),
  country: reqString(1, "Country is required"),
});

export const childDetailsSchema = z
  .object({
    school: z.enum(["TRINITY", "WHITGIFT"] as const, {
      message: "Please select a school",
    }),
    childFullName: z.preprocess(
      (v) => (v == null ? "" : v),
      z.string().min(2, "Child's full name is required").max(120, "Name is too long")
    ),
    gender: reqString(1, "Please select a gender"),
    dateOfBirth: z.preprocess(
      (v) => (v == null ? "" : v),
      z
        .string()
        .min(1, "Date of birth is required")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    ),
    placeOfBirth: reqString(1, "Place of birth is required"),
    birthCertificateDocumentId: z.string().optional(),
    sameAddressAsParent1: z.boolean(),
    // childAddress is validated manually below so the conditionally-hidden
    // address fields aren't forced to be non-empty when the child lives with
    // Parent 1 (react-hook-form keeps hidden fields registered, so they
    // arrive here as a partial object rather than `undefined`).
    childAddress: z.any().optional(),
    currentSchool: reqString(1, "Current school is required"),
    currentSchoolStartDate: z.preprocess(
      (v) => (v == null ? "" : v),
      z
        .string()
        .min(1, "School start date is required")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    ),
  })
  .superRefine((data, ctx) => {
    // When the child lives with Parent 1, ignore childAddress entirely —
    // whatever the (hidden) fields happen to contain.
    if (data.sameAddressAsParent1) return;

    const hasAnyAddressValue =
      data.childAddress &&
      typeof data.childAddress === "object" &&
      Object.values(data.childAddress).some(
        (v) => typeof v === "string" && v.trim().length > 0
      );

    if (!hasAnyAddressValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Child address is required when different from Parent 1",
        path: ["childAddress"],
      });
      return;
    }

    const result = childAddressSchema.safeParse(data.childAddress);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ["childAddress", ...issue.path],
        });
      }
      return;
    }

    // UK postcode validation for a populated address
    const { country, postcode } = result.data;
    if (
      (!country || country === "United Kingdom") &&
      postcode &&
      !UK_POSTCODE_RE.test(postcode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid UK postcode",
        path: ["childAddress", "postcode"],
      });
    }
  });

export type ChildDetailsFormValues = z.infer<typeof childDetailsSchema>;
