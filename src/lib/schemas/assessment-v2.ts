import { z } from "zod";
import {
  employedIncomeSchema,
  selfEmployedIncomeSchema,
  benefitsIncomeSchema,
  unemployedIncomeSchema,
  retiredIncomeSchema,
  divorcedSeparatedIncomeSchema,
  thirdPartyIncomeSchema,
} from "@/lib/schemas/parents-income";

/**
 * CALC-02 — Zod schemas for the v2 assessor-capture JSONB shapes
 * (`src/types/assessment-v2.ts`). Unlike the parent-facing portal schemas
 * (`parents-income.ts`, `assets-liabilities.ts`) these are working assessor
 * records, not a submission gate: every field is optional and there is no
 * "at least one sub-block" / "documents confirmed" refinement. Numeric cells
 * coerce to a non-negative number, following `assets-liabilities.ts` style.
 */

const currencyField = z.coerce
  .number({ error: "Please enter a number" })
  .nonnegative("Must be 0 or more")
  .optional();

// ─── AssessorIncomeRecord ──────────────────────────────────────────────────
// Reuses the parent-form sub-block schemas as-is (they are already fully
// optional-friendly with sane defaults) and extends the two assessor-only
// sub-blocks with their extra fields.

export const assessorDivorcedSeparatedIncomeSchema = divorcedSeparatedIncomeSchema.extend({
  newSpouseIncomePortion: currencyField,
});

export const assessorThirdPartyIncomeSchema = thirdPartyIncomeSchema.extend({
  numberOfKidsDivisor: z.coerce
    .number({ error: "Please enter a number" })
    .positive("Must be greater than 0")
    .optional(),
});

export const assessorIncomeRecordSchema = z.object({
  employed: employedIncomeSchema.optional(),
  selfEmployed: selfEmployedIncomeSchema.optional(),
  benefits: benefitsIncomeSchema.optional(),
  unemployed: unemployedIncomeSchema.optional(),
  retired: retiredIncomeSchema.optional(),
  divorcedSeparated: assessorDivorcedSeparatedIncomeSchema.optional(),
  thirdParty: assessorThirdPartyIncomeSchema.optional(),
  total: z.coerce.number().nonnegative().optional(),
  documentsConfirmed: z.boolean().optional(),
});

export type AssessorIncomeRecordFormValues = z.infer<typeof assessorIncomeRecordSchema>;

// ─── PropertyAssetsRecord ──────────────────────────────────────────────────

const propertyAssetItemSchema = z.object({
  value: currencyField,
  mortgageBalance: currencyField,
});

export const propertyAssetsRecordSchema = z.object({
  home: propertyAssetItemSchema.optional(),
  second: propertyAssetItemSchema.optional(),
  other: propertyAssetItemSchema.optional(),
  // CALC-07 — the assessor's persisted portfolio-type selection (mirrors
  // `PropertyPortfolioType` in src/lib/assessment/v2/profiling.ts).
  portfolioType: z.enum(["RENTING", "SINGLE", "DOUBLE", "MULTIPLE"]).optional(),
});

export type PropertyAssetsRecordFormValues = z.infer<typeof propertyAssetsRecordSchema>;

// ─── DebtsRecord ────────────────────────────────────────────────────────────

export const debtsRecordSchema = z.object({
  creditCards: currencyField,
  loans: currencyField,
  leaseBalances: currencyField,
  schoolFeesOwedOrOther: currencyField,
});

export type DebtsRecordFormValues = z.infer<typeof debtsRecordSchema>;
