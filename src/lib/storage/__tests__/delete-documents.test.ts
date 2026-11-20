/**
 * Audit finding 15 — the retention and purge loops removed one Storage object
 * per request (a new admin client each time). `deleteDocuments` batches them:
 * one client, at most 1,000 keys per `remove`, every failure still logged.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const remove = vi.fn();
const from = vi.fn(() => ({ remove }));
const createSupabaseAdminClient = vi.fn(() => ({ storage: { from } }));
vi.mock("@/lib/auth/supabase-admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

import { deleteDocuments, REMOVE_BATCH_SIZE } from "../documents";

const paths = (n: number) => Array.from({ length: n }, (_, i) => `documents/app/${i}.pdf`);

beforeEach(() => {
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  from.mockClear();
  createSupabaseAdminClient.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteDocuments", () => {
  it("removes 2,500 files in three requests on one client (chunks of 1,000)", async () => {
    const failures = await deleteDocuments(paths(2500));
    expect(failures).toEqual([]);
    expect(REMOVE_BATCH_SIZE).toBe(1000);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([1000, 1000, 500]);
    expect(from).toHaveBeenCalledWith("documents");
  });

  it("does nothing for an empty list", async () => {
    expect(await deleteDocuments([])).toEqual([]);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("a failed chunk reports (and logs) every path in it; other chunks still run", async () => {
    remove
      .mockResolvedValueOnce({ data: null, error: { message: "denied" } })
      .mockRejectedValueOnce(new Error("network"));
    const failures = await deleteDocuments(paths(1001));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(failures).toHaveLength(1001);
    expect(failures[0]).toEqual({ path: "documents/app/0.pdf", message: "denied" });
    expect(failures[1000]).toEqual({ path: "documents/app/1000.pdf", message: "network" });
    expect(console.error).toHaveBeenCalledTimes(1001);
  });
});
