/**
 * "Remember this browser" for staff MFA (B8).
 *
 * Supabase holds the assurance level on the session, so every new sign-in
 * starts at aal1. After a successful TOTP check we set a signed cookie; while
 * it is valid, an aal1 staff session on the same browser counts as MFA'd.
 *
 * The cookie stops counting (code asked again) when:
 *  - it is older than MFA_TRUST_DAYS;
 *  - it was issued to a different user;
 *  - the TOTP factor it names is gone (admin "Reset MFA", re-enrolment);
 *  - the browser family changes (user-agent, version numbers ignored so
 *    browser auto-updates don't re-prompt);
 *  - the sign-in country changes (Vercel's x-vercel-ip-country).
 *
 * Without MFA_TRUST_SECRET (≥32 chars) nothing is issued or accepted, so
 * every sign-in asks for a code — fail closed.
 *
 * Web Crypto only, so it runs in Edge middleware and Node alike.
 */

export const MFA_TRUST_COOKIE = "jwf_mfa_trust";
export const MFA_TRUST_DAYS = 30;
export const MFA_TRUST_MAX_AGE_SECONDS = MFA_TRUST_DAYS * 24 * 60 * 60;

export interface MfaTrustContext {
  userId: string;
  userAgent: string | null;
  country: string | null;
}

interface Payload {
  u: string; // user id
  f: string; // TOTP factor id
  b: string; // browser hash
  c: string; // country
  e: number; // expiry, epoch seconds
}

const encoder = new TextEncoder();

function getSecret(secret = process.env.MFA_TRUST_SECRET): string | null {
  return secret && secret.length >= 32 ? secret : null;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function browserHash(userAgent: string | null): Promise<string> {
  // Drop version numbers so a browser auto-update keeps the trust.
  const family = (userAgent ?? "").replace(/[\d._]+/g, "");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(family));
  return b64url(new Uint8Array(digest)).slice(0, 22);
}

/** Returns the cookie value, or null when no secret is configured. */
export async function signMfaTrust(
  ctx: MfaTrustContext & { factorId: string },
  opts: { secret?: string; now?: number } = {},
): Promise<string | null> {
  const secret = getSecret(opts.secret);
  if (!secret) return null;
  const payload: Payload = {
    u: ctx.userId,
    f: ctx.factorId,
    b: await browserHash(ctx.userAgent),
    c: ctx.country ?? "",
    e: Math.floor((opts.now ?? Date.now()) / 1000) + MFA_TRUST_MAX_AGE_SECONDS,
  };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** True only for a well-formed, unexpired cookie matching this user, browser, country and a live factor. */
export async function verifyMfaTrust(
  token: string | undefined | null,
  ctx: MfaTrustContext & { verifiedFactorIds: string[] },
  opts: { secret?: string; now?: number } = {},
): Promise<boolean> {
  const secret = getSecret(opts.secret);
  if (!secret || !token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(sig),
      encoder.encode(body),
    );
    if (!ok) return false;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Payload;
    return (
      p.u === ctx.userId &&
      ctx.verifiedFactorIds.includes(p.f) &&
      p.c === (ctx.country ?? "") &&
      p.e > Math.floor((opts.now ?? Date.now()) / 1000) &&
      p.b === (await browserHash(ctx.userAgent))
    );
  } catch {
    return false;
  }
}

/** Verified TOTP factor ids from a Supabase user object (getUser() includes them). */
export function verifiedFactorIds(user: {
  factors?: Array<{ id: string; status: string }> | null;
}): string[] {
  return (user.factors ?? []).filter((f) => f.status === "verified").map((f) => f.id);
}
