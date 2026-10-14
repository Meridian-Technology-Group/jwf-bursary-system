/**
 * Backfill the account Main synopsis (Epic 21 R1) for accounts locked before
 * #447 reached their database.
 *
 * The Main synopsis is seeded at an account's FIRST award lock. On prod, two
 * accounts (TS-WILL05, TS-EMIN01, 2026/27 NEW_AWARD) were locked before the
 * feature existed, so their Main synopsis would be blank. This writes, for each
 * such account, what the lock path would have written: the earliest locked
 * year's synopsis (see `backfill-main-synopsis-core.ts`).
 *
 * - DRY RUN by default. `--apply` writes, and requires `--project <ref>`
 *   matching the Supabase project the DATABASE_URL points at.
 * - Idempotent: an account that already has a Main synopsis is skipped, and
 *   the one-MAIN-per-account index makes a concurrent write a no-op.
 * - Migrated (Grant Tracker) accounts are skipped: the toolkit owns theirs.
 * - Each write is audited (ACCOUNT_MAIN_SYNOPSIS_SAVED against the
 *   BursaryAccount, lengths only, no prose), in the same transaction.
 * - Prints application references and account ids only, never names or text.
 *
 * Usage:
 *   npm run backfill:main-synopsis -- [--ref <applicationReference> ...]
 *   npm run backfill:main-synopsis -- --apply --project <ref> [--ref ...]
 *
 * Env: DATABASE_URL already in the shell wins; otherwise `.env.local`, then
 * `.env` (both point at nonprod). To target prod, export prod's DATABASE_URL
 * for that one command. Prod requires Brian's go-ahead and runs only AFTER the
 * staging → main promotion that carries #447 (the table and the MAIN kind
 * must exist there).
 */

import { config } from "dotenv";
// No `override`: a DATABASE_URL exported for this command must win.
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient, Prisma } from "@prisma/client";
import { seedMainSynopsisAtLock } from "../src/lib/bursary-accounts/standing-synopsis";
import { createAuditLog } from "../src/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../src/lib/audit/actions";
import {
  decideSeed,
  supabaseProjectRef,
  type CandidateAccount,
  type SeedDecision,
} from "./backfill-main-synopsis-core";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const projectIdx = args.indexOf("--project");
const EXPECT_PROJECT = projectIdx >= 0 ? args[projectIdx + 1] : null;
const REFS = args.flatMap((a, i) => (a === "--ref" && args[i + 1] ? [args[i + 1]] : []));

const prisma = new PrismaClient({ log: ["warn", "error"] });

/** Runs `fn` with the service_role claim (RLS bypass), as `withAdminContext` does. */
async function asServiceRole<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT set_config(
          'request.jwt.claims',
          jsonb_build_object('role', 'service_role'::text)::text,
          true
        )
      `;
      return fn(tx);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

async function loadCandidates(tx: Prisma.TransactionClient): Promise<CandidateAccount[]> {
  const accounts = await tx.bursaryAccount.findMany({
    where: REFS.length ? { applications: { some: { reference: { in: REFS } } } } : {},
    select: {
      id: true,
      synopsisEntries: { where: { kind: "MAIN" }, select: { id: true } },
      applications: {
        select: {
          id: true,
          reference: true,
          migrationSource: true,
          round: { select: { academicYear: true } },
          assessment: { select: { id: true, status: true, synopsis: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map((a) => ({
    id: a.id,
    hasMain: a.synopsisEntries.length > 0,
    applications: a.applications.map((app) => ({
      id: app.id,
      reference: app.reference,
      migrationSource: app.migrationSource,
      academicYear: app.round.academicYear,
      assessment: app.assessment,
    })),
  }));
}

function line(d: SeedDecision): string {
  const ref = d.reference ?? "(no reference)";
  if (d.action === "SEED") {
    return `  SEED  ${ref.padEnd(12)} account ${d.accountId}  from ${d.academicYear} assessment ${d.assessmentId} (${d.body.length} chars)`;
  }
  return `  skip  ${ref.padEnd(12)} account ${d.accountId}  ${d.reason}`;
}

async function main() {
  const ref = supabaseProjectRef(process.env.DATABASE_URL);
  console.log(`Backfill Main synopsis — ${APPLY ? "APPLY" : "dry run"} — project ${ref ?? "(unknown)"}`);
  if (REFS.length) console.log(`  restricted to references: ${REFS.join(", ")}`);

  if (APPLY) {
    if (!EXPECT_PROJECT) throw new Error("--apply needs --project <ref> (the Supabase project you mean to write to).");
    if (ref !== EXPECT_PROJECT) {
      throw new Error(`DATABASE_URL points at project ${ref ?? "(unknown)"}, not ${EXPECT_PROJECT}. Nothing written.`);
    }
  }

  const decisions = await asServiceRole(async (tx) => (await loadCandidates(tx)).map(decideSeed));
  const toSeed = decisions.filter((d): d is Extract<SeedDecision, { action: "SEED" }> => d.action === "SEED");
  const skips = decisions.filter((d) => d.action === "SKIP");

  for (const d of toSeed) console.log(line(d));
  const skipCounts = skips.reduce<Record<string, number>>((acc, d) => {
    if (d.action === "SKIP") acc[d.reason] = (acc[d.reason] ?? 0) + 1;
    return acc;
  }, {});
  // Skipped accounts listed only when restricted (prod has a few; migrated envs have hundreds).
  if (REFS.length) for (const d of skips) console.log(line(d));
  console.log(`  ${toSeed.length} to seed; skipped: ${JSON.stringify(skipCounts)}`);

  if (!APPLY) {
    console.log("Dry run: nothing written. Re-run with --apply --project <ref> to write.");
    return;
  }

  let written = 0;
  for (const d of toSeed) {
    // One transaction per account: the seed and its audit row commit together.
    const wrote = await asServiceRole(async (tx) => {
      const ok = await seedMainSynopsisAtLock(tx, { bursaryAccountId: d.accountId, synopsis: d.body, userId: null });
      if (ok) {
        await createAuditLog(tx, {
          // No userId: a system write (createAuditLog stores NULL).
          action: AUDIT_ACTIONS.ACCOUNT_MAIN_SYNOPSIS_SAVED,
          entityType: AUDIT_ENTITY_TYPES.BursaryAccount,
          entityId: d.accountId,
          context: `Main synopsis seeded from the ${d.academicYear} synopsis (backfill)`,
          metadata: {
            source: "backfill-main-synopsis",
            applicationId: d.applicationId,
            assessmentId: d.assessmentId,
            previousLength: 0,
            length: d.body.length,
          },
        });
      }
      return ok;
    });
    console.log(`  ${wrote ? "written" : "already had one (skipped)"}  ${d.reference ?? d.accountId}`);
    if (wrote) written++;
  }
  console.log(`Done: ${written} written.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
