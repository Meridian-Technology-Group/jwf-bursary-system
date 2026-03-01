import { z } from "zod";

const currencyField = z.coerce
  .number({ error: "Please enter a number" })
  .nonnegative("Must be 0 or more")
  .default(0);

export const otherPropertySchema = z.object({
  id: z.string(),
  address: z.string().min(1, "Address is required"),
  postcode: z.string().min(1, "Postcode is required"),
  value: currencyField,
});

export const assetsLiabilitiesSchema = z
  .object({
    propertyOwnership: z.enum(["OWN", "RENT"] as const, {
      message: "Please select own or rent",
    }),
    residenceValue: currencyField,
    carValue: currencyField,
    otherPossessionsValue: currencyField,
    stocksAndSharesValue: currencyField,
    investmentsValue: currencyField,
    otherAssetsValue: currencyField,
    hasOtherProperties: z.boolean(),
    otherPropertiesTotalValue: currencyField.optional(),
    hasRentalProperty: z.boolean().optional(),
    rentalPropertyValue: currencyField.optional(),
    otherMortgageBalance: currencyField,
    councilTaxDocumentId: z.string().optional(),
    parent1BankStatementDocumentIds: z.array(z.string()).default([]),
    parent2BankStatementDocumentIds: z.array(z.string()).optional(),
    otherProperties: z.array(otherPropertySchema).default([]),
    outstandingMainMortgage: currencyField,
    totalOtherMortgages: currencyField,
    currentOverdraft: currencyField,
    hasHirePurchase: z.boolean(),
    hirePurchaseBalance: currencyField.optional(),
    liabilitiesAgreementsDocumentId: z.string().optional(),
    liabilitiesStatementDocumentId: z.string().optional(),
    hasLiabilityChanges: z.boolean(),
    documentsConfirmed: z.boolean().refine((v) => v === true, {
      message: "You must confirm documents are current and legible",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.hasHirePurchase && data.hirePurchaseBalance === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter the total hire purchase balance",
        path: ["hirePurchaseBalance"],
      });
    }
  });

export type AssetsLiabilitiesFormValues = z.infer<typeof assetsLiabilitiesSchema>;
