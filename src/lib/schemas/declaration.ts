import { z } from "zod";

export const declarationSchema = z.object({
  accepted: z
    .boolean()
    .refine((v) => v === true, {
      message:
        "You must accept the declaration to submit your application",
    }),
  signedOnBehalfOf: z
    .string()
    .min(2, "Please enter the name of the person accepting this declaration")
    .max(120, "Name is too long"),
});

export type DeclarationFormValues = z.infer<typeof declarationSchema>;
