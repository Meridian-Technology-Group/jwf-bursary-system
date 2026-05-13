// src/lib/log.ts
// Tiny dependency-free structured logger.
//
// Emits a single line of JSON per event so logs are easily parsed by hosting
// platforms (Vercel, Datadog, etc.). Designed to avoid logging PII: callers
// should hash recipient emails via `hashEmail` and never pass raw error
// objects (use `logError` which extracts only the message + a stack hash).

import { createHash } from "crypto";

/**
 * Returns the first 12 hex characters of the SHA-256 of the (lower-cased,
 * trimmed) email. Stable across runs but not reversible.
 */
export function hashEmail(email: string): string {
  const normalised = (email ?? "").trim().toLowerCase();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 12);
}

/**
 * Emit a structured info-level log line.
 */
export function logInfo(
  event: string,
  fields: Record<string, unknown>
): void {
  const line = {
    ts: new Date().toISOString(),
    level: "info",
    event,
    ...fields,
  };
  console.log(JSON.stringify(line));
}

/**
 * Emit a structured error-level log line.
 *
 * Never logs the raw error object — only the message and a short hash of the
 * stack trace, so sensitive content inside an exception cannot leak into logs.
 */
export function logError(
  event: string,
  err: unknown,
  fields?: Record<string, unknown>
): void {
  let message: string;
  let stack: string;

  if (err instanceof Error) {
    message = err.message;
    stack = err.stack ?? "";
  } else if (typeof err === "string") {
    message = err;
    stack = "";
  } else {
    message = "Non-Error value thrown";
    stack = "";
  }

  const stackHash = createHash("sha256")
    .update(stack)
    .digest("hex")
    .slice(0, 16);

  const line = {
    ts: new Date().toISOString(),
    level: "error",
    event,
    message,
    stackHash,
    ...(fields ?? {}),
  };
  console.error(JSON.stringify(line));
}
