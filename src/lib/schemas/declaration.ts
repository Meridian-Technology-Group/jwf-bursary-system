import { z } from "zod";

/**
 * Declaration — Section 8 (workbook): per-parent acceptance.
 *
 * Parent/Guardian 1 must tick + sign. Parent/Guardian 2 must tick + sign too
 * UNLESS the application is sole-parent — in which case the form omits the P2
 * block entirely (its fields are absent). The superRefine therefore only
 * enforces P2 when the P2 block was shown (detected by `acceptedParent2` being
 * present in the submitted object).
 *
 * Legacy single-tick fields (`accepted` / `signedOnBehalfOf`) are accepted on
 * read for back-compat but are no longer written by the form.
 */
export const declarationSchema = z
  .object({
    acceptedParent1: z.boolean().refine((v) => v === true, {
      message: "Parent/Guardian 1 must accept the declaration to submit",
    }),
    signedOnBehalfOfParent1: z
      .string()
      .trim()
      .min(2, "Please enter the name of Parent/Guardian 1")
      .max(120, "Name is too long"),
    acceptedParent2: z.boolean().optional(),
    signedOnBehalfOfParent2: z.string().trim().max(120, "Name is too long").optional(),
    // Legacy fields — accepted on read, ignored on write.
    accepted: z.boolean().optional(),
    signedOnBehalfOf: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // The P2 block was shown (dual-parent) when acceptedParent2 is present.
    const p2Shown = data.acceptedParent2 !== undefined;
    if (p2Shown) {
      if (data.acceptedParent2 !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parent/Guardian 2 must accept the declaration to submit",
          path: ["acceptedParent2"],
        });
      }
      if (!data.signedOnBehalfOfParent2 || data.signedOnBehalfOfParent2.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the name of Parent/Guardian 2",
          path: ["signedOnBehalfOfParent2"],
        });
      }
    }
  });

export type DeclarationFormValues = z.infer<typeof declarationSchema>;
