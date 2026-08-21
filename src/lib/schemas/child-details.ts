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

/**
 * Child title options. Children are typically addressed as Master/Miss, with
 * Mr/Ms available for older applicants and Other as the escape hatch. Stored as
 * a plain string (the Select constrains the value) and OPTIONAL.
 */
export const CHILD_TITLES = [
  { value: "MASTER", label: "Master" },
  { value: "MISS", label: "Miss" },
  { value: "MR", label: "Mr" },
  { value: "MS", label: "Ms" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * Join a title/first/surname triple into the single `childFullName` string that
 * downstream consumers (review, summary, dependent-children prefill, etc.) read.
 * Title is intentionally excluded so the stored full name stays a plain name.
 */
export function composeChildFullName(
  firstName?: string | null,
  surname?: string | null
): string {
  return [firstName, surname]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Split a legacy single `childFullName` into { firstName, surname } for seeding
 * the split fields. The last whitespace-delimited token becomes the surname and
 * everything before it the first name; a single token becomes the first name.
 */
export function splitChildFullName(full?: string | null): {
  firstName: string;
  surname: string;
} {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", surname: "" };
  if (parts.length === 1) return { firstName: parts[0], surname: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
  };
}

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
    // NOTE: entry year / entry year-group are deliberately ABSENT here.
    // Per Q1 (Brian, 2026-08-14) the entry year is a JWF-facing property of the
    // application: it is set admin-side on `Application.entryYear` /
    // `entryYearGroup` and the applicant can neither enter, change nor see it.
    // The schema must not accept it — an unknown key in a legacy draft is
    // stripped by Zod rather than validated or promoted.
    childTitle: z.string().optional(),
    childFirstName: reqString(1, "Child's first name is required"),
    childSurname: reqString(1, "Child's surname is required"),
    // Derived on write (see `.transform` below) from first name + surname. Kept
    // in the stored blob for the many downstream consumers that read a single
    // childFullName string; not entered directly on the form.
    childFullName: z.string().optional(),
    gender: reqString(1, "Please select a gender"),
    dateOfBirth: z.preprocess(
      (v) => (v == null ? "" : v),
      z
        .string()
        .min(1, "Date of birth is required")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    ),
    placeOfBirthCity: reqString(1, "Town or city of birth is required"),
    placeOfBirth: reqString(1, "Country of birth is required"),
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
  })
  // Keep the derived single-string childFullName in sync on every save so the
  // downstream consumers that read it stay correct regardless of the entry flow.
  .transform((data) => ({
    ...data,
    childFullName: composeChildFullName(data.childFirstName, data.childSurname),
  }));

export type ChildDetailsFormValues = z.infer<typeof childDetailsSchema>;
