"use client";

/**
 * CurrencyInput — £-prefixed, right-aligned, tabular-nums input.
 *
 * Integrates with react-hook-form via Controller.
 * Uses inputMode="decimal" (not type="number") for better mobile UX.
 *
 * The displayed value is masked with thousands separators (commas) as the user
 * types, while the value stored in form state stays comma-free so Zod's
 * `z.coerce.number` still parses it. Typed or pasted commas (and any stray
 * currency symbols / spaces) are tolerated and stripped.
 */

import * as React from "react";
import {
  type Control,
  type ControllerRenderProps,
  type ControllerFieldState,
  type FieldPath,
  type FieldValues,
  Controller,
} from "react-hook-form";
import { cn } from "@/lib/utils";

/** Strip everything but digits and keep at most one decimal point. */
export function sanitizeCurrency(input: string): string {
  let s = input.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  // Strip leading zeros from the integer part so typing after a default "0"
  // (e.g. "0" then "15000") doesn't accumulate as "015,000". A lone "0" and a
  // leading zero before a decimal point ("0.5") are preserved.
  const dot = s.indexOf(".");
  const intPart = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const rest = dot === -1 ? "" : s.slice(dot);
  return intPart + rest;
}

/** Format a sanitized/numeric value with thousands separators for display. */
export function formatCurrencyDisplay(value: unknown): string {
  if (value === "" || value === null || value === undefined) return "";
  const raw = sanitizeCurrency(String(value));
  if (raw === "") return "";
  const hasDot = raw.includes(".");
  const [intPart, decPart = ""] = raw.split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasDot ? `${intFormatted}.${decPart}` : intFormatted;
}

/**
 * Count significant characters (digits, plus at most one decimal point) before
 * a caret position — used to preserve the caret across comma re-masking.
 */
function significantBefore(str: string, pos: number): number {
  let n = 0;
  let dotSeen = false;
  for (let i = 0; i < pos && i < str.length; i++) {
    const c = str[i];
    if (c >= "0" && c <= "9") n++;
    else if (c === "." && !dotSeen) {
      n++;
      dotSeen = true;
    }
  }
  return n;
}

/** Map a significant-character count back to a caret index in a formatted string. */
function caretFromSignificant(formatted: string, target: number): number {
  let n = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (n >= target) return i;
    const c = formatted[i];
    if ((c >= "0" && c <= "9") || c === ".") n++;
  }
  return formatted.length;
}

interface CurrencyInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  /**
   * Visually hide the label (kept for screen readers). Used when the field sits
   * in a spreadsheet-style grid whose row already carries a visible label cell.
   */
  hideLabel?: boolean;
}

/**
 * Inner control — split out so we can use hooks (refs / layout effect for caret
 * preservation) which cannot live inside the Controller render callback.
 */
function CurrencyControl<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  description,
  placeholder,
  disabled,
  className,
  required,
  hideLabel,
  name,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  placeholder: string;
  disabled: boolean;
  className?: string;
  required: boolean;
  hideLabel: boolean;
  name: TName;
}) {
  const hasError = !!fieldState.error;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);

  const display = formatCurrencyDisplay(field.value);

  // After each render, restore the caret if a keystroke asked us to.
  React.useLayoutEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      const pos = pendingCaret.current;
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={`currency-${String(name)}`}
        className={cn(
          hideLabel ? "sr-only" : "block text-sm font-medium",
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

      {description && <p className="text-xs text-slate-500">{description}</p>}

      <div className="relative flex min-w-0 items-center">
        {/* £ prefix */}
        <span
          className={cn(
            "inline-flex h-9 items-center rounded-l-md border border-r-0 px-3 text-sm font-medium",
            hasError
              ? "border-error-600 bg-error-50 text-error-600"
              : "border-slate-300 bg-slate-50 text-slate-500"
          )}
          aria-hidden="true"
        >
          £
        </span>

        <input
          ref={inputRef}
          id={`currency-${String(name)}`}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `currency-${String(name)}-error`
              : description
                ? `currency-${String(name)}-desc`
                : undefined
          }
          value={display}
          onFocus={(e) => {
            // Select the whole value on focus so the default "0" (or an existing
            // amount) is replaced by the first keystroke instead of having to be
            // manually deleted first. rAF works around mobile browsers that
            // reset the selection immediately after the focus event.
            const el = e.target;
            requestAnimationFrame(() => el.select());
          }}
          onChange={(e) => {
            const el = e.target;
            const typed = el.value;
            const caret = el.selectionStart ?? typed.length;
            const sanitized = sanitizeCurrency(typed);
            // Where should the caret land after re-masking with commas?
            const sig = significantBefore(typed, caret);
            pendingCaret.current = caretFromSignificant(
              formatCurrencyDisplay(sanitized),
              sig
            );
            field.onChange(sanitized === "" ? "" : sanitized);
          }}
          onBlur={(e) => {
            field.onBlur();
            // Normalise to a number on blur when there is a value.
            const num = parseFloat(sanitizeCurrency(e.target.value));
            if (!isNaN(num)) {
              field.onChange(num);
            }
          }}
          className={cn(
            "block h-9 w-full min-w-0 flex-1 rounded-r-md border bg-white px-3 text-sm",
            "tabular-nums",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0",
            hasError
              ? "border-error-600 text-error-900 focus:ring-error-300"
              : "border-slate-300 text-slate-900 focus:border-accent-500 focus:ring-accent-200",
            disabled && "cursor-not-allowed opacity-60"
          )}
        />
      </div>

      {hasError && (
        <p
          id={`currency-${String(name)}-error`}
          role="alert"
          className="text-xs font-medium text-error-600"
        >
          {fieldState.error?.message}
        </p>
      )}
    </div>
  );
}

export function CurrencyInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  placeholder = "0.00",
  disabled = false,
  className,
  required = false,
  hideLabel = false,
}: CurrencyInputProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <CurrencyControl
          field={field}
          fieldState={fieldState}
          label={label}
          description={description}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          required={required}
          hideLabel={hideLabel}
          name={name}
        />
      )}
    />
  );
}
