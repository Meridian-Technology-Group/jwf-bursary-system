/**
 * Validate a `next` query parameter for use as an internal redirect target.
 * Shared by /login, /login/mfa and /auth/callback (docs/security-audit.md §2.9).
 *
 * Resolves the value against a throwaway origin and keeps it only when it
 * stays on that origin, so whatever the URL parser does with it (it strips
 * tabs and newlines and treats `\` as `/`) cannot turn it into another host:
 * `/\t/evil.com` resolves to `//evil.com` and is refused (audit 20 Nov 2026,
 * finding 14). Safe in the browser and on the server.
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const u = new URL(raw, "http://x");
    return u.origin === "http://x" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
