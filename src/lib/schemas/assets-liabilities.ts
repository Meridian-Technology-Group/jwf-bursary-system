import { z } from "zod";

const currencyField = z.coerce
  .number({ error: "Please enter a number" })
  .nonnegative("Must be 0 or more")
  .default(0);

/** Q1 RENT branch — the four mutually-exclusive rent arrangements. */
export const rentAgreementSchema = z.enum(
  ["PRIVATE", "COUNCIL", "COUNCIL_NO_RENT", "RELATIVES"] as const,
  { message: "Please select your rent arrangement" }
);

/** Q5 — car ownership vs lease. */
export const carOwnershipSchema = z.enum(["OWN", "LEASE"] as const, {
  message: "Please select whether you own or lease a car",
});

/** Q2 — an additional owned property. */
export const otherPropertySchema = z.object({
  id: z.string(),
  address: z.string().min(1, "Address is required"),
  postcode: z.string().min(1, "Postcode is required"),
  /** Current market value (£). */
  value: currencyField,
  mortgageBalance: currencyField.optional(),
  monthlyRepayment: currencyField.optional(),
  usedAsRental: z.boolean().optional(),
  mortgageStatementDocumentId: z.string().optional(),
});

export const assetsLiabilitiesSchema = z
  .object({
    // ── PROPERTY ─────────────────────────────────────────────────────────────
    propertyOwnership: z.enum(["OWN", "RENT"] as const, {
      message: "Please select own or rent",
    }),
    // OWN branch
    residenceValue: currencyField, // market value of family home
    hasMortgage: z.boolean().optional(),
    mortgageBalance: currencyField.optional(),
    monthlyMortgageRepayment: currencyField.optional(),
    mortgageStatementDocumentId: z.string().optional(),
    // RENT branch
    rentAgreementType: rentAgreementSchema.optional(),
    monthlyRent: currencyField.optional(), // PRIVATE or COUNCIL
    tenancyAgreementDocumentId: z.string().optional(),
    housingBenefitLetterDocumentId: z.string().optional(),
    relativeLetterDocumentId: z.string().optional(),
    // Q2 — other properties
    hasOtherProperties: z.boolean({
      error: "Please indicate whether you own any other properties",
    }),
    otherProperties: z.array(otherPropertySchema).default([]),
    // Q3 — charging order
    hasChargingOrder: z.boolean({
      error: "Please indicate whether a charging order exists",
    }),
    chargingOrderAddress: z.string().optional(),
    chargingOrderPostcode: z.string().optional(),
    chargingOrderValue: currencyField.optional(),
    // Q4 — council tax letter
    councilTaxDocumentId: z.string().optional(),

    // ── CAR & HOME CONTENTS ────────────────────────────────────────────────────
    carOwnership: carOwnershipSchema, // Q5
    carValue: currencyField.optional(), // OWN
    carMonthlyLease: currencyField.optional(), // LEASE
    carLeaseAgreementDocumentId: z.string().optional(),
    usesPublicTransport: z.boolean({
      error: "Please indicate whether you use public transport regularly",
    }),
    publicTransportMonthly: currencyField.optional(), // Q6
    otherPossessionsValue: currencyField, // Q7

    // ── FINANCIAL ASSETS & DEBT ─────────────────────────────────────────────────
    totalCashBalance: currencyField, // Q9
    investmentsValue: currencyField, // Q10
    // Q11 — bank statements + investment portfolios, per parent
    parent1CurrentAccountDocumentIds: z.array(z.string()).default([]),
    parent1SavingsAccountDocumentIds: z.array(z.string()).default([]),
    parent1OwnsInvestments: z.boolean().optional(),
    parent1InvestmentDocumentIds: z.array(z.string()).default([]),
    parent2CurrentAccountDocumentIds: z.array(z.string()).optional(),
    parent2SavingsAccountDocumentIds: z.array(z.string()).optional(),
    parent2OwnsInvestments: z.boolean().optional(),
    parent2InvestmentDocumentIds: z.array(z.string()).optional(),
    // Q12 — personal debt (excl. mortgages)
    hasPersonalDebt: z.boolean({
      error: "Please indicate whether you have any personal debt",
    }),
    creditCardBalance: currencyField.optional(),
    creditCardStatementDocumentIds: z.array(z.string()).default([]),
    bankOverdraft: currencyField.optional(),
    loansToAgencies: currencyField.optional(),
    loanStatementDocumentIds: z.array(z.string()).default([]),
    loansToFriendsFamily: currencyField.optional(),
    schoolFeesOwed: currencyField.optional(),
    otherDebtDocumentIds: z.array(z.string()).default([]),

    documentsConfirmed: z.boolean().refine((v) => v === true, {
      message: "You must confirm documents are current and legible",
    }),
  })
  .superRefine((data, ctx) => {
    // OWN — market value mandatory (> £0) + mortgage question answered.
    if (data.propertyOwnership === "OWN") {
      if (!data.residenceValue || data.residenceValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the approximate market value of your home",
          path: ["residenceValue"],
        });
      }
      if (data.hasMortgage === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please tell us whether you have a mortgage",
          path: ["hasMortgage"],
        });
      }
      if (data.hasMortgage === true) {
        if (data.mortgageBalance === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter the mortgage balance still due",
            path: ["mortgageBalance"],
          });
        }
        if (data.monthlyMortgageRepayment === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter your monthly mortgage repayment",
            path: ["monthlyMortgageRepayment"],
          });
        }
      }
    }

    // RENT — arrangement mandatory; monthly rent mandatory for tenant types.
    if (data.propertyOwnership === "RENT") {
      if (!data.rentAgreementType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select your rent arrangement",
          path: ["rentAgreementType"],
        });
      }
      if (
        (data.rentAgreementType === "PRIVATE" ||
          data.rentAgreementType === "COUNCIL") &&
        (data.monthlyRent === undefined || data.monthlyRent <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter your monthly rent",
          path: ["monthlyRent"],
        });
      }
    }

    // Q3 — charging order details required when one exists.
    if (data.hasChargingOrder === true) {
      if (!data.chargingOrderAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the address of the property with the charging order",
          path: ["chargingOrderAddress"],
        });
      }
      if (data.chargingOrderValue === undefined || data.chargingOrderValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter the value of the charging order",
          path: ["chargingOrderValue"],
        });
      }
    }

    // Q5 — car value (OWN) / lease charge (LEASE).
    if (
      data.carOwnership === "LEASE" &&
      (data.carMonthlyLease === undefined || data.carMonthlyLease <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter your monthly lease charge",
        path: ["carMonthlyLease"],
      });
    }

    // Q6 — public transport monthly cost when used.
    if (
      data.usesPublicTransport === true &&
      (data.publicTransportMonthly === undefined ||
        data.publicTransportMonthly <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter your household's monthly public transport cost",
        path: ["publicTransportMonthly"],
      });
    }

    // NOTE: mandatory DOCUMENT uploads (council tax always; mortgage / tenancy /
    // HB / relative letters; bank current statements; investment docs; credit
    // card statement when a balance is declared) are enforced as error-severity
    // gaps in section-rules.ts — not duplicated here — so the doc rules live in
    // one place.
  });

export type AssetsLiabilitiesFormValues = z.infer<typeof assetsLiabilitiesSchema>;
