// Next.js instrumentation hook. Next calls `register()` once per server
// runtime at startup; we use it to initialise Sentry for the matching runtime.
// `onRequestError` forwards errors thrown in React Server Components / route
// handlers (which Next surfaces via this hook) to Sentry.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
