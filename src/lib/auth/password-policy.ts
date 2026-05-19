/**
 * Password strength validation.
 *
 * Enforces a 12-character minimum and checks the password against the
 * Have I Been Pwned (HIBP) Pwned Passwords database using the k-anonymity
 * API: only the first 5 characters of the SHA-1 hash are sent.
 *
 * Fail-open behaviour: if the HIBP API is unreachable, we log and allow
 * the password — we never block registration / reset on a network outage.
 */

const MIN_PASSWORD_LENGTH = 12;
const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Compute the SHA-1 hex digest (uppercase) of the input string.
 * Uses Web Crypto when available (Edge / modern Node), falls back to
 * Node's crypto module otherwise.
 */
async function sha1Hex(input: string): Promise<string> {
  // Prefer Web Crypto (available in Node 20+ globalThis.crypto and Edge runtime).
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const buf = await globalThis.crypto.subtle.digest("SHA-1", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  // Fallback for older Node runtimes.
  const { createHash } = await import("crypto");
  return createHash("sha1").update(input).digest("hex").toUpperCase();
}

/**
 * Check a password against the HIBP Pwned Passwords k-anonymity API.
 * Returns the breach count (0 if not found). Throws on network error.
 */
async function checkHibpBreachCount(password: string): Promise<number> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
    // Short timeout via AbortController so we don't hang registration.
    signal: AbortSignal.timeout(3000),
    headers: { "Add-Padding": "true" },
  });

  if (!res.ok) {
    throw new Error(`HIBP responded ${res.status}`);
  }

  const body = await res.text();
  for (const line of body.split("\n")) {
    const [lineSuffix, countStr] = line.trim().split(":");
    if (lineSuffix === suffix) {
      const count = parseInt(countStr ?? "0", 10);
      return Number.isFinite(count) ? count : 0;
    }
  }
  return 0;
}

/**
 * Validate password strength.
 *
 * - Rejects passwords shorter than 12 characters.
 * - Rejects passwords found in the HIBP breach corpus.
 * - Fails open on HIBP network errors (logs and allows).
 */
export async function validatePasswordStrength(
  password: string
): Promise<PasswordValidationResult> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  try {
    const count = await checkHibpBreachCount(password);
    if (count > 0) {
      return {
        ok: false,
        reason:
          "This password has appeared in a known data breach. Please choose a different password.",
      };
    }
  } catch (err) {
    // Fail-open: log but allow. HIBP outage must not block registration.
    console.warn(
      "[password-policy] HIBP check failed, allowing password:",
      err instanceof Error ? err.message : err
    );
  }

  return { ok: true };
}
