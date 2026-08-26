import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailTemplateType } from "@prisma/client";

// Boundary mocks, same shape as `reply-to.test.ts`: importing `send.ts` for
// real would throw on a missing RESEND_API_KEY.
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (cb: (tx: unknown) => unknown) =>
    cb({
      emailTemplate: {
        findUnique: async () => ({
          enabled: true,
          subject: "Hello {{applicant_name}}",
          body: "Hi {{applicant_name}}",
        }),
      },
      emailLog: { create: async () => undefined },
    }),
  prisma: {},
}));

const sendMock = vi.fn(async (_payload: unknown) => ({
  data: { id: "msg_123" },
  error: null,
}));
vi.mock("../resend", () => ({
  resend: { emails: { send: (payload: unknown) => sendMock(payload) } },
}));

import { inviteBccAddress, normaliseBccAddress, sendEmail } from "../send";

/**
 * CH-32 — BCC on the INDIVIDUAL invitation.
 *
 * Charlotte looked for BCC on the single invite and found it only on bulk
 * email. Brian offered two shapes: **(1)** auto-copy the bursary inbox on every
 * invite, shown and clearable, or **(2)** an empty box each time. Her answer
 * (Q4, asked 23 Aug) has not arrived and **(1)** is the decided default.
 *
 * Building ahead of her answer is safe precisely because the box is *shown and
 * clearable*: clearing it gives option (2)'s behaviour for that invite, so if
 * she picks (2) the change is a default, not a rebuild.
 *
 * The property that matters most here is the **production gate**. A blind copy
 * is a silent side effect — if the default leaked into staging or a local run,
 * every test invite would quietly land in the client's live fees inbox. So the
 * fallback mirrors `replyToAddress()` exactly: production only, env var wins.
 */

const FEES = "fees@johnwhitgiftfoundation.org";
const originalVercelEnv = process.env.VERCEL_ENV;
const originalBcc = process.env.RESEND_INVITE_BCC_EMAIL;

beforeEach(() => {
  delete process.env.RESEND_INVITE_BCC_EMAIL;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
  if (originalBcc === undefined) delete process.env.RESEND_INVITE_BCC_EMAIL;
  else process.env.RESEND_INVITE_BCC_EMAIL = originalBcc;
});

describe("inviteBccAddress — CH-32 option (1) default", () => {
  it("copies the bursary inbox in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(inviteBccAddress()).toBe(FEES);
  });

  it("copies NOBODY outside production — the whole point of the gate", () => {
    // A blind copy is a silent side effect. Without this gate every test invite
    // sent from staging or a laptop would land in the client's live inbox and
    // nothing on screen would say so.
    for (const env of ["preview", "development", undefined]) {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      expect(inviteBccAddress(), `VERCEL_ENV=${env}`).toBeUndefined();
    }
  });

  it("an explicit RESEND_INVITE_BCC_EMAIL wins in every environment", () => {
    process.env.RESEND_INVITE_BCC_EMAIL = "test-inbox@example.test";
    for (const env of ["production", "preview", "development"]) {
      process.env.VERCEL_ENV = env;
      expect(inviteBccAddress()).toBe("test-inbox@example.test");
    }
  });

  it("mirrors replyToAddress's precedence, deliberately", () => {
    // Same shape, same reason. If one is changed the other almost certainly
    // should be too, and this test is where a reader finds that out.
    process.env.VERCEL_ENV = "production";
    process.env.RESEND_INVITE_BCC_EMAIL = "override@example.test";
    expect(inviteBccAddress()).toBe("override@example.test");
    delete process.env.RESEND_INVITE_BCC_EMAIL;
    expect(inviteBccAddress()).toBe(FEES);
  });
});

describe("normaliseBccAddress — one check for all three send paths", () => {
  it("treats blank as 'no copy', not as an error", () => {
    // Clearing the box is how an admin opts out per invite, so it must be a
    // valid input rather than a validation failure.
    for (const blank of ["", "   ", "\t", null, undefined]) {
      const result = normaliseBccAddress(blank);
      expect(result.ok, `input ${JSON.stringify(blank)}`).toBe(true);
      expect(result.ok && result.bcc).toBeUndefined();
    }
  });

  it("accepts and trims a valid address", () => {
    const result = normaliseBccAddress("  fees@example.org  ");
    expect(result).toEqual({ ok: true, bcc: "fees@example.org" });
  });

  it("rejects a malformed address rather than sending to it", () => {
    for (const bad of [
      "not-an-email",
      "no@tld",
      "@example.org",
      "spaces in@example.org",
      "two@@example.org",
    ]) {
      expect(normaliseBccAddress(bad).ok, `input ${bad}`).toBe(false);
    }
  });

  it("applies the SAME rule the bulk wizard already applied", () => {
    // `bulk-email-actions.ts` gates on this exact expression. Keeping one
    // implementation is why the two invite paths and the batch path cannot
    // drift into accepting different things.
    const bulkRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const candidate of [
      "fees@johnwhitgiftfoundation.org",
      "a@b.co",
      "not-an-email",
      "no@tld",
    ]) {
      const mine = normaliseBccAddress(candidate);
      expect(mine.ok, `input ${candidate}`).toBe(bulkRule.test(candidate));
    }
  });
});

describe("sendEmail — CH-32: the bcc option actually reaches Resend", () => {
  beforeEach(() => sendMock.mockClear());

  it("sets bcc when given one", async () => {
    await sendEmail(
      "parent@example.test",
      EmailTemplateType.INVITATION,
      { applicant_name: "Pat" },
      { bcc: "fees@example.org" }
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      to: "parent@example.test",
      bcc: "fees@example.org",
    });
  });

  it("omits the bcc KEY entirely when not given one", async () => {
    // Not `bcc: undefined` — an explicit undefined has bitten providers before,
    // and the existing `sendRawEmail` spreads conditionally for the same reason.
    await sendEmail("parent@example.test", EmailTemplateType.INVITATION, {
      applicant_name: "Pat",
    });
    const payload = sendMock.mock.calls[0][0] as Record<string, unknown>;
    expect("bcc" in payload).toBe(false);
  });

  it("omits it for a blank address, so a cleared box copies nobody", async () => {
    const normalised = normaliseBccAddress("   ");
    expect(normalised.ok && normalised.bcc).toBeUndefined();
    await sendEmail(
      "parent@example.test",
      EmailTemplateType.INVITATION,
      { applicant_name: "Pat" },
      normalised.ok && normalised.bcc ? { bcc: normalised.bcc } : undefined
    );
    const payload = sendMock.mock.calls[0][0] as Record<string, unknown>;
    expect("bcc" in payload).toBe(false);
  });
});
