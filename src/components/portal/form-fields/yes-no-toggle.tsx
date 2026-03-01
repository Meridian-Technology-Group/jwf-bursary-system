"use client";

/**
 * YesNoToggle — button-group style Yes/No toggle.
 *
 * Gold highlight on the selected option; neutral on unselected.
 * Integrates with react-hook-form via Controller.
 */

import * as React from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  Controller,
} from "react-hook-form";
import { cn } from "@/lib/utils";

interface YesNoToggleProps<
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
}

export function YesNoToggle<
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
}: YesNoToggleProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const groupId = `yes-no-${String(name)}`;

        return (
          <div className={cn("space-y-2", className)}>
            <fieldset>
              <legend
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
              </legend>

              {description && (
                <p className="mt-0.5 text-xs text-slate-500">{description}</p>
              )}

              <div
                className={cn(
                  "mt-2 inline-flex rounded-md shadow-sm",
                  hasError && "ring-1 ring-error-600 ring-offset-1"
                )}
                role="group"
                aria-labelledby={groupId}
              >
                {/* Yes button */}
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={field.value === true}
                  onClick={() => field.onChange(true)}
                  className={cn(
                    "inline-flex items-center rounded-l-md border px-5 py-2 text-sm font-medium",
                    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
                    field.value === true
                      ? "border-accent-600 bg-accent-600 text-white hover:bg-accent-500"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  Yes
                </button>

                {/* No button */}
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={field.value === false}
                  onClick={() => field.onChange(false)}
                  className={cn(
                    "inline-flex items-center rounded-r-md border border-l-0 px-5 py-2 text-sm font-medium",
                    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
                    field.value === false
                      ? "border-accent-600 bg-accent-600 text-white hover:bg-accent-500"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  No
                </button>
              </div>
            </fieldset>

            {hasError && (
              <p role="alert" className="text-xs font-medium text-error-600">
                {fieldState.error?.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
