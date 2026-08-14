/**
 * Upload tickets — the integrity link between `/api/documents/sign` and
 * `/api/documents/confirm` (A1, presigned direct-to-Storage uploads).
 *
 * The presigned flow splits one request into three: sign → client PUTs the
 * bytes to Supabase Storage → confirm. Because the two API legs are separate
 * requests, the confirm leg has to be told which object to look at — and a
 * plain `{ storagePath }` in the request body would be entirely client-chosen.
 *
 * So the sign leg mints a short-lived HMAC-signed ticket over everything it
 * decided (the object key, the declared MIME it allowlisted, the storage
 * namespace it resolved from the caller's contributor role) and the confirm
 * leg refuses anything it did not itself issue. The client cannot forge a path,
 * downgrade the declared MIME to make the sniff pass, or move an upload into
 * the PRIMARY namespace it was not authorised for.
 *
 * The ticket is an *integrity* mechanism, not an authorisation one: confirm
 * still re-runs the full auth + contributor resolution server-side, and still
 * checks that the ticket's subject is the caller. A stolen ticket therefore
 * buys nothing.
 *
 * Server-only — never import from a client component.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** How long a signed upload may sit unconfirmed. Supabase's own signed upload
 *  URLs are valid for 2 hours; this is deliberately much shorter, since the
 *  client PUTs immediately and confirms straight after. */
const TICKET_TTL_SECONDS = 30 * 60;

export type UploadNamespace = "primary" | "secondary";

export interface UploadTicketClaims {
  /** Profile id of the user the sign leg authenticated. */
  sub: string;
  applicationId: string;
  slot: string;
  /** The object key the sign leg minted a signed upload URL for. */
  storagePath: string;
  /** Original (unsanitised) filename, for the Document row. */
  filename: string;
  /** The declared MIME the sign leg checked against ACCEPTED_MIME. */
  mime: string;
  /** Storage namespace resolved from the caller's contributor role. */
  ns: UploadNamespace;
}

interface UploadTicketPayload extends UploadTicketClaims {
  /** Schema version, so a future change can be rejected rather than misread. */
  v: 1;
  /** Issued-at / expires-at, seconds since epoch. */
  iat: number;
  exp: number;
}

/**
 * The signing secret. Reuses the service-role key rather than introducing a new
 * environment variable: it is already required for every Storage operation in
 * this flow, is server-only by construction, and is never exposed to a client
 * (it is not a `NEXT_PUBLIC_*` var). If it rotates, in-flight tickets simply
 * stop verifying — which is the correct behaviour.
 */
function ticketSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — cannot sign document upload tickets."
    );
  }
  return secret;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payloadB64: string): string {
  return base64url(
    createHmac("sha256", ticketSecret()).update(payloadB64).digest()
  );
}

/**
 * Mints a ticket for a freshly-signed upload target.
 *
 * @param claims Everything the sign leg decided server-side.
 * @param now    Injectable clock, for tests.
 */
export function issueUploadTicket(
  claims: UploadTicketClaims,
  now: number = Date.now()
): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: UploadTicketPayload = {
    v: 1,
    ...claims,
    iat: issuedAt,
    exp: issuedAt + TICKET_TTL_SECONDS,
  };

  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export type VerifyUploadTicketResult =
  | { ok: true; claims: UploadTicketClaims }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Verifies a ticket's signature and expiry and returns its claims.
 *
 * Returns a discriminated result rather than throwing so the route can map
 * each failure to the right status without a try/catch around business logic.
 */
export function verifyUploadTicket(
  ticket: unknown,
  now: number = Date.now()
): VerifyUploadTicketResult {
  if (typeof ticket !== "string" || !ticket.includes(".")) {
    return { ok: false, reason: "malformed" };
  }

  const separator = ticket.lastIndexOf(".");
  const payloadB64 = ticket.slice(0, separator);
  const providedSignature = ticket.slice(separator + 1);

  if (!payloadB64 || !providedSignature) {
    return { ok: false, reason: "malformed" };
  }

  // Constant-time comparison; `timingSafeEqual` throws on length mismatch, so
  // the lengths are compared first.
  const expected = Buffer.from(sign(payloadB64));
  const provided = Buffer.from(providedSignature);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as UploadTicketPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    payload?.v !== 1 ||
    typeof payload.sub !== "string" ||
    typeof payload.applicationId !== "string" ||
    typeof payload.slot !== "string" ||
    typeof payload.storagePath !== "string" ||
    typeof payload.filename !== "string" ||
    typeof payload.mime !== "string" ||
    (payload.ns !== "primary" && payload.ns !== "secondary") ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (Math.floor(now / 1000) >= payload.exp) {
    return { ok: false, reason: "expired" };
  }

  const { sub, applicationId, slot, storagePath, filename, mime, ns } = payload;
  return {
    ok: true,
    claims: { sub, applicationId, slot, storagePath, filename, mime, ns },
  };
}
