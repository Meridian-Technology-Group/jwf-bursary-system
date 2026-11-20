// src/app/api/cron/cleanup-orphan-uploads/route.ts
//
// Weekly sweep for orphaned uploads: objects in the `documents` bucket that no
// database row points at (an upload whose /confirm never arrived or 404'd, or
// a row deleted while its Storage remove failed). Retention reaches files only
// through rows, so without this they would escape the agreed retention and
// erasure rules. Rules for what counts as an orphan: lib/storage/orphan-uploads.ts.
//
// ── DESTRUCTIVE-OPERATION SAFETY (read before changing anything) ─────────────
//
//  1. REPORT-ONLY BY DEFAULT. Objects are removed ONLY when
//     `ORPHAN_UPLOAD_CLEANUP_ENABLED` is exactly "true". Otherwise the run
//     lists, plans and reports (counts + up to 20 redacted paths), writes one
//     summary audit row, and deletes nothing.
//  2. FAIL CLOSED. Any error loading the known paths ends the run with a 500
//     before anything is planned. An empty known-set, or orphans above
//     MAX_ORPHAN_FRACTION of the eligible objects, BLOCKS deletion for the run
//     (the signature of a database and a bucket from different projects — see
//     the 2026 prod env incident — or of a path-format change).
//  3. NARROW. Only `documents/{applicationId}[/secondary]/{slot}/{file}` objects
//     older than 24 h are candidates; migration (GRANT_TRACKER_*) folders are
//     not even listed; ledgered migration keys count as known.
//  4. RE-CHECKED. Each delete batch is looked up in the database again just
//     before the remove; any path that now has a row is kept.
//  5. BOUNDED. At most MAX_DELETES_PER_RUN removals, in batches of
//     DELETE_BATCH_SIZE through `deleteDocuments`; listing stops at
//     LIST_BUDGET_MS / MAX_LIST_REQUESTS and no batch starts after
//     RUN_BUDGET_MS. What is left waits for next week.
//  6. AUDITED. One ORPHAN_UPLOAD_CLEANUP_CRON row per run (append-only), with
//     counts and redacted paths — never a parent's filename.
//
// Schedule: vercel.json `crons`. Auth: `Authorization: Bearer ${CRON_SECRET}`,
// fail-closed.

import { NextRequest, NextResponse } from "next/server";
import { withAdminContext } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import { deleteDocuments } from "@/lib/storage/documents";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import {
  BUCKET,
  ORPHAN_MIN_AGE_MS,
  isMigrationSlotFolder,
  isOrphanUploadCleanupEnabled,
  listBucketObjects,
  loadKnownStoragePaths,
  normaliseStoragePath,
  planOrphanDeletion,
  redactStoragePath,
  type StorageLister,
} from "@/lib/storage/orphan-uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** No delete batch starts after this; 60s of headroom under maxDuration. */
const RUN_BUDGET_MS = 240_000;
/** Listing stops here, leaving time for the DB read, the deletes and the audit row. */
const LIST_BUDGET_MS = 180_000;
const MAX_LIST_REQUESTS = 10_000;
const MAX_LISTED_OBJECTS = 200_000;
const LIST_CONCURRENCY = 8;
/** Blast-radius ceiling per run; the rest wait for next week. */
const MAX_DELETES_PER_RUN = 500;
const DELETE_BATCH_SIZE = 100;
const SAMPLE_SIZE = 20;
/** Above this share of eligible objects, the run refuses to delete anything. */
const MAX_ORPHAN_FRACTION = 0.25;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const enabled = isOrphanUploadCleanupEnabled();

  try {
    // 1. Walk the bucket's `documents/` tree (migration folders skipped).
    const bucket = createSupabaseAdminClient().storage.from(BUCKET);
    const lister: StorageLister = { list: (path, options) => bucket.list(path, options) };
    const listing = await listBucketObjects(lister, {
      root: "documents",
      maxRequests: MAX_LIST_REQUESTS,
      maxObjects: MAX_LISTED_OBJECTS,
      concurrency: LIST_CONCURRENCY,
      shouldStop: () => Date.now() - startedAt >= LIST_BUDGET_MS,
      skipFolder: isMigrationSlotFolder,
    });

    // 2. Every path the database accounts for — read AFTER the walk, so a row
    //    written while we listed is still seen. Throws on failure (→ 500).
    const known = await withAdminContext((tx) => loadKnownStoragePaths(tx), { timeoutMs: 60_000 });

    // 3. Plan.
    const plan = planOrphanDeletion({ objects: listing.objects, knownPaths: known, now, minAgeMs: ORPHAN_MIN_AGE_MS });
    const sample = plan.orphans.slice(0, SAMPLE_SIZE).map((o) => redactStoragePath(o.name));

    let blocked: string | null = null;
    if (plan.orphans.length > 0 && known.size === 0) {
      blocked = "no-known-paths";
    } else if (plan.eligible > 0 && plan.orphans.length > MAX_ORPHAN_FRACTION * plan.eligible) {
      blocked = "orphan-fraction";
    }

    const report = {
      listed: listing.objects.length,
      listingComplete: listing.complete,
      listRequests: listing.requests,
      listErrors: listing.errors.length,
      skippedMigrationFolders: listing.skippedFolders,
      knownPaths: known.size,
      eligible: plan.eligible,
      kept: plan.kept,
      orphans: plan.orphans.length,
      sample,
      blocked,
    };

    // 4a. REPORT-ONLY (default): change nothing.
    if (!enabled) {
      console.info(
        `[cron/cleanup-orphan-uploads] REPORT-ONLY (ORPHAN_UPLOAD_CLEANUP_ENABLED!=true): ${plan.orphans.length} orphan(s)`,
        { ...report, listErrorDetail: listing.errors.slice(0, 5) },
      );
      await writeSummary(`Orphaned-upload sweep (report-only): ${plan.orphans.length} orphan(s) found, none deleted`, {
        mode: "report-only",
        ...report,
        deleted: 0,
        ranAt: now.toISOString(),
      });
      return NextResponse.json({ ok: true, mode: "report-only", ...report, deleted: 0, ranAt: now.toISOString() });
    }

    // 4b. ENABLED.
    let deleted = 0;
    let failed = 0;
    let keptOnRecheck = 0;
    let attempted = 0;
    const target = blocked ? [] : plan.orphans.slice(0, MAX_DELETES_PER_RUN);
    if (blocked) {
      console.warn(`[cron/cleanup-orphan-uploads] deletion BLOCKED (${blocked})`, report);
    }
    for (let i = 0; i < target.length; i += DELETE_BATCH_SIZE) {
      if (Date.now() - startedAt >= RUN_BUDGET_MS) break;
      const names = target.slice(i, i + DELETE_BATCH_SIZE).map((o) => o.name);
      attempted += names.length;
      const nowKnown = await withAdminContext((tx) => loadKnownStoragePaths(tx, names));
      const nowKnownNormalised = new Set(Array.from(nowKnown).map(normaliseStoragePath));
      const toDelete = names.filter((n) => !nowKnownNormalised.has(normaliseStoragePath(n)));
      keptOnRecheck += names.length - toDelete.length;
      if (toDelete.length === 0) continue;
      const failures = await deleteDocuments(toDelete);
      failed += failures.length;
      deleted += toDelete.length - failures.length;
    }
    const deferred = plan.orphans.length - attempted;

    await writeSummary(
      blocked
        ? `Orphaned-upload sweep: deletion blocked (${blocked}), ${plan.orphans.length} orphan(s) found`
        : `Orphaned-upload sweep: ${deleted} orphan(s) deleted`,
      { mode: "enabled", ...report, deleted, failed, keptOnRecheck, deferred, ranAt: now.toISOString() },
    );

    return NextResponse.json({
      ok: true,
      mode: "enabled",
      ...report,
      deleted,
      failed,
      keptOnRecheck,
      deferred,
      ranAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[cron/cleanup-orphan-uploads] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to run the orphaned-upload sweep" }, { status: 500 });
  }
}

async function writeSummary(context: string, metadata: Record<string, unknown>): Promise<void> {
  await withAdminContext((tx) =>
    createAuditLog(tx, {
      action: AUDIT_ACTIONS.ORPHAN_UPLOAD_CLEANUP_CRON,
      entityType: AUDIT_ENTITY_TYPES.Document,
      context,
      metadata,
    }),
  );
}
