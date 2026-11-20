/**
 * Orphaned-upload sweep — the pure planner, the bucket walk and the
 * known-path loader. These are parents' financial documents, so most cases
 * here prove something is KEPT.
 */
import { describe, expect, it } from "vitest";
import {
  ORPHAN_MIN_AGE_MS,
  isMigrationSlotFolder,
  isOrphanUploadCleanupEnabled,
  listBucketObjects,
  loadKnownStoragePaths,
  normaliseStoragePath,
  planOrphanDeletion,
  redactStoragePath,
  type StoredObject,
} from "../orphan-uploads";
import { APP_A, APP_B, fakeBucket } from "./fake-bucket";
import type { Tx } from "@/lib/db/prisma";

const NOW = new Date("2026-11-20T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const obj = (name: string, ageMs = 48 * HOUR, updatedAgeMs?: number): StoredObject => ({
  name,
  createdAt: ago(ageMs),
  updatedAt: updatedAgeMs === undefined ? ago(ageMs) : ago(updatedAgeMs),
});
const plan = (objects: StoredObject[], knownPaths: string[] = []) =>
  planOrphanDeletion({ objects, knownPaths, now: NOW, minAgeMs: ORPHAN_MIN_AGE_MS });

const P = (file: string, slot = "BANK_STATEMENT", app = APP_A) => `documents/${app}/${slot}/${file}`;

describe("planOrphanDeletion", () => {
  it("selects an old object with no row", () => {
    const p = plan([obj(P("u1_statement.pdf"))]);
    expect(p.orphans.map((o) => o.name)).toEqual([P("u1_statement.pdf")]);
    expect(p.eligible).toBe(1);
  });

  it("keeps an object a row points at", () => {
    const p = plan([obj(P("u1_a.pdf"))], [P("u1_a.pdf")]);
    expect(p.orphans).toEqual([]);
    expect(p.kept.known).toBe(1);
  });

  it("keeps an in-flight upload (younger than 24 h), even one a ticket has long since expired for", () => {
    const p = plan([obj(P("u1_a.pdf"), 31 * 60 * 1000), obj(P("u2_b.pdf"), 23 * HOUR)]);
    expect(p.orphans).toEqual([]);
    expect(p.kept["too-recent"]).toBe(2);
  });

  it("judges age by the most recent write: an old object updated an hour ago is kept", () => {
    const p = plan([obj(P("u1_a.pdf"), 30 * 24 * HOUR, 1 * HOUR)]);
    expect(p.orphans).toEqual([]);
    expect(p.kept["too-recent"]).toBe(1);
  });

  it("selects at exactly the minimum age, keeps a millisecond under it", () => {
    const p = plan([obj(P("u1_a.pdf"), ORPHAN_MIN_AGE_MS), obj(P("u2_b.pdf"), ORPHAN_MIN_AGE_MS - 1)]);
    expect(p.orphans.map((o) => o.name)).toEqual([P("u1_a.pdf")]);
  });

  it("keeps an object whose age cannot be read, and one stamped in the future", () => {
    const p = plan([
      { name: P("u1_a.pdf"), createdAt: null, updatedAt: null },
      { name: P("u2_b.pdf"), createdAt: "not a date", updatedAt: null },
      obj(P("u3_c.pdf"), -2 * HOUR),
    ]);
    expect(p.orphans).toEqual([]);
    expect(p.kept["unknown-age"]).toBe(2);
    expect(p.kept["too-recent"]).toBe(1);
  });

  it("normalises paths on both sides: leading and doubled slashes, whitespace", () => {
    const p = plan(
      [obj(`/${P("u1_a.pdf")}`), obj(P("u2_b.pdf")), obj(P("u3_c.pdf").replace("/BANK", "//BANK"))],
      [P("u1_a.pdf"), `//${P("u2_b.pdf")}`, ` ${P("u3_c.pdf")} `],
    );
    expect(p.orphans).toEqual([]);
    expect(p.kept.known).toBe(3);
  });

  it("returns the object's original name for deletion, not the normalised one", () => {
    const p = plan([obj(`/${P("u1_a.pdf")}`)]);
    expect(p.orphans.map((o) => o.name)).toEqual([`/${P("u1_a.pdf")}`]);
  });

  it("treats the secondary contributor's namespace as eligible", () => {
    const secondary = `documents/${APP_B}/secondary/PAYSLIP/u1_p.pdf`;
    expect(plan([obj(secondary)]).orphans).toHaveLength(1);
    expect(plan([obj(secondary)], [secondary]).orphans).toHaveLength(0);
  });

  it("keeps anything outside the app's upload shape (an unknown writer's prefix)", () => {
    const p = plan([
      obj("pdfs/recommendation.pdf"),
      obj("exports/2026.xlsx"),
      obj("documents/not-a-uuid/SLOT/u1_a.pdf"),
      obj(`documents/${APP_A}/u1_no_slot.pdf`),
      obj(`documents/${APP_A}/a/b/c/u1_too_deep.pdf`),
      obj(`other/${APP_A}/SLOT/u1_a.pdf`),
    ]);
    expect(p.orphans).toEqual([]);
    expect(p.kept["unrecognised-path"]).toBe(6);
    expect(p.eligible).toBe(0);
  });

  it("keeps migration (GRANT_TRACKER_*) objects, ledgered or not", () => {
    const p = plan([obj(P("gt1_letter.pdf", "GRANT_TRACKER_LETTER")), obj(`documents/${APP_A}/secondary/GRANT_TRACKER_X/gt2.pdf`)]);
    expect(p.orphans).toEqual([]);
    expect(p.kept["migration-object"]).toBe(2);
    expect(p.eligible).toBe(0);
  });

  it("keeps dashboard folder placeholders", () => {
    const p = plan([obj(P(".emptyFolderPlaceholder"))]);
    expect(p.orphans).toEqual([]);
    expect(p.kept.placeholder).toBe(1);
  });

  it("mixes: only the old unknown app-shaped object is selected", () => {
    const p = plan(
      [obj(P("u1_known.pdf")), obj(P("u2_new.pdf"), HOUR), obj(P("u3_orphan.pdf")), obj("misc/u4.pdf")],
      [P("u1_known.pdf")],
    );
    expect(p.orphans.map((o) => o.name)).toEqual([P("u3_orphan.pdf")]);
    expect(p.eligible).toBe(3);
  });
});

describe("normaliseStoragePath / redactStoragePath", () => {
  it("strips leading slashes, collapses doubled ones, trims", () => {
    expect(normaliseStoragePath("  //documents//a/b ")).toBe("documents/a/b");
  });

  it("keeps the ids and the extension, never the parent's filename", () => {
    const r = redactStoragePath(P("0f6e-uuid_Jane_Smith_bank_statement.pdf"));
    expect(r).toBe(`documents/${APP_A}/BANK_STATEMENT/0f6e-uuid_….pdf`);
    expect(r).not.toContain("Smith");
    expect(redactStoragePath("documents/x/y/nounderscore")).toBe("documents/x/y/…");
  });
});

describe("isOrphanUploadCleanupEnabled", () => {
  it("is on only for exactly 'true'", () => {
    const prev = process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
    try {
      for (const v of [undefined, "", "TRUE", "1", "yes", "true "]) {
        if (v === undefined) delete process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
        else process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED = v;
        expect(isOrphanUploadCleanupEnabled()).toBe(false);
      }
      process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED = "true";
      expect(isOrphanUploadCleanupEnabled()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
      else process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED = prev;
    }
  });
});

describe("listBucketObjects", () => {
  const base = { root: "documents", maxRequests: 10_000, maxObjects: 100_000, concurrency: 4, shouldStop: () => false };
  const at = ago(48 * HOUR);

  it("walks nested folders and pages a folder past 1,000 entries", async () => {
    const many = Array.from({ length: 2_345 }, (_, i) => ({ name: P(`u${String(i).padStart(5, "0")}_f.pdf`), createdAt: at }));
    const { lister, calls } = fakeBucket([
      ...many,
      { name: `documents/${APP_B}/secondary/PAYSLIP/u1_p.pdf`, createdAt: at },
      { name: "elsewhere/x.pdf", createdAt: at },
    ]);
    const res = await listBucketObjects(lister, base);
    expect(res.complete).toBe(true);
    expect(res.objects).toHaveLength(2_346);
    expect(res.objects.some((o) => o.name.startsWith("elsewhere/"))).toBe(false);
    const slotPages = calls.filter((c) => c.folder === `documents/${APP_A}/BANK_STATEMENT`);
    expect(slotPages.map((c) => c.offset)).toEqual([0, 1000, 2000]);
    expect(res.objects[0]).toMatchObject({ name: P("u00000_f.pdf"), createdAt: at });
  });

  it("does not descend into a skipped (migration) folder", async () => {
    const { lister, calls } = fakeBucket([
      { name: P("gt1.pdf", "GRANT_TRACKER_LETTER"), createdAt: at },
      { name: P("u1_a.pdf"), createdAt: at },
    ]);
    const res = await listBucketObjects(lister, { ...base, skipFolder: isMigrationSlotFolder });
    expect(res.objects.map((o) => o.name)).toEqual([P("u1_a.pdf")]);
    expect(res.skippedFolders).toBe(1);
    expect(calls.some((c) => c.folder.includes("GRANT_TRACKER_"))).toBe(false);
  });

  it("records a folder that fails to list and reports the walk incomplete", async () => {
    const { lister } = fakeBucket(
      [{ name: P("u1_a.pdf"), createdAt: at }, { name: P("u2_b.pdf", "PAYSLIP", APP_B), createdAt: at }],
      { failFolders: [`documents/${APP_B}`] },
    );
    const res = await listBucketObjects(lister, base);
    expect(res.complete).toBe(false);
    expect(res.errors).toEqual([{ folder: `documents/${APP_B}`, message: "boom" }]);
    expect(res.objects.map((o) => o.name)).toEqual([P("u1_a.pdf")]);
  });

  it("stops at the request cap and at the stop signal", async () => {
    const files = [{ name: P("u1_a.pdf"), createdAt: at }, { name: P("u2_b.pdf", "PAYSLIP", APP_B), createdAt: at }];
    const capped = await listBucketObjects(fakeBucket(files).lister, { ...base, maxRequests: 2 });
    expect(capped.complete).toBe(false);
    expect(capped.requests).toBe(2);
    expect(capped.objects).toEqual([]);

    let n = 0;
    const stopped = await listBucketObjects(fakeBucket(files).lister, { ...base, shouldStop: () => ++n > 1 });
    expect(stopped.complete).toBe(false);
    expect(stopped.requests).toBe(1);
  });
});

describe("loadKnownStoragePaths", () => {
  function fakeTx(docPaths: string[], ledgerKeys: string[]) {
    const seen: unknown[] = [];
    const tx = {
      document: {
        findMany: async (args: { where?: { storagePath?: { in: string[] } } }) => {
          seen.push(args);
          const only = args.where?.storagePath?.in;
          return docPaths.filter((p) => !only || only.includes(p)).map((storagePath) => ({ storagePath }));
        },
      },
      dataMigrationLedger: {
        findMany: async (args: { where: { entityType: string; entityId?: { in: string[] } } }) => {
          seen.push(args);
          expect(args.where.entityType).toBe("StorageObject");
          const only = args.where.entityId?.in;
          return ledgerKeys.filter((k) => !only || only.includes(k)).map((entityId) => ({ entityId }));
        },
      },
    };
    return { tx: tx as unknown as Tx, seen };
  }

  it("unions document paths and ledgered migration keys", async () => {
    const { tx } = fakeTx([P("u1_a.pdf")], [P("gt1.pdf", "GRANT_TRACKER_X")]);
    expect(await loadKnownStoragePaths(tx)).toEqual(new Set([P("u1_a.pdf"), P("gt1.pdf", "GRANT_TRACKER_X")]));
  });

  it("re-check mode finds a row stored under another spelling of the path", async () => {
    const { tx } = fakeTx([`/${P("u1_a.pdf")}`], []);
    const found = await loadKnownStoragePaths(tx, [P("u1_a.pdf"), P("u2_b.pdf")]);
    expect(found).toEqual(new Set([`/${P("u1_a.pdf")}`]));
  });
});
