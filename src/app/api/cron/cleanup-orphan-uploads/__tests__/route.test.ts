/**
 * The orphaned-upload sweep cron, end to end over fakes: an in-memory bucket
 * (list only), an in-memory documents table + migration ledger, and a spy in
 * place of the batched Storage delete. Nothing here can reach Storage or a
 * database.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { APP_A, APP_B, fakeBucket, type FakeObject } from "@/lib/storage/__tests__/fake-bucket";

// ── fakes ────────────────────────────────────────────────────────────────────
let bucketObjects: FakeObject[] = [];
let onList: ((folder: string) => void) | undefined;
let docRows: string[] = [];
let ledgerKeys: string[] = [];
/** Rows that "appear" between plan and delete — seen only by the re-check. */
let lateRows: string[] = [];
let failKnownLoad = false;

const createAuditLog = vi.fn(async (_tx: unknown, _entry: unknown) => undefined);
vi.mock("@/lib/audit/log", () => ({ createAuditLog: (tx: unknown, entry: unknown) => createAuditLog(tx, entry) }));

const fakeTx = {
  document: {
    findMany: async (args: { where?: { storagePath?: { in: string[] } } }) => {
      if (failKnownLoad) throw new Error("db down");
      const only = args.where?.storagePath?.in;
      const rows = only ? [...docRows, ...lateRows].filter((p) => only.includes(p)) : docRows;
      return rows.map((storagePath) => ({ storagePath }));
    },
  },
  dataMigrationLedger: {
    findMany: async (args: { where: { entityId?: { in: string[] } } }) => {
      const only = args.where.entityId?.in;
      return ledgerKeys.filter((k) => !only || only.includes(k)).map((entityId) => ({ entityId }));
    },
  },
};
vi.mock("@/lib/db/prisma", () => ({ withAdminContext: async (fn: (tx: unknown) => unknown) => fn(fakeTx) }));

const deleteDocuments = vi.fn(async (_paths: readonly string[]) => [] as { path: string; message: string }[]);
vi.mock("@/lib/storage/documents", () => ({ deleteDocuments: (paths: readonly string[]) => deleteDocuments(paths) }));

vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("documents");
        return fakeBucket(bucketObjects, { onList: (f) => onList?.(f) }).lister;
      },
    },
  }),
}));

import { GET } from "../route";

// ── helpers ──────────────────────────────────────────────────────────────────
const OLD = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
const FRESH = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const path = (i: number, slot = "BANK_STATEMENT", app = APP_A) =>
  `documents/${app}/${slot}/${String(i).padStart(5, "0")}-uuid_Parent_Name_statement.pdf`;
const call = (auth: string | null = "Bearer s3cret") =>
  GET(new NextRequest("http://x/api/cron/cleanup-orphan-uploads", auth ? { headers: { authorization: auth } } : undefined));
const deletedPaths = () => deleteDocuments.mock.calls.flatMap((c) => [...c[0]]);
const auditEntries = () => createAuditLog.mock.calls.map((c) => c[1] as { action: string; context: string; metadata: Record<string, unknown> });

/** `known` documents with rows plus `orphans` old row-less ones (+ the fixed keep-cases). */
function seed(known: number, orphans: number) {
  docRows = Array.from({ length: known }, (_, i) => path(i));
  const orphanPaths = Array.from({ length: orphans }, (_, i) => path(i, "COUNCIL_TAX", APP_B));
  bucketObjects = [
    ...docRows.map((name) => ({ name, createdAt: OLD })),
    ...orphanPaths.map((name) => ({ name, createdAt: OLD })),
    { name: `documents/${APP_A}/PAYSLIP/inflight-uuid_upload.pdf`, createdAt: FRESH },
    { name: `documents/${APP_A}/GRANT_TRACKER_LETTER/gt1_letter.pdf`, createdAt: OLD },
  ];
  return orphanPaths;
}

describe("GET /api/cron/cleanup-orphan-uploads", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
    createAuditLog.mockClear();
    deleteDocuments.mockReset();
    deleteDocuments.mockImplementation(async () => []);
    onList = undefined;
    ledgerKeys = [];
    lateRows = [];
    failKnownLoad = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED;
  });

  describe("auth (fail-closed)", () => {
    it("refuses without the bearer secret", async () => {
      seed(10, 1);
      expect((await call(null)).status).toBe(401);
      expect((await call("Bearer wrong")).status).toBe(401);
      expect(deleteDocuments).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("refuses everyone when CRON_SECRET is unset", async () => {
      delete process.env.CRON_SECRET;
      seed(10, 1);
      expect((await call("Bearer undefined")).status).toBe(401);
      expect((await call("Bearer ")).status).toBe(401);
    });
  });

  describe("report-only (default)", () => {
    it("deletes nothing, reports counts and a redacted sample, writes one summary row", async () => {
      seed(100, 3);
      const res = await call();
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;

      expect(deleteDocuments).not.toHaveBeenCalled();
      expect(body).toMatchObject({
        ok: true,
        mode: "report-only",
        listed: 103 + 1, // the migration folder is never listed
        listingComplete: true,
        skippedMigrationFolders: 1,
        knownPaths: 100,
        eligible: 104,
        orphans: 3,
        deleted: 0,
        blocked: null,
      });
      expect((body.kept as Record<string, number>)["too-recent"]).toBe(1);
      expect(body.sample).toEqual([0, 1, 2].map((i) => `documents/${APP_B}/COUNCIL_TAX/${String(i).padStart(5, "0")}-uuid_….pdf`));

      const entries = auditEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe("ORPHAN_UPLOAD_CLEANUP_CRON");
      expect(entries[0].metadata).toMatchObject({ mode: "report-only", orphans: 3, deleted: 0 });
      expect(JSON.stringify(entries[0])).not.toContain("Parent_Name");
      expect(JSON.stringify(body)).not.toContain("Parent_Name");
    });

    it("caps the sample at 20", async () => {
      seed(400, 30);
      const body = (await (await call()).json()) as { sample: string[]; orphans: number };
      expect(body.orphans).toBe(30);
      expect(body.sample).toHaveLength(20);
    });

    it("anything but exactly 'true' stays report-only", async () => {
      process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED = "TRUE";
      seed(100, 3);
      const body = (await (await call()).json()) as { mode: string };
      expect(body.mode).toBe("report-only");
      expect(deleteDocuments).not.toHaveBeenCalled();
    });
  });

  describe("enabled (ORPHAN_UPLOAD_CLEANUP_ENABLED=true)", () => {
    beforeEach(() => {
      process.env.ORPHAN_UPLOAD_CLEANUP_ENABLED = "true";
    });

    it("deletes only the planned orphans, in batches of 100", async () => {
      const orphanPaths = seed(1_200, 250);
      const body = (await (await call()).json()) as Record<string, unknown>;

      expect(deleteDocuments.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
      expect(new Set(deletedPaths())).toEqual(new Set(orphanPaths));
      for (const p of deletedPaths()) {
        expect(docRows).not.toContain(p);
        expect(p).not.toContain("GRANT_TRACKER_");
        expect(p).not.toContain("inflight");
      }
      expect(body).toMatchObject({ mode: "enabled", orphans: 250, deleted: 250, failed: 0, deferred: 0 });
      expect(auditEntries()).toHaveLength(1);
      expect(auditEntries()[0].metadata).toMatchObject({ mode: "enabled", deleted: 250 });
    });

    it("never deletes a ledgered migration key", async () => {
      const orphanPaths = seed(100, 2);
      ledgerKeys = [orphanPaths[0]];
      await call();
      expect(deletedPaths()).toEqual([orphanPaths[1]]);
    });

    it("stops at 500 per run and defers the rest", async () => {
      seed(2_400, 600);
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(deletedPaths()).toHaveLength(500);
      expect(body).toMatchObject({ deleted: 500, deferred: 100 });
    });

    it("keeps a path that gained a row between planning and the delete", async () => {
      const orphanPaths = seed(100, 3);
      lateRows = [orphanPaths[1]];
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(deletedPaths()).toEqual([orphanPaths[0], orphanPaths[2]]);
      expect(body).toMatchObject({ deleted: 2, keptOnRecheck: 1 });
    });

    it("counts Storage failures without throwing", async () => {
      const orphanPaths = seed(100, 3);
      deleteDocuments.mockImplementation(async () => [{ path: orphanPaths[0], message: "nope" }]);
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(body).toMatchObject({ deleted: 2, failed: 1 });
    });

    it("blocks deletion when orphans exceed a quarter of the eligible objects (e.g. DB and bucket from different projects)", async () => {
      seed(10, 20);
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(deleteDocuments).not.toHaveBeenCalled();
      expect(body).toMatchObject({ blocked: "orphan-fraction", deleted: 0, deferred: 20 });
      expect(auditEntries()[0].context).toContain("blocked");
    });

    it("blocks deletion when the database accounts for no paths at all", async () => {
      seed(0, 1);
      bucketObjects.push(...Array.from({ length: 10 }, (_, i) => ({ name: path(i, "P60", APP_A), createdAt: FRESH })));
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(deleteDocuments).not.toHaveBeenCalled();
      expect(body).toMatchObject({ blocked: "no-known-paths" });
    });

    it("fails closed with a 500 when the known paths cannot be loaded", async () => {
      seed(100, 3);
      failKnownLoad = true;
      const res = await call();
      expect(res.status).toBe(500);
      expect(deleteDocuments).not.toHaveBeenCalled();
    });

    it("starts no delete batch after the time budget", async () => {
      seed(1_600, 400);
      let clock = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => clock);
      // Each batch "takes" 100s: batches start at 0s, 100s, 200s; the fourth
      // would start at 300s, past the 240s budget, and waits for next week.
      deleteDocuments.mockImplementation(async () => {
        clock += 100_000;
        return [];
      });
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(deleteDocuments).toHaveBeenCalledTimes(3);
      expect(body).toMatchObject({ deleted: 300, deferred: 100 });
      expect(auditEntries()[0].metadata).toMatchObject({ deleted: 300, deferred: 100 });
    });

    it("stops listing at its budget; the unlisted part is simply not touched", async () => {
      seed(100, 3);
      let clock = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => clock);
      onList = () => {
        clock += 200_000; // the first list call alone blows the 180s listing budget
      };
      const body = (await (await call()).json()) as Record<string, unknown>;
      expect(body).toMatchObject({ listingComplete: false, listed: 0, orphans: 0, deleted: 0 });
      expect(deleteDocuments).not.toHaveBeenCalled();
    });
  });
});
