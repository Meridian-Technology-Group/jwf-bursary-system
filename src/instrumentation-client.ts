// Sentry initialisation for the browser. Next.js loads this on the client.
// No-ops when no DSN is set, so local dev / CI never send events.
// Session Replay is intentionally NOT enabled, which keeps the Content-Security
// -Policy tight (no worker-src/blob: needed) — see next.config.mjs.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
});
