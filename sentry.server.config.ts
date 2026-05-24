// Sentry initialisation for the Node.js server runtime.
// Loaded by `src/instrumentation.ts` when NEXT_RUNTIME === "nodejs".
// No-ops when no DSN is set (local dev / CI), so it is always safe to import.
import * as Sentry from "@sentry/nextjs";
import pkg from "./package.json";

const { version } = pkg;

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Release name = package.json version (single source of truth, backlog #14).
  // release-please bumps `version`, so UI build-info, error reports, and the
  // Sentry release all line up on the same value.
  release: version,
  // Distinguish prod / preview / local in the Sentry UI.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Performance tracing: sample in production only, conservatively.
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 0,
  // Don't capture local request bodies / headers that may carry PII by default.
  sendDefaultPii: false,
});
