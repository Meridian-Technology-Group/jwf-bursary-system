/**
 * Retention trial, 22 Oct 2026: the run's summary row outlives the purge, so it
 * must not carry the references it read before purging them.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const createAuditLog = vi.fn(async (_tx: unknown, _entry: unknown) => undefined);
vi.mock("@/lib/audit/log", () => ({ createAuditLog: (tx: unknown, entry: unknown) => createAuditLog(tx, entry) }));
vi.mock("@/lib/db/prisma", () => ({ withAdminContext: async (fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock("@/lib/storage/documents", () => ({ deleteDocuments: vi.fn(async () => []) }));
vi.mock("@/lib/auth/supabase-admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/retention/close-purge", () => ({ deleteAuthUsersPostCommit: vi.fn(async () => undefined) }));
vi.mock("@/lib/retention/policy", async (orig) => ({
  ...(await orig<typeof import("@/lib/retention/policy")>()),
  isRetentionPurgeEnabled: () => true,
  planRetention: () => ({ action: "purge-assessment", rule: "unsuccessful", anchor: null, dueAt: new Date(0), due: true, reason: "" }),
}));
vi.mock("@/lib/retention/stages", () => ({
  toRetentionRecord: (r: unknown) => r,
  purgeAssessment: vi.fn(async () => ({ applied: true, storagePaths: [], authUsersToDelete: [], counts: {} })),
  purgeFormAndDocuments: vi.fn(),
  deleteStorageObjectsPostCommit: vi.fn(async () => undefined),
}));
let pageRows: { id: string; reference: string }[] = [];
vi.mock("@/lib/retention/schedule", () => ({
  PAGE_SIZE: 100,
  dueCandidatesWhere: () => ({}),
  retentionPage: async () => pageRows,
  retentionSchedule: async () => [],
  countByAction: (plans: { action: string }[]) =>
    plans.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.action]: (acc[p.action] ?? 0) + 1 }), {}),
}));

import { GET } from "../route";
import { purgeAssessment } from "@/lib/retention/stages";

describe("GET /api/cron/purge-expired", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    createAuditLog.mockClear();
    pageRows = [{ id: "app-1", reference: "Pupil Surname – Trinity School – Year 7 – 2026-27" }];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("the run's summary row names application ids, never references", async () => {
    const res = await GET(new NextRequest("http://x/api/cron/purge-expired", { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    const entry = createAuditLog.mock.calls[0][1] as { metadata: Record<string, unknown> };
    expect(entry.metadata.applicationIds).toEqual(["app-1"]);
    expect(JSON.stringify(entry)).not.toContain("Pupil Surname");
  });

  it("refuses without the secret", async () => {
    const res = await GET(new NextRequest("http://x/api/cron/purge-expired"));
    expect(res.status).toBe(401);
  });

  it("audit finding 15: stops starting stages after the time budget and defers the rest", async () => {
    pageRows = [
      { id: "app-1", reference: "R1" },
      { id: "app-2", reference: "R2" },
      { id: "app-3", reference: "R3" },
    ];
    vi.mocked(purgeAssessment).mockClear();
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    // Each stage "takes" 130s: stages 1 and 2 start inside the 240s budget,
    // stage 3 would start at 260s and must wait for next week's run.
    vi.mocked(purgeAssessment).mockImplementation(async () => {
      clock += 130_000;
      return { applied: true, storagePaths: [], authUsersToDelete: [], counts: {} } as never;
    });

    const res = await GET(new NextRequest("http://x/api/cron/purge-expired", { headers: { authorization: "Bearer s3cret" } }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(purgeAssessment).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({ applied: 2, due: 3, deferred: 1 });
    const entry = createAuditLog.mock.calls[0][1] as { metadata: Record<string, unknown> };
    expect(entry.metadata.applicationIds).toEqual(["app-1", "app-2"]);
    expect(entry.metadata.deferred).toBe(1);
  });
});
