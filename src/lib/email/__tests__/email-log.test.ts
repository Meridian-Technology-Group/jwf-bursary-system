// Epic 15 X1 (CI-02) — the sent-emails log. Every sender records a row
// best-effort: SENT with the Resend id, FAILED with the provider error,
// SKIPPED when a disabled template no-ops. A log-write failure must never
// fail the send itself.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTemplateType } from "@prisma/client";

const templateRow = {
  enabled: true,
  subject: "Hello {{applicant_name}}",
  body: "Hi {{applicant_name}}",
};
let templateEnabled = true;

const logCreateMock = vi.fn(async (_args: unknown) => ({ id: "log-1" }));

vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (cb: (tx: unknown) => unknown) =>
    cb({
      emailTemplate: {
        findUnique: async () => ({ ...templateRow, enabled: templateEnabled }),
      },
      emailLog: {
        create: (args: unknown) => logCreateMock(args),
      },
    }),
}));

let sendResult: { data: { id: string } | null; error: { name: string; message: string } | null };
const sendMock = vi.fn(async (_payload: unknown) => sendResult);

vi.mock("../resend", () => ({
  resend: { emails: { send: (payload: unknown) => sendMock(payload) } },
}));

import { sendEmail, sendRawEmail } from "../send";

beforeEach(() => {
  vi.clearAllMocks();
  templateEnabled = true;
  sendResult = { data: { id: "msg_123" }, error: null };
});

function lastLogData(): Record<string, unknown> {
  const call = logCreateMock.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
  return call.data;
}

describe("sent-emails log (Epic 15 X1)", () => {
  it("records SENT with the Resend id and rendered subject", async () => {
    const result = await sendEmail("parent@example.test", EmailTemplateType.INVITATION, {
      applicant_name: "Pat",
    });

    expect(result.success).toBe(true);
    expect(logCreateMock).toHaveBeenCalledTimes(1);
    expect(lastLogData()).toMatchObject({
      toEmail: "parent@example.test",
      templateType: EmailTemplateType.INVITATION,
      subject: "Hello Pat",
      status: "SENT",
      resendId: "msg_123",
    });
  });

  it("records FAILED with the provider error", async () => {
    sendResult = { data: null, error: { name: "ApiError", message: "boom" } };

    const result = await sendEmail("parent@example.test", EmailTemplateType.INVITATION, {});

    expect(result.success).toBe(false);
    expect(lastLogData()).toMatchObject({
      status: "FAILED",
      error: "ApiError: boom",
    });
  });

  it("records SKIPPED when the template is disabled — and never calls Resend", async () => {
    templateEnabled = false;

    const result = await sendEmail("parent@example.test", EmailTemplateType.REMINDER, {});

    expect(result.success).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
    expect(lastLogData()).toMatchObject({ status: "SKIPPED" });
  });

  it("raw sends log with a null template type", async () => {
    await sendRawEmail("someone@example.test", "Ad hoc subject", "Body");

    expect(lastLogData()).toMatchObject({
      toEmail: "someone@example.test",
      templateType: null,
      subject: "Ad hoc subject",
      status: "SENT",
    });
  });

  it("raw sends pass an optional BCC through to the provider (CI-05)", async () => {
    await sendRawEmail("someone@example.test", "Subject", "Body", {
      bcc: "fees@johnwhitgiftfoundation.org",
    });

    const payload = sendMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.bcc).toBe("fees@johnwhitgiftfoundation.org");

    await sendRawEmail("someone@example.test", "Subject", "Body");
    const noBcc = sendMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect("bcc" in noBcc).toBe(false);
  });

  it("a log-write failure never fails the send", async () => {
    logCreateMock.mockRejectedValueOnce(new Error("db down"));

    const result = await sendEmail("parent@example.test", EmailTemplateType.INVITATION, {});

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg_123");
  });
});
