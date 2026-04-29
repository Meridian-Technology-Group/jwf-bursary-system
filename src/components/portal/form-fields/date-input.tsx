"use client";

/**
 * DateInput — masked text input for date entry (DD/MM/YYYY).
 *
 * Typing behaviour:
 *   - Digits are entered freely; slashes are inserted automatically after
 *     position 2 (day) and position 5 (month) so the display always stays in
 *     DD/MM/YYYY format while the user just types digits.
 *   - Backspace / Delete work naturally against the masked string.
 *
 * Paste normalisation (on the input element's onPaste event):
 *   - "21111980"       → digits-only → treated as DDMMYYYY
 *   - "21/11/1980"     → DD/MM/YYYY (already canonical)
 *   - "21-11-1980"     → DD-MM-YYYY
 *   - "1980-11-21"     → YYYY-MM-DD ISO (unambiguous, reversed)
 *
 * Form value is always stored as YYYY-MM-DD or "" so downstream schemas and
 * persistence do not need to change.
 *
 * On blur: validates that the date is a real calendar date (e.g. rejects
 * 31/02/1990) and that the year is within [minYear, maxYear].
 *
 * Integrates with react-hook-form via Controller.
 */

import * as React from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  Controller,
} from "react-hook-form";
import { isValid, parse, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  /**
   * Earliest acceptable year (inclusive).
   * Default: 1900  (suitable for DOB fields).
   */
  minYear?: number;
  /**
   * Latest acceptable year (inclusive).
   * Default: current year + 1.
   */
  maxYear?: number;
  // Legacy aliases kept so existing callers that pass fromYear / toYear don't
  // need to change.  fromYear → minYear, toYear → maxYear.
  /** @deprecated Use minYear */
  fromYear?: number;
  /** @deprecated Use toYear */
  toYear?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THIS_YEAR = new Date().getFullYear();

/**
 * Given a raw ISO value from form state (YYYY-MM-DD or ""), return the display
 * string (DD/MM/YYYY or "").
 */
function isoToDisplay(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Given a display string like "21/11/1980", return the ISO string
 * "1980-11-21".  Returns "" if the display string is not a complete
 * DD/MM/YYYY.
 */
function displayToIso(display: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Apply the DD/MM/YYYY mask to a raw digit string (max 8 digits).
 * Returns the formatted string, e.g. "211" → "21/1", "21111980" → "21/11/1980".
 */
function applyMask(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Strip everything except digits from a string.
 */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Normalise a pasted string into a display value (DD/MM/YYYY) or return null
 * if we cannot confidently parse it.
 *
 * Supported formats:
 *   "21111980"       digits-only   → DDMMYYYY
 *   "21/11/1980"     DD/MM/YYYY
 *   "21-11-1980"     DD-MM-YYYY
 *   "1980-11-21"     YYYY-MM-DD (ISO)
 */
function normalisePaste(raw: string): string | null {
  const trimmed = raw.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, mo, d] = trimmed.split("-");
    return `${d}/${mo}/${y}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  if (dmy) {
    const [, d, mo, y] = dmy;
    return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}`;
  }

  // Digits only: DDMMYYYY
  const digits = digitsOnly(trimmed);
  if (digits.length === 8) {
    return applyMask(digits);
  }

  return null;
}

/**
 * Validate a display string (DD/MM/YYYY).  Returns an error message, or null
 * if valid.
 */
function validateDisplay(
  display: string,
  minYear: number,
  maxYear: number
): string | null {
  if (!display) return null; // empty → let "required" schema handle it

  if (display.length < 10) return "Please enter a complete date (DD/MM/YYYY)";

  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return "Enter date as DD/MM/YYYY";

  const [, dd, mm, yyyy] = m;
  const year = parseInt(yyyy, 10);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);

  if (year < minYear || year > maxYear) {
    return `Year must be between ${minYear} and ${maxYear}`;
  }

  // parse with date-fns — it correctly rejects out-of-range days/months
  // (e.g. 31 Feb, month 13, etc.)
  const parsed = parse(`${dd}/${mm}/${yyyy}`, "dd/MM/yyyy", new Date());
  if (!isValid(parsed) || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) {
    return "Please enter a valid calendar date";
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  disabled = false,
  className,
  required = false,
  minYear,
  maxYear,
  fromYear,
  toYear,
}: DateInputProps<TFieldValues, TName>) {
  const resolvedMinYear = minYear ?? fromYear ?? 1900;
  const resolvedMaxYear = maxYear ?? toYear ?? THIS_YEAR + 1;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // Local display state lives here so we can drive the raw text input
        // independently of the ISO form value.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [display, setDisplay] = React.useState<string>(
          () => isoToDisplay(field.value as string | undefined)
        );

        // Local blur-time validation error (calendar date check).  Zod schema
        // errors (required / format) come from fieldState.error.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [localError, setLocalError] = React.useState<string | null>(null);

        // Keep display in sync if the form value is programmatically set
        // (e.g. when the user picks from the calendar popover).
        // eslint-disable-next-line react-hooks/rules-of-hooks
        React.useEffect(() => {
          const iso = field.value as string | undefined;
          const expected = isoToDisplay(iso);
          setDisplay((prev) => {
            // Only update display if the ISO round-trip would produce a
            // different display value (avoids resetting mid-typing).
            if (displayToIso(prev) !== (iso ?? "")) return expected;
            return prev;
          });
        }, [field.value]);

        const schemaError = fieldState.error?.message ?? null;
        const visibleError = localError ?? schemaError;
        const hasError = !!visibleError;

        // ── Handlers ──────────────────────────────────────────────────────────

        function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
          const raw = e.target.value;

          // Allow full deletion
          if (raw === "") {
            setDisplay("");
            setLocalError(null);
            field.onChange("");
            return;
          }

          // Strip non-digits and re-apply mask
          const digits = digitsOnly(raw);
          const masked = applyMask(digits);
          setDisplay(masked);
          setLocalError(null);

          // Push ISO to form only when we have a complete date
          const iso = displayToIso(masked);
          field.onChange(iso !== "" ? iso : "");
        }

        function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text");
          const normalised = normalisePaste(pasted);
          if (normalised !== null) {
            setDisplay(normalised);
            setLocalError(null);
            const iso = displayToIso(normalised);
            field.onChange(iso !== "" ? iso : "");
          }
          // If we couldn't parse the paste, we leave the field unchanged.
        }

        function handleBlur() {
          const err = validateDisplay(display, resolvedMinYear, resolvedMaxYear);
          setLocalError(err);
          field.onBlur();
        }

        function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
          // Allow: Backspace, Delete, Tab, Arrow keys, Ctrl/Cmd combos
          const allowed = [
            "Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight",
            "ArrowUp", "ArrowDown", "Home", "End",
          ];
          if (allowed.includes(e.key)) return;
          if (e.ctrlKey || e.metaKey) return;
          // Block non-digit characters (the mask only needs digits)
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
          }
        }

        // ── Calendar popover handler ──────────────────────────────────────────

        function handleCalendarSelect(date: Date | undefined) {
          if (!date) return;
          const iso = format(date, "yyyy-MM-dd");
          field.onChange(iso);
          setLocalError(null);
          // display will sync via useEffect
        }

        // Derive a Date object for the calendar from the current ISO value
        const calendarDate: Date | undefined = (() => {
          const iso = field.value as string | undefined;
          if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
          const d = parse(iso, "yyyy-MM-dd", new Date());
          return isValid(d) ? d : undefined;
        })();

        const inputId = `date-input-${String(name).replace(/\./g, "-")}`;

        return (
          <div className={cn("space-y-1.5", className)}>
            {/* Label */}
            <label
              htmlFor={inputId}
              className={cn(
                "block text-sm font-medium",
                hasError ? "text-error-600" : "text-slate-700"
              )}
            >
              {label}
              {required && (
                <span className="ml-0.5 text-error-600" aria-hidden="true">
                  *
                </span>
              )}
            </label>

            {description && (
              <p className="text-xs text-slate-500">{description}</p>
            )}

            {/* Input row */}
            <div className="flex items-center gap-1.5">
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={display}
                onChange={handleChange}
                onPaste={handlePaste}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-invalid={hasError}
                aria-describedby={hasError ? `${inputId}-error` : undefined}
                autoComplete="off"
                maxLength={10}
                className={cn(
                  "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-offset-0",
                  "transition-colors placeholder:text-slate-400",
                  hasError
                    ? "border-error-600 focus:ring-error-300"
                    : "border-slate-300 focus:border-accent-500 focus:ring-accent-200",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              />

              {/* Secondary affordance: calendar popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label="Open calendar picker"
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-white",
                      "focus:outline-none focus:ring-2 focus:ring-offset-0",
                      "transition-colors",
                      hasError
                        ? "border-error-600 focus:ring-error-300"
                        : "border-slate-300 hover:bg-slate-50 focus:border-accent-500 focus:ring-accent-200",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={calendarDate}
                    onSelect={handleCalendarSelect}
                    defaultMonth={
                      calendarDate ?? new Date(resolvedMaxYear, 0)
                    }
                    startMonth={new Date(resolvedMinYear, 0)}
                    endMonth={new Date(resolvedMaxYear, 11)}
                    disabled={disabled}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Error message */}
            {hasError && (
              <p
                id={`${inputId}-error`}
                role="alert"
                className="text-xs font-medium text-error-600"
              >
                {visibleError}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
