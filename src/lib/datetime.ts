/**
 * London-aware date/time formatting helpers.
 *
 * The app's audience and operations are UK-based, but the runtime (Vercel,
 * Postgres) is UTC. Formatting without an explicit timeZone renders in the
 * runtime zone, which is one hour behind London during British Summer Time and
 * can roll a just-past-midnight-London timestamp back to the previous day.
 *
 * Always format display timestamps through these helpers so GMT/BST is handled
 * automatically (IANA "Europe/London", not a fixed offset).
 */

export const LONDON_TIME_ZONE = "Europe/London";

/**
 * Full date + 24h time in London, e.g. "05 Jun 2026, 18:03:21".
 * Used for audit-trail timestamps.
 */
export function formatLondonDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Date only in London, e.g. "5 Jun 2026".
 * Used for applications-table submission dates.
 */
export function formatLondonDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
