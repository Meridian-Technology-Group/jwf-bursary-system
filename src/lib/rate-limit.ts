/**
 * Rate limiter for sensitive auth endpoints.
 *
 * Uses Upstash Ratelimit on top of Vercel KV (Upstash Redis under the hood).
 * Configured for 5 requests per 15-minute fixed window, keyed by IP.
 *
 * Required env vars:
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * If KV is not configured (e.g. local dev without KV), the limiter is a
 * no-op that always allows — we log a warning once at module load so the
 * absence is visible during development.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const WINDOW = "15 m" as const;
const MAX_REQUESTS = 5;

const kvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

if (!kvConfigured && process.env.NODE_ENV !== "test") {
  console.warn(
    "[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN not set — rate limiting is DISABLED."
  );
}

const limiter = kvConfigured
  ? new Ratelimit({
      redis: kv,
      limiter: Ratelimit.fixedWindow(MAX_REQUESTS, WINDOW),
      analytics: false,
      prefix: "rl:auth",
    })
  : null;

/**
 * Extract a best-effort client IP from request headers.
 * Vercel sets x-forwarded-for; falls back to x-real-ip then "unknown".
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for is a comma-separated list; first entry is the client.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Check the rate limit for a given identifier (typically `${action}:${ip}`).
 * Returns `{ success: true }` if KV is not configured (fail-open in dev).
 */
export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) {
    return {
      success: true,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      reset: 0,
    };
  }
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export const RATE_LIMIT_MESSAGE =
  "Too many attempts, try again in 15 minutes.";
