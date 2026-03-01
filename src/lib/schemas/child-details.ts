import { z } from "zod";

export const childAddressSchema = z.object({
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City or town is required"),
  postcode: z
    .string()
    .min(1, "Postcode is required")
    .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, "Enter a valid UK postcode"),
  country: z.string().min(1, "Country is required"),
});

export const childDetailsSchema = z
  .object({
    school: z.enum(["TRINITY", "WHITGIFT"] as const, {
      message: "Please select a school",
    }),
    applyingToAnotherSchool: z.boolean(),
    childFullName: z
      .string()
      .min(2, "Child's full name is required")
      .max(120, "Name is too long"),
    gender: z.string().min(1, "Please select a gender"),
    dateOfBirth: z
      .string()
      .min(1, "Date of birth is required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    placeOfBirth: z.string().min(1, "Place of birth is required"),
    birthCertificateDocumentId: z.string().optional(),
    sameAddressAsParent1: z.boolean(),
    childAddress: childAddressSchema.optional(),
    currentSchool: z.string().min(1, "Current school is required"),
    currentSchoolStartDate: z
      .string()
      .min(1, "School start date is required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAddressAsParent1 && !data.childAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Child address is required when different from Parent 1",
        path: ["childAddress"],
      });
    }
  });

export type ChildDetailsFormValues = z.infer<typeof childDetailsSchema>;
