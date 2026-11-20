/**
 * Orphaned-upload clean-up — the pieces behind
 * `/api/cron/cleanup-orphan-uploads`.
 *
 * An orphan is an object in the `documents` bucket that no database row
 * points at. They arise when the browser uploads to a signed URL but
 * `/api/documents/confirm` never arrives (or 404s), or when a row is deleted
 * and the Storage remove that follows it fails (`deleteDocument(s)` only log).
 * Retention reaches files only through `Document` rows, so an orphan would
 * otherwise outlive every retention and erasure rule.
 *
 * These are parents' financial documents: a wrong delete is unrecoverable.
 * Every rule below therefore errs towards KEEPING an object:
 *
 *  - Only paths in the app's own shape are eligible
 *    (`documents/{applicationId}[/secondary]/{slot}/{file}`). Anything else in
 *    the bucket came from a writer this module does not know and is kept.
 *  - Grant Tracker migration objects (slot `GRANT_TRACKER_*`) are kept: the
 *    migration toolkit owns them through `data_migration_ledger` and its own
 *    rollback, and it uploads BEFORE it writes the rows.
 *  - Any key in `data_migration_ledger` (entity type `StorageObject`, any
 *    state) counts as known.
 *  - An object younger than `minAgeMs` (24 h, against a 30-minute upload
 *    ticket) is kept, so an in-flight upload is never touched. An object whose
 *    age cannot be read is kept.
 *  - Paths are normalised on BOTH sides before comparing (leading slashes,
 *    doubled slashes, surrounding whitespace), which can only produce more
 *    matches — i.e. keep more — never fewer.
 *
 * The route adds run-level guards (empty known-set, orphan fraction, re-check
 * before delete) on top of this.
 */

import type { Tx } from "@/lib/db/prisma";

export const BUCKET = "documents";

/** 24 hours — far beyond the 30-minute upload ticket (`upload-ticket.ts`). */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** The migration toolkit's slot prefix (`scripts/gt-migration/load/documents.ts`). */
export const MIGRATION_SLOT_PREFIX = "GRANT_TRACKER_";

/** Supabase writes these when a folder is created in the dashboard. */
const PLACEHOLDER_NAME = ".emptyFolderPlaceholder";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** `documents/{applicationId}[/secondary]/{slot}/{file}` — see `buildStoragePath`. */
const APP_UPLOAD_PATH = new RegExp(`^documents/${UUID}/(?:secondary/)?([^/]+)/([^/]+)$`, "i");

/** Deletion runs only when this is exactly "true" (unset = report-only). */
export function isOrphanUploadCleanupEnabled(): boolean {
  return process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED === "true";
}

export interface StoredObject {
  /** Full object key inside the bucket, exactly as Storage reported it. */
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export type KeepReason =
  | "known"
  | "too-recent"
  | "unknown-age"
  | "unrecognised-path"
  | "migration-object"
  | "placeholder";

export interface OrphanPlan {
  /** Objects to delete — original names, as listed. */
  orphans: StoredObject[];
  /** Objects whose path is in the app's upload shape (the fraction guard's denominator). */
  eligible: number;
  kept: Record<KeepReason, number>;
}

export function normaliseStoragePath(path: string): string {
  return path.trim().replace(/\/{2,}/g, "/").replace(/^\/+/, "");
}

function ageMs(obj: StoredObject, now: Date): number | null {
  const stamps = [obj.createdAt, obj.updatedAt]
    .map((s) => (s ? Date.parse(s) : NaN))
    .filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return null;
  // The most recent write is what counts: an object touched an hour ago is
  // an hour old, whatever its creation date says.
  return now.getTime() - Math.max(...stamps);
}

/**
 * Pure: which listed objects are orphans old enough to delete. Never touches
 * Storage or the database.
 */
export function planOrphanDeletion(input: {
  objects: readonly StoredObject[];
  knownPaths: Iterable<string>;
  now: Date;
  minAgeMs: number;
}): OrphanPlan {
  const known = new Set<string>();
  for (const p of Array.from(input.knownPaths)) known.add(normaliseStoragePath(p));

  const kept: Record<KeepReason, number> = {
    known: 0,
    "too-recent": 0,
    "unknown-age": 0,
    "unrecognised-path": 0,
    "migration-object": 0,
    placeholder: 0,
  };
  const orphans: StoredObject[] = [];
  let eligible = 0;

  for (const obj of input.objects) {
    const path = normaliseStoragePath(obj.name);
    const match = APP_UPLOAD_PATH.exec(path);
    if (!match) {
      kept["unrecognised-path"] += 1;
      continue;
    }
    const [, slot, file] = match;
    if (file === PLACEHOLDER_NAME) {
      kept.placeholder += 1;
      continue;
    }
    if (slot.toUpperCase().startsWith(MIGRATION_SLOT_PREFIX)) {
      kept["migration-object"] += 1;
      continue;
    }
    eligible += 1;
    if (known.has(path)) {
      kept.known += 1;
      continue;
    }
    const age = ageMs(obj, input.now);
    if (age === null) {
      kept["unknown-age"] += 1;
      continue;
    }
    if (age < input.minAgeMs) {
      kept["too-recent"] += 1;
      continue;
    }
    orphans.push(obj);
  }

  return { orphans, eligible, kept };
}

/**
 * A path safe to print in a log, a response or an audit row: the ids are
 * kept so the object can be found in the bucket, the parent's filename is
 * not (it can carry a name — audit rows outlive the files they describe).
 */
export function redactStoragePath(path: string): string {
  const parts = path.split("/");
  const last = parts.pop() ?? "";
  const cut = last.indexOf("_");
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(last)?.[1];
  const redacted = cut > 0 ? `${last.slice(0, cut)}_…${ext ? `.${ext}` : ""}` : "…";
  return [...parts, redacted].join("/");
}

// ─── Listing ─────────────────────────────────────────────────────────────────

/** The one Storage call the lister needs — a narrow seam for test fakes. */
export interface StorageLister {
  list(
    path: string,
    options: { limit: number; offset: number; sortBy: { column: string; order: string } },
  ): Promise<{
    data: { name: string; id: string | null; created_at?: string | null; updated_at?: string | null }[] | null;
    error: { message: string } | null;
  }>;
}

export const LIST_PAGE_SIZE = 1000;

export interface ListResult {
  objects: StoredObject[];
  /** False when a cap or the budget stopped the walk, or a folder failed to list. */
  complete: boolean;
  requests: number;
  /** Folders deliberately not descended into (see `skipFolder`). */
  skippedFolders: number;
  errors: { folder: string; message: string }[];
}

export interface ListOptions {
  /** Folder to start from; nothing outside it is ever listed (or deleted). */
  root: string;
  maxRequests: number;
  maxObjects: number;
  /** Folders listed at once. */
  concurrency: number;
  /** Checked before every request; true ends the walk (incomplete). */
  shouldStop: () => boolean;
  /** A folder for which this returns true is neither listed nor descended into. */
  skipFolder?: (path: string) => boolean;
}

/**
 * Walks the bucket from `root`, one folder at a time (`list` is not
 * recursive), level by level with `concurrency` folders in flight, paging
 * each folder with limit/offset until a short page. Folders are the entries
 * with a null `id`. Stops — and says so — at `maxRequests`, `maxObjects` or
 * when `shouldStop()` turns true. A folder that fails to list is recorded and
 * skipped. An object never listed is never deleted, so a partial walk is
 * safe, just incomplete.
 */
export async function listBucketObjects(storage: StorageLister, opts: ListOptions): Promise<ListResult> {
  const objects: StoredObject[] = [];
  const errors: { folder: string; message: string }[] = [];
  let requests = 0;
  let skippedFolders = 0;
  let stopped = false;

  const capped = () => requests >= opts.maxRequests || objects.length >= opts.maxObjects || opts.shouldStop();

  async function listFolder(folder: string, subfolders: string[]): Promise<void> {
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      if (stopped || capped()) {
        stopped = true;
        return;
      }
      requests += 1;
      let page: Awaited<ReturnType<StorageLister["list"]>>;
      try {
        page = await storage.list(folder, { limit: LIST_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      } catch (err) {
        page = { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
      }
      if (page.error || !page.data) {
        errors.push({ folder, message: page.error?.message ?? "no data" });
        return;
      }
      for (const entry of page.data) {
        const full = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id === null || entry.id === undefined) {
          if (opts.skipFolder?.(full)) skippedFolders += 1;
          else subfolders.push(full);
        } else {
          objects.push({ name: full, createdAt: entry.created_at ?? null, updatedAt: entry.updated_at ?? null });
        }
      }
      if (page.data.length < LIST_PAGE_SIZE) return;
    }
  }

  let level: string[] = [opts.root];
  while (level.length > 0 && !stopped) {
    const next: string[] = [];
    let i = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(opts.concurrency, level.length)) }, async () => {
      while (i < level.length && !stopped) {
        const folder = level[i++];
        await listFolder(folder, next);
      }
    });
    await Promise.all(workers);
    level = next;
  }

  return { objects, complete: !stopped && errors.length === 0, requests, skippedFolders, errors };
}

/** A migration-owned slot folder: `documents/{appId}[/secondary]/GRANT_TRACKER_*`. */
export function isMigrationSlotFolder(path: string): boolean {
  const last = path.split("/").pop() ?? "";
  return last.toUpperCase().startsWith(MIGRATION_SLOT_PREFIX);
}

// ─── Known paths ─────────────────────────────────────────────────────────────

/**
 * Every storage key the database accounts for: each `Document.storagePath`
 * and each `StorageObject` key the migration ledger holds (any state). Run
 * inside `withAdminContext`. A failure throws — the caller must never plan
 * against a partial known-set. With `only`, looks up just those paths (the
 * route's last check before a delete batch).
 */
export async function loadKnownStoragePaths(tx: Tx, only?: readonly string[]): Promise<Set<string>> {
  // Re-check mode: look each path up under every spelling normalisation
  // would equate it with.
  const variants = only
    ? Array.from(new Set(only.flatMap((p) => [p, normaliseStoragePath(p), `/${normaliseStoragePath(p)}`])))
    : undefined;
  const documents = await tx.document.findMany({
    where: variants ? { storagePath: { in: variants } } : undefined,
    select: { storagePath: true },
  });
  const ledger = await tx.dataMigrationLedger.findMany({
    where: variants ? { entityType: "StorageObject", entityId: { in: variants } } : { entityType: "StorageObject" },
    select: { entityId: true },
  });
  const known = new Set<string>();
  for (const d of documents) known.add(d.storagePath);
  for (const l of ledger) known.add(l.entityId);
  return known;
}
