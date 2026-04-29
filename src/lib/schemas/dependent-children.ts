import { z } from "zod";

export const dependentChildSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Child name is required"),
  dependentStatusDate: z.string().optional(),
  surnameOtherParent: z.string().optional(),
  bursaryAmount: z.coerce.number().nonnegative().optional(),
  school: z.string().optional(),
  unearnedIncome: z.coerce
    .number()
    .nonnegative("Enter 0 if not applicable")
    .default(0),
  isNamedChild: z.boolean().optional(),
});

export const dependentChildrenSchema = z
  .object({
    numberOfDependentChildren: z
      .number({ message: "Please enter the number of dependent children" })
      .int("Must be a whole number")
      .min(0, "Cannot be negative"),
    children: z.array(dependentChildSchema),
  })
  .superRefine((val, ctx) => {
    const children = val.children;

    // R1 — at least one child must be present
    if (children.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one dependent child must be added before saving this section.",
        path: ["children"],
      });
      // No point checking named-child rule when there are no children.
      return;
    }

    // R2 — exactly one child must have isNamedChild === true
    const namedCount = children.filter((c) => c.isNamedChild === true).length;

    if (namedCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One child must be marked as the named child of this application.",
        path: ["children"],
      });
    } else if (namedCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one child can be marked as the named child. Please remove the flag from the extra rows.",
        path: ["children"],
      });
      // Also flag each duplicate row so the table row highlight works
      children.forEach((c, index) => {
        if (c.isNamedChild === true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Multiple children are marked as the named child — only one is allowed.",
            path: ["children", index, "isNamedChild"],
          });
        }
      });
    }
  });

export type DependentChildrenFormValues = z.infer<typeof dependentChildrenSchema>;
