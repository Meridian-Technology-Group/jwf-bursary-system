import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * A1 — upload tickets.
 *
 * The ticket is the only thing tying `/api/documents/sign` to
 * `/api/documents/confirm`. If it can be forged or tampered with, a client
 * could point confirm at an arbitrary object, downgrade the declared MIME so
 * the magic-byte sniff passes, or move an upload into the PRIMARY namespace it
 * was never authorised for. These tests pin that it cannot.
 */

import {
  issueUploadTicket,
  verifyUploadTicket,
  type UploadTicketClaims,
} from "../upload-ticket";

const CLAIMS: UploadTicketClaims = {
  sub: "parent-1",
  applicationId: "app-1",
  slot: "BIRTH_CERTIFICATE",
  storagePath: "documents/app-1/BIRTH_CERTIFICATE/uuid_cert.pdf",
  filename: "cert.pdf",
  mime: "application/pdf",
  ns: "primary",
};

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
  }
});

describe("upload tickets", () => {
  it("round-trips every claim", () => {
    const result = verifyUploadTicket(issueUploadTicket(CLAIMS));
    expect(result).toEqual({ ok: true, claims: CLAIMS });
  });

  it("rejects a tampered payload", () => {
    const ticket = issueUploadTicket(CLAIMS);
    const [, signature] = ticket.split(".");

    // Re-encode the claims with a different storage path, keeping the original
    // signature — the exact move a client would make to redirect confirm at
    // someone else's object.
    const forgedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        ...CLAIMS,
        storagePath: "documents/other-app/COUNCIL_TAX/uuid_evil.pdf",
        iat: 0,
        exp: 9_999_999_999,
      }),
      "utf8"
    ).toString("base64url");

    expect(verifyUploadTicket(`${forgedPayload}.${signature}`)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("rejects a ticket signed with a different secret", () => {
    const ticket = issueUploadTicket(CLAIMS);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "a-rotated-key";
    expect(verifyUploadTicket(ticket)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("expires", () => {
    const issuedAt = Date.parse("2026-08-14T10:00:00Z");
    const ticket = issueUploadTicket(CLAIMS, issuedAt);

    // Still valid a minute later, gone half an hour later.
    expect(verifyUploadTicket(ticket, issuedAt + 60_000).ok).toBe(true);
    expect(verifyUploadTicket(ticket, issuedAt + 31 * 60_000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it.each([
    ["not-a-ticket", "malformed"],
    ["", "malformed"],
    [".", "malformed"],
    [null, "malformed"],
    [42, "malformed"],
  ])("rejects %o as %s", (input, reason) => {
    expect(verifyUploadTicket(input)).toEqual({ ok: false, reason });
  });

  it("preserves the secondary namespace", () => {
    const secondary: UploadTicketClaims = { ...CLAIMS, ns: "secondary" };
    const result = verifyUploadTicket(issueUploadTicket(secondary));
    expect(result.ok && result.claims.ns).toBe("secondary");
  });
});
