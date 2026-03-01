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

export const dependentChildrenSchema = z.object({
  numberOfDependentChildren: z
    .number({ message: "Please enter the number of dependent children" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  children: z.array(dependentChildSchema),
});

export type DependentChildrenFormValues = z.infer<typeof dependentChildrenSchema>;
