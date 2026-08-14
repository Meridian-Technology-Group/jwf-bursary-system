/**
 * number-entry — the ONE implementation of applicant-facing number-entry
 * behaviour. Every numeric input in the portal routes through here.
 *
 * Two behaviours, always applied together:
 *
 *  1. **Select-all on focus.** Numeric fields default to `0`, so without this
 *     the applicant has to delete the zero before typing. rAF works around
 *     mobile browsers that reset the selection immediately after the focus
 *     event.
 *  2. **No leading-zero accumulation.** If (1) is defeated — a mobile browser
 *     that drops the selection, or a tap that lands the caret after the zero —
 *     the digits must still not pile up behind it. £15,000 entered as
 *     `0` → `01` → `015` … must read 1, 15, 150, 1,500, 15,000, never
 *     "£0,001 → £0,015 → £0,150 → £01,500" (CF-18).
 *
 * These two halves were previously copy-pasted per field, which is how they
 * drifted apart: `CurrencyInput` got both, the three raw count inputs got only
 * the focus half, and the fix was reported as landing on some fields and not
 * others. There is deliberately no second copy — `CurrencyInput` and
 * `CountInput` are the only numeric inputs, and both import from this module.
 * `__tests__/number-entry.test.ts` fails the build if a fork reappears.
 */

import type { FocusEvent } from "react";

/**
 * Select the field's whole value on focus so the first keystroke replaces the
 * default `0` (or an existing amount) instead of appending to it.
 *
 * The element is captured synchronously: React nulls `currentTarget` once the
 * handler returns, so it cannot be read from inside the rAF callback.
 */
export function selectAllOnFocus(event: FocusEvent<HTMLInputElement>): void {
  const el = event.currentTarget;
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => el.select());
    return;
  }
  el.select();
}

/**
 * Drop leading zeros from a run of digits. A lone `0` is preserved (it is a
 * legitimate answer — "enter 0 where this does not apply"), and so is the `0`
 * in `0.5`, because the caller passes only the integer part.
 */
export function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

/** Reduce raw input to whole-number digits, without leading-zero accumulation. */
export function sanitizeCount(input: string): string {
  return stripLeadingZeros(input.replace(/\D/g, ""));
}

/**
 * Parse a count field's raw input to a whole number. An emptied field reads as
 * `undefined` so the caller decides what a blank means (the portal's count
 * fields treat it as 0, matching the behaviour they had before extraction).
 */
export function parseCount(input: string): number | undefined {
  const digits = sanitizeCount(input);
  if (digits === "") return undefined;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
