/**
 * One-off, idempotent backfill: normalise in-flight PARENTS_INCOME *drafts* from
 * the legacy flat income shape into the new status-driven shape (Epic 02 D3).
 *
 * The runtime form already normalises a legacy draft on load
 * (`normaliseLegacyIncomeRecord`), so the UI never crashes — this script is
 * belt-and-braces for shared environments: it rewrites the stored JSONB so a
 * draft is in the new shape even before the applicant reopens the form, and
 * flags the section incomplete so it re-validates under the new rules.
 *
 * SAFE BY DESIGN:
 *   - OFF by default — dry-run unless `--apply` is passed (writes nothing
 *     otherwise; prints what would change).
 *   - Only touches application_sections rows where section = 'PARENTS_INCOME'
 *     AND the application is still PRE_SUBMISSION (drafts). Submitted
 *     applications are immutable (Epic 01) and are NEVER rewritten.
 *   - Idempotent: a row already in the new shape (no legacy keys) is skipped.
 *   - Never deletes; only maps the unambiguous fields and re-derives `total`.
 *
 * Usage:
 *   tsx scripts/backfill-income-drafts.ts            # dry-run (default)
 *   tsx scripts/backfill-income-drafts.ts --apply    # write changes
 *   tsx scripts/backfill-income-drafts.ts --apply --keep-complete   # don't flip isComplete
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import {
  isLegacyIncomeRecord,
  normaliseLegacyIncomeRecord,
} from "../src/lib/portal/income-model";
import type { LegacyParentIncomeRecord } from "../src/types/application";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const KEEP_COMPLETE = args.includes("--keep-complete");

function normaliseRecord(rec: unknown): unknown {
  if (isLegacyIncomeRecord(rec)) {
    return normaliseLegacyIncomeRecord(rec as LegacyParentIncomeRecord);
  }
  return rec; // already new-shape (or absent) — leave as-is
}

async function main() {
  console.log(
    `\nIncome draft normalisation — ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}\n`
  );

  const rows = await prisma.applicationSection.findMany({
    where: {
      section: "PARENTS_INCOME",
      // Drafts only — never rewrite submitted (immutable) applications.
      application: { status: "PRE_SUBMISSION" },
    },
    select: {
      id: true,
      applicationId: true,
      data: true,
      isComplete: true,
    },
  });

  let changed = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = row.data as {
      parent1Income?: unknown;
      parent2Income?: unknown;
    } | null;
    if (!data || typeof data !== "object") {
      skipped++;
      continue;
    }

    const p1Legacy = isLegacyIncomeRecord(data.parent1Income);
    const p2Legacy = isLegacyIncomeRecord(data.parent2Income);
    if (!p1Legacy && !p2Legacy) {
      skipped++;
      continue; // idempotent — already new-shape
    }

    const next: Record<string, unknown> = {
      ...data,
      parent1Income: normaliseRecord(data.parent1Income),
    };
    if (data.parent2Income !== undefined) {
      next.parent2Income = normaliseRecord(data.parent2Income);
    }

    changed++;
    console.log(
      `  section ${row.id} (app ${row.applicationId}) — legacy → new` +
        (KEEP_COMPLETE ? "" : "; isComplete → false")
    );

    if (APPLY) {
      await prisma.applicationSection.update({
        where: { id: row.id },
        data: {
          data: next as object,
          // Flag incomplete so the form re-validates under the new rules,
          // unless explicitly told to keep the flag.
          ...(KEEP_COMPLETE ? {} : { isComplete: false }),
        },
      });
    }
  }

  console.log(
    `\nDone. ${changed} draft(s) ${APPLY ? "updated" : "would be updated"}, ${skipped} skipped (already new-shape or empty).`
  );
  if (!APPLY && changed > 0) {
    console.log("Re-run with --apply to write these changes.\n");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
