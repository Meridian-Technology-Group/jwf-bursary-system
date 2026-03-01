"use client";

/**
 * CurrencyInput — £-prefixed, right-aligned, tabular-nums input.
 *
 * Integrates with react-hook-form via Controller.
 * Uses inputMode="decimal" (not type="number") for better mobile UX.
 */

import * as React from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  Controller,
} from "react-hook-form";
import { cn } from "@/lib/utils";

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
}: CurrencyInputProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;

        return (
          <div className={cn("space-y-1.5", className)}>
            <label
              htmlFor={`currency-${String(name)}`}
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

            <div className="relative flex items-center">
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
                value={field.value ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Allow digits and a single decimal point
                  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                    field.onChange(raw === "" ? "" : raw);
                  }
                }}
                onBlur={(e) => {
                  field.onBlur();
                  // Format to 2dp on blur when there is a value
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) {
                    field.onChange(num);
                  }
                }}
                className={cn(
                  "block flex-1 rounded-r-md border bg-white py-2 pr-3 text-right text-sm",
                  "tabular-nums font-mono",
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
      }}
    />
  );
}
