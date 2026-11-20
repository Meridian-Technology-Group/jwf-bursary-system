/**
 * Audit finding 16 — the wizard sends in bounded chunks and shows one combined
 * result, the same as the single 500-recipient request it replaces.
 */
import { describe, expect, it, vi } from "vitest";
import { BULK_SEND_CHUNK_SIZE, sendInChunks, type ChunkRecipient } from "../bulk-send-chunks";
import type { BulkSendEmailResult } from "@/app/(admin)/queue/bulk-email-actions";

const recipients = (n: number): ChunkRecipient[] =>
  Array.from({ length: n }, (_, i) => ({ applicationId: `app-${i}`, reference: `REF-${i}`, email: `p${i}@x.test` }));

/** A fake server action: sends to every id, except the ones listed as failing. */
function fakeAction(failing: Set<string> = new Set()) {
  return vi.fn(async (ids: string[]): Promise<BulkSendEmailResult> => ({
    success: true,
    sent: ids.filter((id) => !failing.has(id)).length,
    failed: ids.filter((id) => failing.has(id)).length,
    skipped: 0,
    results: ids.map((id) => ({
      applicationId: id,
      reference: id.replace("app", "REF"),
      email: null,
      outcome: failing.has(id) ? ("failed" as const) : ("sent" as const),
    })),
  }));
}

describe("sendInChunks", () => {
  it("sends 120 recipients as 50 + 50 + 20 and combines the counts and rows in order", async () => {
    expect(BULK_SEND_CHUNK_SIZE).toBe(50);
    const action = fakeAction(new Set(["app-7", "app-99"]));
    const result = await sendInChunks(recipients(120), action);

    expect(action.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(action.mock.calls[1][0][0]).toBe("app-50");
    expect(result).toMatchObject({ success: true, sent: 118, failed: 2, skipped: 0 });
    expect(result.results.map((r) => r.applicationId)).toEqual(recipients(120).map((r) => r.applicationId));
  });

  it("a rejected FIRST chunk returns its error unchanged (nothing was sent — today's behaviour)", async () => {
    const rejected: BulkSendEmailResult = { success: false, error: "Selected template is disabled.", sent: 0, failed: 0, skipped: 0, results: [] };
    const action = vi.fn(async () => rejected);
    const result = await sendInChunks(recipients(120), action);
    expect(result).toBe(rejected);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("a LATER chunk failing keeps what was sent and reports the rest as not confirmed, never re-sent", async () => {
    const ok = fakeAction();
    const action = vi
      .fn<(ids: string[]) => Promise<BulkSendEmailResult>>()
      .mockImplementationOnce(ok)
      .mockImplementationOnce(async () => {
        throw new Error("network");
      });
    const result = await sendInChunks(recipients(120), action);

    expect(action).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.sent).toBe(50);
    expect(result.skipped).toBe(70);
    const firstUnsent = result.results[50];
    expect(firstUnsent).toMatchObject({ applicationId: "app-50", reference: "REF-50", outcome: "skipped" });
    expect(firstUnsent.reason).toContain("network");
  });

  it("makes no call for an empty list", async () => {
    const action = fakeAction();
    expect(await sendInChunks([], action)).toMatchObject({ success: true, sent: 0, results: [] });
    expect(action).not.toHaveBeenCalled();
  });
});
