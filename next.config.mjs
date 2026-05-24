import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

// Security headers applied to every response. See docs/security-audit.md §2.5.
// NOTE: script-src/style-src currently include 'unsafe-inline' for compatibility
// with Next.js inline bootstrap scripts and Tailwind-generated styles.
// TODO(post-launch): tighten to a nonce-based policy once the React tree allows it.
// Next.js dev mode (React Refresh runtime) uses eval; in `next dev` only we add
// 'unsafe-eval' so the dev server actually hydrates. Production CSP unchanged.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      // api.pwnedpasswords.com is the HaveIBeenPwned k-anonymity range API
      // queried client-side during registration to reject breached passwords.
      // *.sentry.io is the Sentry ingest endpoint the browser SDK POSTs events
      // to; without it the CSP blocks client-side error reporting.
      "connect-src 'self' https://*.supabase.co https://api.pwnedpasswords.com https://*.sentry.io",
      // Inline document preview embeds presigned Supabase Storage URLs in an
      // iframe; without frame-src the browser falls back to default-src 'self'
      // and blocks the preview.
      "frame-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  // `next build` runs ESLint as part of its pipeline. The codebase has
  // pre-existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
  // directives that reference a rule not loaded by `next/core-web-vitals`,
  // which next build treats as a hard error. Skip lint at build time;
  // CI runs `npm run lint` separately (non-blocking) for visibility.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Required on Next 14 for `src/instrumentation.ts` (Sentry init) to run.
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Wrap with Sentry. Source maps upload only when SENTRY_AUTH_TOKEN is present
// (set in the Vercel Production/Preview envs), so local and CI builds — which
// have no token — build normally and skip the upload step.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Do not auto-tunnel through the app: the strict CSP allows *.sentry.io
  // directly, and a tunnel route would need a middleware carve-out.
});
