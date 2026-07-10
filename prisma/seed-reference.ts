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

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { councilTaxDefaults, familyTypeConfigs, schoolFees } from "./seed-data/reference";
import { reasonCodes } from "./seed-data/reason-codes";
import { closeReasons } from "./seed-data/close-reasons";
import {
  notionalCostConfigs,
  familyCategoryMetas,
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
} from "./seed-data/profiling-reference";

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
  for (const rc of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { code: rc.code },
      create: rc,
      update: {
        label: rc.label,
        sortOrder: rc.sortOrder,
      },
    });
  }
  log(`Upserted ${reasonCodes.length} reason codes`);
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
  for (const cfg of notionalCostConfigs) {
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
  log(`Upserted ${notionalCostConfigs.length} notional cost configs`);
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
  for (const band of incomeCategoryBands) {
    const existing = await prisma.incomeCategoryBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: band.bandCeiling },
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
  log(`Upserted ${incomeCategoryBands.length} income category bands`);
}

async function seedPropertyEquityBands(): Promise<void> {
  section("Property equity bands (CALC-01)");
  for (const band of propertyEquityBands) {
    const existing = await prisma.propertyEquityBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: band.bandCeiling },
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

async function seedFinancialEquityBands(): Promise<void> {
  section("Financial equity bands (CALC-01)");
  for (const band of financialEquityBands) {
    const existing = await prisma.financialEquityBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, bandCeiling: band.bandCeiling },
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
  log(`Upserted ${financialEquityBands.length} financial equity bands`);
}

async function seedDebtRatioBands(): Promise<void> {
  section("Debt ratio bands (CALC-01)");
  for (const band of debtRatioBands) {
    const existing = await prisma.debtRatioBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, ratioCeiling: band.ratioCeiling },
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
      await prisma.debtRatioBand.create({ data: band });
    }
  }
  log(`Upserted ${debtRatioBands.length} debt ratio bands`);
}

async function seedLifestyleSqueezeBands(): Promise<void> {
  section("Lifestyle squeeze bands (CALC-01)");
  for (const band of lifestyleSqueezeBands) {
    const existing = await prisma.lifestyleSqueezeBand.findFirst({
      where: { effectiveFrom: band.effectiveFrom, ratioCeiling: band.ratioCeiling },
    });
    if (existing) {
      await prisma.lifestyleSqueezeBand.update({
        where: { id: existing.id },
        data: { ratioFloor: band.ratioFloor, statusLabel: band.statusLabel },
      });
    } else {
      await prisma.lifestyleSqueezeBand.create({ data: band });
    }
  }
  log(`Upserted ${lifestyleSqueezeBands.length} lifestyle squeeze bands`);
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
    ["Close reasons", await prisma.closeReason.count()],
    ["Email templates (migration-managed)", await prisma.emailTemplate.count()],
    ["Notional cost configs", await prisma.notionalCostConfig.count()],
    ["Family category metas", await prisma.familyCategoryMeta.count()],
    ["Affordability bands", await prisma.affordabilityBand.count()],
    ["Income category bands", await prisma.incomeCategoryBand.count()],
    ["Property equity bands", await prisma.propertyEquityBand.count()],
    ["Financial equity bands", await prisma.financialEquityBand.count()],
    ["Debt ratio bands", await prisma.debtRatioBand.count()],
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
  await seedCloseReasons();
  await seedNotionalCostConfigs();
  await seedFamilyCategoryMetas();
  await seedAffordabilityBands();
  await seedIncomeCategoryBands();
  await seedPropertyEquityBands();
  await seedFinancialEquityBands();
  await seedDebtRatioBands();
  await seedLifestyleSqueezeBands();
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
