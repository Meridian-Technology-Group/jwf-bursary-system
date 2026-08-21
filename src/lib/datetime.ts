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

/**
 * Formats a plain `YYYY-MM-DD` calendar-date string (no time component, e.g.
 * from a `<input type="date">`) the same way as `formatLondonDate`, without
 * risking a timezone rollover. Parsing the string at UTC midnight and
 * formatting in Europe/London would be fine on its own, but going via midday
 * UTC keeps this correct even if a caller re-parses the display value.
 */
export function formatLondonDateString(dateStr: string): string {
  return formatLondonDate(new Date(`${dateStr}T12:00:00Z`));
}

/**
 * Converts a `YYYY-MM-DD` calendar date in Europe/London (e.g. from a queue
 * filter's date input) to the UTC instant of the START of that day in London
 * (00:00:00.000 local). Used for inclusive "from" date-range bounds so a
 * boundary day is fully included regardless of GMT/BST (§7.1).
 */
export function londonStartOfDayUtc(dateStr: string): Date {
  const [year, month, day] = parseYmd(dateStr);
  return londonWallClockToUtc(year, month, day, 0, 0, 0, 0);
}

/**
 * Converts a `YYYY-MM-DD` calendar date in Europe/London to the UTC instant of
 * the END of that day in London (23:59:59.999 local). Used for inclusive "to"
 * date-range bounds (§7.1) — mirrors the end-of-day normalisation already used
 * for round/application submission deadlines (`src/lib/rounds/submission-deadline.ts`),
 * but London-zone-aware rather than server-local-zone.
 */
export function londonEndOfDayUtc(dateStr: string): Date {
  const [year, month, day] = parseYmd(dateStr);
  return londonWallClockToUtc(year, month, day, 23, 59, 59, 999);
}

function parseYmd(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.split("-").map(Number);
  return [year, month, day];
}

/**
 * Resolves a London wall-clock date + time to the UTC instant it represents,
 * without a timezone library. `Intl.DateTimeFormat` can render a UTC instant
 * AS London wall-clock time, but not the reverse, so this inverts it:
 *   1. Guess the instant is simply the wall-clock time taken as UTC.
 *   2. Render that guess in Europe/London and read back its wall-clock parts.
 *   3. The difference between the two is the London UTC offset (0 or 60 min)
 *      in effect at that moment — subtract it from the guess to correct it.
 * Accurate for every date except the ~1-hour window spanning the GMT/BST
 * clock-change instant itself, which is an acceptable precision trade-off for
 * a date-only (not time-of-day) filter boundary.
 */
function londonWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(guess));
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const displayedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
    ms
  );
  const offsetMs = displayedAsUtc - guess;
  return new Date(guess - offsetMs);
}
