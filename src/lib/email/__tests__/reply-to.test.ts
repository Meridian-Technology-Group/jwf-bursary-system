// Epic 14 B1 (CG-05 / D14-5) — every outbound email carries a replyTo,
// production-gated: the bursary team's REAL inbox is the fallback ONLY in
// production, so test sends can never route replies to the client's live
// mailbox. An explicit RESEND_REPLY_TO_EMAIL wins in every environment;
// unset outside production means no reply-to header at all.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailTemplateType } from "@prisma/client";

const templateRow = {
  enabled: true,
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

const sendMock = vi.fn(async (_payload: unknown) => ({
  data: { id: "msg_123" },
  error: null,
}));

vi.mock("../resend", () => ({
  resend: { emails: { send: (payload: unknown) => sendMock(payload) } },
}));

import { replyToAddress, sendBatchEmails, sendEmail, sendRawEmail } from "../send";

const FEES = "fees@johnwhitgiftfoundation.org";

function reset() {
  sendMock.mockClear();
  delete process.env.RESEND_REPLY_TO_EMAIL;
  delete process.env.VERCEL_ENV;
}

describe("replyToAddress resolution (CG-05, production-gated)", () => {
  beforeEach(reset);
  afterEach(reset);

  it("falls back to the fees inbox ONLY in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(replyToAddress()).toBe(FEES);
  });

  it("returns undefined outside production when the env var is unset", () => {
    expect(replyToAddress()).toBeUndefined();
    process.env.VERCEL_ENV = "preview";
    expect(replyToAddress()).toBeUndefined();
  });

  it("an explicit RESEND_REPLY_TO_EMAIL wins in every environment", () => {
    process.env.RESEND_REPLY_TO_EMAIL = "test-inbox@example.test";
    expect(replyToAddress()).toBe("test-inbox@example.test");
    process.env.VERCEL_ENV = "production";
    expect(replyToAddress()).toBe("test-inbox@example.test");
  });
});

describe("replyTo on every send path (CG-05)", () => {
  beforeEach(() => {
    reset();
    process.env.VERCEL_ENV = "production";
  });

  afterEach(reset);

  it("sendEmail passes replyTo", async () => {
    const result = await sendEmail(
      "parent@example.com",
      EmailTemplateType.CONFIRMATION,
      { applicant_name: "Alex Parent" }
    );

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ replyTo: FEES });
  });

  it("sendBatchEmails passes replyTo for every recipient", async () => {
    const result = await sendBatchEmails(
      [
        { email: "a@example.com", mergeData: { applicant_name: "A" } },
        { email: "b@example.com", mergeData: { applicant_name: "B" } },
      ],
      EmailTemplateType.REMINDER
    );

    expect(result.sent).toBe(2);
    expect(sendMock).toHaveBeenCalledTimes(2);
    for (const call of sendMock.mock.calls) {
      expect(call[0]).toMatchObject({ replyTo: FEES });
    }
  });

  it("sendRawEmail passes replyTo", async () => {
    const result = await sendRawEmail(
      "parent@example.com",
      "Subject",
      "Body text"
    );

    expect(result.success).toBe(true);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ replyTo: FEES });
  });

  it("the env override reaches the Resend payload", async () => {
    process.env.RESEND_REPLY_TO_EMAIL = "test-inbox@example.test";

    await sendRawEmail("parent@example.com", "Subject", "Body");

    expect(sendMock.mock.calls[0][0]).toMatchObject({
      replyTo: "test-inbox@example.test",
    });
  });

  it("nonprod with the env var unset sends NO replyTo", async () => {
    delete process.env.VERCEL_ENV;

    await sendRawEmail("parent@example.com", "Subject", "Body");

    const payload = sendMock.mock.calls[0][0] as { replyTo?: string };
    expect(payload.replyTo).toBeUndefined();
  });
});
