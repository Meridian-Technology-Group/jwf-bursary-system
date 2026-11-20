/**
 * Audit finding 16 — the bulk email send in bounded requests.
 *
 * One `bulkSendEmailAction` call used to send to up to 500 recipients in a
 * single serverless request (~0.4s each: Resend + email_log + 100ms delay).
 * A timeout meant the per-recipient audit rows (written at the end of the
 * call) were never written and the admin, seeing an error, sent again —
 * duplicates. The action now takes at most {@link BULK_SEND_CHUNK_SIZE} ids per
 * call and audits each call's sends; the wizard drives the chunks through
 * {@link sendInChunks} and shows the same combined result as before.
 *
 * Plain module (no "use server"): shared by the server action (the cap) and
 * the client wizard (the loop).
 */

import type {
  BulkEmailSendOutcome,
  BulkSendEmailResult,
} from "@/app/(admin)/queue/bulk-email-actions";

/** Recipients per server-action call: ~20s of sending, well inside a request. */
export const BULK_SEND_CHUNK_SIZE = 50;

/** What the wizard knows about a recipient, to report one that was never sent. */
export interface ChunkRecipient {
  applicationId: string;
  reference: string;
  email: string | null;
}

/**
 * Sends `recipients` through `sendChunk` in order, {@link BULK_SEND_CHUNK_SIZE}
 * at a time, and combines the results into one.
 *
 * - First chunk rejected (bad template, role, BCC…): nothing was sent, so its
 *   error is returned unchanged — exactly today's behaviour.
 * - A LATER chunk rejected or throwing: earlier chunks have already gone out
 *   (and are audited), so the combined result is still a success; every
 *   recipient from the failed chunk on is reported as `skipped` with the
 *   reason, so the admin follows up those alone rather than re-sending to
 *   everyone.
 */
export async function sendInChunks(
  recipients: readonly ChunkRecipient[],
  sendChunk: (applicationIds: string[]) => Promise<BulkSendEmailResult>
): Promise<BulkSendEmailResult> {
  const combined: BulkSendEmailResult = {
    success: true,
    sent: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  for (let start = 0; start < recipients.length; start += BULK_SEND_CHUNK_SIZE) {
    const chunk = recipients.slice(start, start + BULK_SEND_CHUNK_SIZE);
    let result: BulkSendEmailResult;
    try {
      result = await sendChunk(chunk.map((r) => r.applicationId));
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send bulk email.",
        sent: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    if (!result.success) {
      if (start === 0) return result;
      // "Not confirmed", not "not sent": a chunk that failed part-way may
      // have sent some of its emails before it stopped.
      const reason = `Not confirmed — the send stopped early (${
        result.error ?? "unknown error"
      }). Check whether this email went out before sending it again.`;
      const unsent: BulkEmailSendOutcome[] = recipients
        .slice(start)
        .map((r) => ({ ...r, outcome: "skipped", reason }));
      combined.skipped += unsent.length;
      combined.results.push(...unsent);
      return combined;
    }

    combined.sent += result.sent;
    combined.failed += result.failed;
    combined.skipped += result.skipped;
    combined.results.push(...result.results);
  }

  return combined;
}
