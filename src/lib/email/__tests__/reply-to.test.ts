// Epic 14 B1 (CG-05 / D14-5) — every outbound email carries a replyTo.
//
// The from-address lives on a send-only subdomain, so before this a parent
// hitting Reply wrote to a black hole. Contract: ALL THREE send paths pass
// `replyTo` to Resend; the default is the bursary team's real inbox so
// production is correct even with `RESEND_REPLY_TO_EMAIL` unset.

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

describe("replyTo on every send path (CG-05)", () => {
  beforeEach(() => {
    sendMock.mockClear();
    delete process.env.RESEND_REPLY_TO_EMAIL;
  });

  afterEach(() => {
    delete process.env.RESEND_REPLY_TO_EMAIL;
  });

  it("defaults to the fees inbox and honours the env override", () => {
    expect(replyToAddress()).toBe(FEES);
    process.env.RESEND_REPLY_TO_EMAIL = "test-inbox@example.test";
    expect(replyToAddress()).toBe("test-inbox@example.test");
  });

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
});
