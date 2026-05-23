// Sentry initialisation for the Edge runtime (middleware, edge routes).
// Loaded by `src/instrumentation.ts` when NEXT_RUNTIME === "edge".
// No-ops when no DSN is set, so it is always safe to import.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
});
