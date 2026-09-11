// prisma/seed-reference.ts
// JWF Bursary Assessment System — reference-data seed
//
// Idempotent. Safe to run against any environment (local, staging, prod).
// Upserts only reference tables and ensures the `documents` storage bucket
// exists. Never deletes data. Never touches profiles, applications,
// assessments, or any user-generated content.
//
// Email templates are intentionally NOT seeded here — they are managed via
// migrations (see migration `*_seed_email_templates`). Single source of truth.
//
// Run via:
//   npm run seed:reference
//
// Required env:
//   DIRECT_URL (preferred) or DATABASE_URL — Prisma connection
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — for bucket creation

import "dotenv/config";
import { config } from "dotenv";
// override: false so explicit process.env vars (command line / CI secrets) win
// over .env.local. .env.local still fills gaps for plain local dev. This stops
// a nonprod .env.local from silently misrouting an explicit prod seed run.
config({ path: ".env.local", override: false });

import { PrismaClient, DebtSavingsContext, Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { councilTaxDefaults, familyTypeConfigs, schoolFees } from "./seed-data/reference";
import { reasonCodes } from "./seed-data/reason-codes";
import { gapReasons } from "./seed-data/gap-reasons";
import { closeReasons } from "./seed-data/close-reasons";
import {
  notionalCostConfigs,
  savingsCushionRespecConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  incomeCategoryBandsRespec,
  propertyEquityBands,
  financialEquityBands,
  financialEquityBandsRespec,
  debtRatioBands,
  debtRatioBandsRespec,
  debtRatioBandsPart5,
  lifestyleSqueezeBands,
  lifestyleSqueezeBandsRespec,
  lifestyleSqueezeBandsPart5,
  debtShortfallBands,
} from "./seed-data/profiling-reference";
import { postcodeAreas } from "./seed-data/postcode-areas";

// Eyeball-confirm the target before any writes. Print the project ref only
// (the URL subdomain), never the full URL or any secret.
const targetProjectRef =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ?? "unknown";
console.log(`[seed:reference] target Supabase project: ${targetProjectRef}`);

const seedDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({
  log: ["warn", "error"],
  datasources: seedDatabaseUrl ? { db: { url: seedDatabaseUrl } } : undefined,
});

/**
 * A Decimal column lookup value.
 *
 * `findFirst({ where: { ratioCeiling: 0.07 } })` MISSES the stored `0.0700`:
 * 0.07 has no exact binary representation, so the float Prisma sends does not
 * compare equal to the Decimal in the column. The seeder then falls through to
 * `create` and dies on the unique constraint, which is why
 * `npm run seed:reference` threw on any environment where the 7 Sep 2026 debt
 * band generation already existed — despite this script being documented as
 * idempotent and safe to run anywhere, production included.
 *
 * Routing the value through `Prisma.Decimal` compares exactly. Applied to every
 * Decimal key these findFirst lookups use, not just the row that happened to
 * expose it: 0.1, 0.3 and the rest round-trip today by luck, not by rule.
 */
function decimalKey(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

function log(message: string): void {
  console.log(`  ${message}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

async function seedFamilyTypeConfigs(): Promise<void> {
  section("Family type configs");
  for (const cfg of familyTypeConfigs) {
    await prisma.familyTypeConfig.upsert({
      where: { category_effectiveFrom: { category: cfg.category, effectiveFrom: cfg.effectiveFrom } },
      create: cfg,
      update: {
        description: cfg.description,
        notionalRent: cfg.notionalRent,
        utilityCosts: cfg.utilityCosts,
        foodCosts: cfg.foodCosts,
      },
    });
  }
  log(`Upserted ${familyTypeConfigs.length} family type configs`);
}

async function seedSchoolFees(): Promise<void> {
  section("School fees");
  for (const fee of schoolFees) {
    await prisma.schoolFees.upsert({
      where: { school_effectiveFrom: { school: fee.school, effectiveFrom: fee.effectiveFrom } },
      create: fee,
      update: { annualFees: fee.annualFees },
    });
  }
  log(`Upserted ${schoolFees.length} school fee records`);
}

async function seedCouncilTaxDefaults(): Promise<void> {
  section("Council tax defaults");
  // CouncilTaxDefault has no compound unique key — match on effectiveFrom + description.
  for (const ct of councilTaxDefaults) {
    const existing = await prisma.councilTaxDefault.findFirst({
      where: { effectiveFrom: ct.effectiveFrom, description: ct.description },
    });
    if (existing) {
      await prisma.councilTaxDefault.update({
        where: { id: existing.id },
        data: { amount: ct.amount },
      });
    } else {
      await prisma.councilTaxDefault.create({ data: ct });
    }
  }
  log(`Upserted ${councilTaxDefaults.length} council tax default(s)`);
}

async function seedReasonCodes(): Promise<void> {
  section("Reason codes");
  // CALC-09 (D4): the seed data marks the original 35 placeholders
  // `isDeprecated: true` and appends the client's definitive 36-code list
  // (codes 101-136). Update touches `isDeprecated` + `label` (not just
  // `sortOrder`) so a re-run against staging/prod deprecates the
  // placeholders in place without deleting/mutating the rows historic
  // recommendations still reference by ID.
  for (const rc of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { code: rc.code },
      create: rc,
      update: {
        label: rc.label,
        sortOrder: rc.sortOrder,
        isDeprecated: rc.isDeprecated,
      },
    });
  }
  log(`Upserted ${reasonCodes.length} reason codes`);
}

async function seedGapReasons(): Promise<void> {
  section("Gap reasons (CALC-02)");
  for (const gr of gapReasons) {
    await prisma.gapReason.upsert({
      where: { code: gr.code },
      create: gr,
      update: {
        label: gr.label,
        sortOrder: gr.sortOrder,
        isDeprecated: gr.isDeprecated,
      },
    });
  }
  log(`Upserted ${gapReasons.length} gap reasons`);
}

async function seedCloseReasons(): Promise<void> {
  section("Close reasons");
  // No numeric code like reason_codes — label is the natural key here, so
  // upsert matches on it (see close_reasons_label_key in the migration).
  for (const cr of closeReasons) {
    await prisma.closeReason.upsert({
      where: { label: cr.label },
      create: cr,
      update: {
        purgeOnClose: cr.purgeOnClose,
        sortOrder: cr.sortOrder,
      },
    });
  }
  log(`Upserted ${closeReasons.length} close reasons`);
}

async function seedNotionalCostConfigs(): Promise<void> {
  section("Notional cost configs (CALC-01)");
  for (const cfg of [...notionalCostConfigs, ...savingsCushionRespecConfigs]) {
    await prisma.notionalCostConfig.upsert({
      where: {
        category_costType_effectiveFrom: {
          category: cfg.category,
          costType: cfg.costType,
          effectiveFrom: cfg.effectiveFrom,
        },
      },
      create: cfg,
      update: { amount: cfg.amount },
    });
  }
  log(`Upserted ${notionalCostConfigs.length + savingsCushionRespecConfigs.length} notional cost configs`);
}

async function seedFamilyCategoryMetas(): Promise<void> {
  section("Family category metas (CALC-01)");
  for (const meta of familyCategoryMetas) {
    await prisma.familyCategoryMeta.upsert({
      where: { category_effectiveFrom: { category: meta.category, effectiveFrom: meta.effectiveFrom } },
      create: meta,
      update: {
        familyMembers: meta.familyMembers,
        schoolAgeChildren: meta.schoolAgeChildren,
        description: meta.description,
      },
    });
  }
  log(`Upserted ${familyCategoryMetas.length} family category metas`);
}

async function seedAffordabilityBands(): Promise<void> {
  section("Affordability bands (CALC-01)");
  // bandFloor is never null in this table — a real compound unique upsert works.
  for (const band of affordabilityBands) {
    await prisma.affordabilityBand.upsert({
      where: { bandFloor_effectiveFrom: { bandFloor: band.bandFloor, effectiveFrom: band.effectiveFrom } },
      create: band,
      update: { bandCeiling: band.bandCeiling, basePct: band.basePct },
    });
  }
  log(`Upserted ${affordabilityBands.length} affordability bands`);
}

// The remaining five band tables each have exactly one row with a NULL
// bandCeiling/ratioCeiling (the open-ended top band). Postgres treats NULLs
// as distinct in a unique index, so a compound-unique Prisma `upsert` can't
// reliably target that one row — same limitation `seedCouncilTaxDefaults`
// already works around above. findFirst + manual create/update sidesteps it
// (Prisma's `where` filter DOES translate `ceiling: null` to `IS NULL`
// correctly for a plain query, it's only upsert's underlying constraint match
// that's affected).

async function seedIncomeCategoryBands(): Promise<void> {
  section("Income category bands (CALC-01)");
  for (const band of [...incomeCategoryBands, ...incomeCategoryBandsRespec]) {
    const existing = await prisma.incomeCategoryBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: decimalKey(band.bandCeiling) },
    });
    if (existing) {
      await prisma.incomeCategoryBand.update({
        where: { id: existing.id },
        data: { bandFloor: band.bandFloor, category: band.category, feesBenchmarkPct: band.feesBenchmarkPct },
      });
    } else {
      await prisma.incomeCategoryBand.create({ data: band });
    }
  }
  log(`Upserted ${incomeCategoryBands.length + incomeCategoryBandsRespec.length} income category bands`);
}

async function seedPropertyEquityBands(): Promise<void> {
  section("Property equity bands (CALC-01)");
  for (const band of propertyEquityBands) {
    const existing = await prisma.propertyEquityBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: decimalKey(band.bandCeiling) },
    });
    if (existing) {
      await prisma.propertyEquityBand.update({
        where: { id: existing.id },
        data: { bandFloor: band.bandFloor, category: band.category },
      });
    } else {
      await prisma.propertyEquityBand.create({ data: band });
    }
  }
  log(`Upserted ${propertyEquityBands.length} property equity bands`);
}

async function seedPostcodeAreas(): Promise<void> {
  section("Postcode areas (CH-43)");
  for (const row of postcodeAreas) {
    // `district` is unique, so a plain upsert is safe here — unlike the band
    // tables, whose natural key is (effectiveFrom, ceiling) and needs findFirst.
    await prisma.postcodeArea.upsert({
      where: { district: row.district },
      update: { area: row.area },
      create: { district: row.district, area: row.area },
    });
  }
  log(`Upserted ${postcodeAreas.length} postcode areas`);
}

async function seedFinancialEquityBands(): Promise<void> {
  section("Financial equity bands (CALC-01)");
  for (const band of [...financialEquityBands, ...financialEquityBandsRespec]) {
    const existing = await prisma.financialEquityBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: decimalKey(band.bandCeiling) },
    });
    if (existing) {
      await prisma.financialEquityBand.update({
        where: { id: existing.id },
        data: { bandFloor: band.bandFloor, label: band.label },
      });
    } else {
      await prisma.financialEquityBand.create({ data: band });
    }
  }
  log(`Upserted ${financialEquityBands.length + financialEquityBandsRespec.length} financial equity bands`);
}

async function seedDebtRatioBands(): Promise<void> {
  section("Debt ratio bands (CALC-01)");
  // `debtSavingsContext` is part of the identity lookup from the 8 Sep 2026 Part 5
  // respec onward — without it the two variants of a generation share a
  // (effectiveFrom, ratioCeiling) key and later ones silently overwrite earlier
  // ones. Generations seeded before the split carry no context and default to
  // DEBT_SAVINGS_BELOW_DEBT.
  const bands = [
    ...debtRatioBands,
    ...debtRatioBandsRespec,
    ...debtRatioBandsPart5,
  ];
  for (const band of bands) {
    const debtSavingsContext =
      "debtSavingsContext" in band
        ? band.debtSavingsContext
        : DebtSavingsContext.DEBT_SAVINGS_BELOW_DEBT;
    const existing = await prisma.debtRatioBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, ratioCeiling: decimalKey(band.ratioCeiling), debtSavingsContext },
    });
    if (existing) {
      await prisma.debtRatioBand.update({
        where: { id: existing.id },
        data: {
          ratioFloor: band.ratioFloor,
          minRepaymentMonths: band.minRepaymentMonths,
          statusLabel: band.statusLabel,
        },
      });
    } else {
      await prisma.debtRatioBand.create({ data: { ...band, debtSavingsContext } });
    }
  }
  log(`Upserted ${bands.length} debt ratio bands`);
}

async function seedDebtShortfallBands(): Promise<void> {
  section("Debt shortfall bands (Charlotte, 11 Sep 2026)");
  for (const band of debtShortfallBands) {
    const existing = await prisma.debtShortfallBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, ceilingGbp: decimalKey(band.ceilingGbp) },
    });
    if (existing) {
      await prisma.debtShortfallBand.update({
        where: { id: existing.id },
        data: { floorGbp: band.floorGbp, statusLabel: band.statusLabel },
      });
    } else {
      await prisma.debtShortfallBand.create({ data: band });
    }
  }
  log(`Upserted ${debtShortfallBands.length} debt shortfall bands`);
}

async function seedLifestyleSqueezeBands(): Promise<void> {
  section("Lifestyle squeeze bands (CALC-01)");
  // See seedDebtRatioBands — `debtSavingsContext` is part of the identity lookup.
  const bands = [
    ...lifestyleSqueezeBands,
    ...lifestyleSqueezeBandsRespec,
    ...lifestyleSqueezeBandsPart5,
  ];
  for (const band of bands) {
    const debtSavingsContext =
      "debtSavingsContext" in band
        ? band.debtSavingsContext
        : DebtSavingsContext.DEBT_SAVINGS_BELOW_DEBT;
    const existing = await prisma.lifestyleSqueezeBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, ratioCeiling: decimalKey(band.ratioCeiling), debtSavingsContext },
    });
    if (existing) {
      await prisma.lifestyleSqueezeBand.update({
        where: { id: existing.id },
        data: { ratioFloor: band.ratioFloor, statusLabel: band.statusLabel },
      });
    } else {
      await prisma.lifestyleSqueezeBand.create({ data: { ...band, debtSavingsContext } });
    }
  }
  log(`Upserted ${bands.length} lifestyle squeeze bands`);
}

async function ensureDocumentsBucket(): Promise<void> {
  section("Storage: documents bucket");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log("⚠ Skipping bucket check — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return;
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existing } = await supabase.storage.getBucket("documents");
  if (existing) {
    log(`Bucket "documents" already exists (public=${existing.public})`);
    return;
  }
  const { error } = await supabase.storage.createBucket("documents", { public: false });
  if (error) throw new Error(`Failed to create documents bucket: ${error.message}`);
  log("Created private bucket: documents");
}

async function printSummary(): Promise<void> {
  section("Summary");
  const rows: Array<[string, number]> = [
    ["Family type configs", await prisma.familyTypeConfig.count()],
    ["School fee records", await prisma.schoolFees.count()],
    ["Council tax defaults", await prisma.councilTaxDefault.count()],
    ["Reason codes", await prisma.reasonCode.count()],
    ["Gap reasons", await prisma.gapReason.count()],
    ["Close reasons", await prisma.closeReason.count()],
    ["Email templates (migration-managed)", await prisma.emailTemplate.count()],
    ["Notional cost configs", await prisma.notionalCostConfig.count()],
    ["Family category metas", await prisma.familyCategoryMeta.count()],
    ["Affordability bands", await prisma.affordabilityBand.count()],
    ["Income category bands", await prisma.incomeCategoryBand.count()],
    ["Property equity bands", await prisma.propertyEquityBand.count()],
    ["Financial equity bands", await prisma.financialEquityBand.count()],
    ["Postcode areas", await prisma.postcodeArea.count()],
    ["Debt ratio bands", await prisma.debtRatioBand.count()],
    ["Debt shortfall bands", await prisma.debtShortfallBand.count()],
    ["Lifestyle squeeze bands", await prisma.lifestyleSqueezeBand.count()],
  ];
  console.log("");
  for (const [label, count] of rows) {
    console.log(`  ${label.padEnd(38)} ${String(count).padStart(3)}`);
  }
}

async function main(): Promise<void> {
  console.log("\nJWF Bursary Assessment System — reference seed (idempotent)");
  console.log("=".repeat(60));

  await seedFamilyTypeConfigs();
  await seedSchoolFees();
  await seedCouncilTaxDefaults();
  await seedReasonCodes();
  await seedGapReasons();
  await seedCloseReasons();
  await seedNotionalCostConfigs();
  await seedFamilyCategoryMetas();
  await seedAffordabilityBands();
  await seedIncomeCategoryBands();
  await seedPropertyEquityBands();
  await seedFinancialEquityBands();
  await seedPostcodeAreas();
  await seedDebtRatioBands();
  await seedLifestyleSqueezeBands();
  await seedDebtShortfallBands();
  await ensureDocumentsBucket();
  await printSummary();

  console.log("\n  Reference seed completed successfully.\n");
}

main()
  .catch((err: unknown) => {
    console.error("\nReference seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
