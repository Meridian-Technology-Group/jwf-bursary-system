// src/lib/email/__tests__/send-gate.test.ts
// Backlog #12 — regression tests for the per-template enable/disable gate.
//
// Contract: when an EmailTemplate row has `enabled = false`, sendEmail must
// short-circuit to a success-shaped no-op (no Resend call, success: true,
// skipped: true). When enabled, it must proceed to dispatch via Resend.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTemplateType } from "@prisma/client";

// ── Mocks ───────────────────────────────────────────────────────────────────
// withAdminContext(cb) runs `cb(tx)`; we stub tx.emailTemplate.findUnique to
// return a single configurable template row.

const templateRow = {
  enabled: true as boolean,
  subject: "Hello {{applicant_name}}",
  body: "Hi {{applicant_name}}",
};

vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (cb: (tx: unknown) => unknown) =>
    cb({
      emailTemplate: {
        findUnique: async () => templateRow,
      },
    }),
}));

const sendMock = vi.fn(
  async (_payload: unknown) => ({ data: { id: "msg_123" }, error: null }),
);

vi.mock("../resend", () => ({
  resend: { emails: { send: (payload: unknown) => sendMock(payload) } },
}));

import { sendEmail } from "../send";

describe("sendEmail enable/disable gate", () => {
  beforeEach(() => {
    sendMock.mockClear();
    templateRow.enabled = true;
  });

  it("no-ops with success when the template is disabled", async () => {
    templateRow.enabled = false;

    const result = await sendEmail(
      "parent@example.com",
      EmailTemplateType.OUTCOME_DNQ,
      { applicant_name: "Alex Parent" },
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.messageId).toBeUndefined();
    // Critical: the gate must run BEFORE any Resend dispatch.
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("dispatches via Resend when the template is enabled", async () => {
    templateRow.enabled = true;

    const result = await sendEmail(
      "parent@example.com",
      EmailTemplateType.OUTCOME_DNQ,
      { applicant_name: "Alex Parent" },
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.messageId).toBe("msg_123");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
