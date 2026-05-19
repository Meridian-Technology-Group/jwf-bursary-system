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
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { councilTaxDefaults, familyTypeConfigs, schoolFees } from "./seed-data/reference";
import { reasonCodes } from "./seed-data/reason-codes";

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
    ["Email templates (migration-managed)", await prisma.emailTemplate.count()],
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
