/**
 * Inactivity / session-timeout configuration (Epic 11, D20).
 *
 * Pure resolver for the optional client-side idle-logout policy. Holds no React
 * and no browser APIs so the timing/parsing logic can be unit-tested without a
 * DOM. The watcher component (`<IdleLogoutWatcher>`) consumes the resolved
 * `IdleTimeoutConfig` and does the actual event-listening + sign-out.
 *
 * Design goals (plan 11 §5.3):
 *  - Genuinely optional: a single flag disables the whole feature.
 *  - Configurable window with a sensible default (30 min) — the exact idle
 *    window is **D20, TBC by Charlotte**; this is the swap-point.
 *  - Warn-then-logout: a short countdown is shown before the forced sign-out so
 *    an active-but-idle user can stay signed in.
 *
 * NB this is a UX convenience, not a hard security control — a client-side timer
 * can be bypassed. The authoritative session boundary remains the Supabase token
 * expiry checked in `middleware.ts` via `getUser()`. If a security-grade absolute
 * timeout is required, shorten the Supabase JWT TTL instead (see plan 11 §5.3).
 *
 * ── Env vars (NEXT_PUBLIC_*, because the watcher runs in the browser) ──────────
 *  - NEXT_PUBLIC_SESSION_IDLE_ENABLED  "false"/"0" → disabled. Default: ENABLED.
 *  - NEXT_PUBLIC_SESSION_IDLE_MINUTES  whole minutes of inactivity before
 *      sign-out. Default: 30. Clamped to [1, 720]; malformed → default.
 *  - NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS  warning-countdown length in seconds.
 *      Default: 60. Clamped to [5, idleMs - 1s]; malformed → default.
 */

/** Default idle window in minutes. D20 — Charlotte to confirm the real window. */
export const DEFAULT_IDLE_MINUTES = 30;
/** Default warning-countdown length in seconds, shown before the forced logout. */
export const DEFAULT_WARN_SECONDS = 60;

const MIN_IDLE_MINUTES = 1;
const MAX_IDLE_MINUTES = 720; // 12h ceiling guards against absurd config.
const MIN_WARN_SECONDS = 5;

export interface IdleTimeoutConfig {
  /** Whether the idle watcher should run at all. */
  enabled: boolean;
  /** Total inactivity before sign-out, in milliseconds. */
  idleMs: number;
  /**
   * How long before sign-out the warning is shown, in milliseconds. The warning
   * therefore appears at `idleMs - warnMs` of inactivity. Always < `idleMs`.
   */
  warnMs: number;
}

/** Parse a whole-number env value, returning `null` for unset/blank/malformed. */
function parseIntOrNull(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Reject anything that isn't a plain non-negative integer ("12.5", "30m"…).
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

/** Clamp `n` into `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Is the feature disabled by its flag? Default is ENABLED (only "false"/"0" disable). */
function isDisabledByFlag(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "") return false;
  return v === "false" || v === "0" || v === "off" || v === "no";
}

/**
 * Resolve the idle-timeout config from a plain env-like record. Exposed (rather
 * than reading `process.env` directly) so tests can drive every branch without
 * mutating global env.
 */
export function resolveIdleTimeoutConfig(
  env: Record<string, string | undefined> = process.env
): IdleTimeoutConfig {
  const enabled = !isDisabledByFlag(env.NEXT_PUBLIC_SESSION_IDLE_ENABLED);

  const minutes = clamp(
    parseIntOrNull(env.NEXT_PUBLIC_SESSION_IDLE_MINUTES) ?? DEFAULT_IDLE_MINUTES,
    MIN_IDLE_MINUTES,
    MAX_IDLE_MINUTES
  );
  const idleMs = minutes * 60_000;

  // Warning must fit strictly inside the idle window (leave ≥1s of real idle
  // time before the warning appears), so clamp its upper bound to idleMs - 1s.
  const warnSecondsRaw =
    parseIntOrNull(env.NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS) ??
    DEFAULT_WARN_SECONDS;
  const maxWarnSeconds = Math.max(MIN_WARN_SECONDS, idleMs / 1000 - 1);
  const warnSeconds = clamp(warnSecondsRaw, MIN_WARN_SECONDS, maxWarnSeconds);
  const warnMs = Math.round(warnSeconds * 1000);

  return { enabled, idleMs, warnMs };
}
