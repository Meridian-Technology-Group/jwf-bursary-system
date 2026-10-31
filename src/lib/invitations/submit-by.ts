/**
 * Per-invitation "Submit by" date (licence fix, 14 Oct 2026).
 *
 * Charlotte sets each family's submission date by hand when she sends the
 * invitation (e.g. on 9 Nov she invites 21 sixth-form families, each due
 * 16 Nov). Until now there was nowhere to put it: she edited the round's
 * NA_CURRENT window before each send, which only changed the email's
 * {{deadline}} while the portal lockout fell through to the round close date.
 *
 * The date lives on `Invitation.submissionDeadlineAt` and is:
 *   - validated here (not in the past, Europe/London; not after the target
 *     round's closeDate — her rule: "inside the round's dates");
 *   - stored as the END of the chosen day in Europe/London;
 *   - the email's {{deadline}} when set (`emailDeadlineOverride`);
 *   - copied to `Application.submissionDeadlineAt` — the per-application
 *     override the portal, submit guard and queue already enforce — when the
 *     application is created from the invitation, never over an override that
 *     is already set (`applicationDeadlineFromInvitation`).
 *
 * Pure module: no DB, no clock reads (callers pass `now`).
 */

export const SUBMIT_BY_TIME_ZONE = "Europe/London";

/** The form field every send path uses for the date (`yyyy-MM-dd`). */
export const SUBMIT_BY_FIELD = "submitBy";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day (`yyyy-MM-dd`) an instant falls on in Europe/London. */
export function londonDateKey(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SUBMIT_BY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The calendar day of a `@db.Date` column (Prisma returns it as UTC midnight),
 * as `yyyy-MM-dd`.
 */
export function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Minutes Europe/London is ahead of UTC at `instant` (0 in GMT, 60 in BST). */
function londonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SUBMIT_BY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * The last millisecond (23:59:59.999) of a `yyyy-MM-dd` day in Europe/London,
 * as a UTC instant. Throws on a malformed key.
 */
export function endOfLondonDay(ymd: string): Date {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`Not a yyyy-MM-dd date: ${ymd}`);
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  // The offset at 23:59 London is the same as at 23:59 UTC on that day (clocks
  // change at 01:00 UTC), so one correction is exact.
  return new Date(asUtc - londonOffsetMinutes(new Date(asUtc)) * 60000);
}

export type SubmitByResult =
  | { ok: true; submitBy: Date | null }
  | { ok: false; error: string };

/** A `yyyy-MM-dd` day as `dd/MM/yyyy` (how the emails show dates). */
export function submitByDisplay(ymd: string): string {
  const [y, mo, d] = ymd.split("-");
  return `${d}/${mo}/${y}`;
}

/**
 * Validates the optional "Submit by" form value for one send (or one batch).
 *
 * @param raw        the `yyyy-MM-dd` value from a date input; blank/absent = none
 * @param closeDate  the target round's closeDate (`@db.Date`), or null when the
 *                   invitation has no round (then a date cannot be set)
 * @param now        the send instant
 * @returns `submitBy` = end of that day in Europe/London, or null when blank
 */
export function parseInvitationSubmitBy(
  raw: string | null | undefined,
  closeDate: Date | null,
  now: Date
): SubmitByResult {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: true, submitBy: null };

  const m = YMD.exec(value);
  if (!m) return { ok: false, error: "Enter the submit-by date as a full date." };
  // Reject impossible days (e.g. 2026-02-31) rather than letting Date roll them.
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dateOnlyKey(probe) !== value) {
    return { ok: false, error: "Enter the submit-by date as a real date." };
  }

  if (value < londonDateKey(now)) {
    return { ok: false, error: "The submit-by date cannot be in the past." };
  }
  if (!closeDate) {
    return {
      ok: false,
      error: "A submit-by date needs a round: this invitation has none.",
    };
  }
  const close = dateOnlyKey(closeDate);
  if (value > close) {
    return {
      ok: false,
      error: `The submit-by date must be on or before the round's close date (${submitByDisplay(close)}).`,
    };
  }
  return { ok: true, submitBy: endOfLondonDay(value) };
}

/**
 * The deadline an application created from an invitation starts with: the
 * override already on the application wins (never overwritten), else the
 * invitation's date, else null (the round chain applies).
 */
export function applicationDeadlineFromInvitation(
  existingOverride: Date | null | undefined,
  invitationSubmitBy: Date | null | undefined
): Date | null {
  return existingOverride ?? invitationSubmitBy ?? null;
}

/**
 * The per-application override to resolve an invitation email's {{deadline}}
 * with: the linked application's own override when there is one (that is what
 * the portal enforces), else the invitation's date, else null — and null means
 * the existing round chain fills it.
 */
export function emailDeadlineOverride(
  invitationSubmitBy: Date | null | undefined,
  applicationOverride: Date | null | undefined = null
): Date | null {
  return applicationOverride ?? invitationSubmitBy ?? null;
}

/** Today in Europe/London as `yyyy-MM-dd` — the `min` for a date input. */
export function submitByMinValue(now: Date): string {
  return londonDateKey(now);
}

/**
 * Her 30–31 Oct 2026 answer: new and internal invitations are usually due
 * 7 days after they are sent, so the form fills that in (still editable).
 */
export const DEFAULT_SUBMIT_BY_DAYS = 7;

/**
 * The "Submit by" value a send form starts with: 7 days after today in
 * Europe/London for NEW and INTERNAL (a null situation is a legacy NEW
 * contact), blank for ROLLING_OVER, which shares the round's one deadline.
 */
export function defaultSubmitByValue(
  situation: "NEW" | "INTERNAL" | "ROLLING_OVER" | null | undefined,
  now: Date
): string {
  if (situation === "ROLLING_OVER") return "";
  const [y, m, d] = londonDateKey(now).split("-").map(Number);
  return dateOnlyKey(new Date(Date.UTC(y, m - 1, d + DEFAULT_SUBMIT_BY_DAYS)));
}
