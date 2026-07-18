import { z } from "zod";

export const dependentChildSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Child name is required"),
  dependentStatusDate: z.string().optional(),
  surnameOtherParent: z.string().optional(),
  school: z.string().optional(),
  schoolAddress: z.string().optional(),
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

    // R3 — the number of children entries must match the declared count. The
    // named child on the application counts towards the total, so declaring N
    // requires N full rows (including the named child).
    if (val.numberOfDependentChildren !== children.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `You told us you have ${val.numberOfDependentChildren} dependent ${
          val.numberOfDependentChildren === 1 ? "child" : "children"
        }, but ${children.length} ${
          children.length === 1 ? "has" : "have"
        } been added. Please add details for every dependent child (including the child named on this application) so the two numbers match.`,
        path: ["children"],
      });
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
