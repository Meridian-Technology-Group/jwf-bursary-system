/**
 * Resolve the public origin for server-generated links (invite emails,
 * password-reset redirects, etc.) without hardcoding per-environment values.
 *
 * Resolution order:
 *
 *   1. NEXT_PUBLIC_APP_URL          — explicit override (production domain)
 *   2. VERCEL_BRANCH_URL            — stable per-branch URL (preview deploys)
 *   3. VERCEL_URL                   — per-deployment URL (unique, less stable)
 *   4. http://localhost:3000        — local dev
 *
 * All Vercel system env vars are hostnames (no scheme), so we prepend https://.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
