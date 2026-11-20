import { describe, it, expect, vi } from "vitest";
import { saveAssessment } from "../assessments";

/**
 * Audit 20 Nov 2026 (finding 12a): an assessment save must never write
 * `status`. Status is owned by the central status service (start / complete /
 * pause / the post-assessment lifecycle), which also promotes the account and
 * writes the audit trail. A save payload carrying `status: "NEW_AWARD"` — no
 * form sends one, but a direct server-action call can — used to move an
 * IN_PROGRESS assessment straight into a locked award with none of that.
 */
describe("saveAssessment — status is not a save field", () => {
  function makeTx() {
    return {
      assessment: {
        update: vi.fn(async () => ({})),
        findUniqueOrThrow: vi.fn(async () => ({ id: "asmt-1" })),
      },
    };
  }

  it("ignores a status smuggled into the save payload", async () => {
    const tx = makeTx();
    await saveAssessment(tx as never, "asmt-1", {
      annualFees: 1000,
      status: "NEW_AWARD",
    } as never);

    expect(tx.assessment.update).toHaveBeenCalledTimes(1);
    const arg = (tx.assessment.update.mock.calls[0] as unknown[])[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).not.toHaveProperty("status");
    expect(arg.data.annualFees).toBe(1000);
  });
});
