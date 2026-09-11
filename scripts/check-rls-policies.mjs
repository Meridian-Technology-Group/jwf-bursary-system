#!/usr/bin/env node
/**
 * Fails if any public table has row level security enabled but NO policies.
 *
 * That combination does not error at runtime: it silently returns zero rows to
 * app_user. On 12 Sep 2026 it took the entire v2 assessment surface down — a
 * new reference table (`debt_shortfall_bands`) shipped without policies, the
 * reference bundle read it as empty, and every assessment refused to calculate
 * with "Missing: Debt shortfall bands".
 *
 * This repo has an `ensure_rls` event trigger that force-enables RLS on every
 * new public table, and the convention is for policies to arrive in a
 * follow-up migration. So the gap is real and invisible until something reads
 * the table. A static check over migration SQL cannot see it; only the
 * database can.
 *
 * Run after `prisma migrate deploy`. Uses DIRECT_URL so it can read catalogue
 * views regardless of RLS.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      -- Prisma's own ledger. Never read through app_user, so policies would
      -- serve no purpose.
      AND c.relname <> '_prisma_migrations'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      )
    ORDER BY c.relname
  `);

  if (rows.length > 0) {
    console.error("Tables with RLS enabled and NO policies (they read as empty):\n");
    for (const r of rows) console.error(`  - ${r.table_name}`);
    console.error("\nAdd policies for each, mirroring a comparable table.");
    process.exitCode = 1;
  } else {
    console.log("RLS: every protected table has at least one policy");
  }
} finally {
  await prisma.$disconnect();
}
