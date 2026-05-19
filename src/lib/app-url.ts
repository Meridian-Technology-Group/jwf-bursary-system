/**
 * Resolve the public origin for server-generated links (invite emails,
 * password-reset redirects, etc.) without hardcoding per-environment values.
 *
 * Resolution order:
 *
 *   1. NEXT_PUBLIC_APP_URL              — explicit override (custom domain)
 *   2. VERCEL_PROJECT_PRODUCTION_URL    — stable production alias (only on
 *                                         production deployments — this var
 *                                         is set on previews too, but we
 *                                         don't want preview-originated
 *                                         emails to redirect to prod)
 *   3. VERCEL_BRANCH_URL                — stable per-branch URL (previews)
 *   4. VERCEL_URL                       — per-deployment URL (unique, less stable)
 *   5. http://localhost:3000            — local dev
 *
 * All Vercel system env vars are hostnames (no scheme), so we prepend https://.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
