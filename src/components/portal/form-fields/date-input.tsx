"use client";

/**
 * DateInput — three separate day/month/year inputs that compose an ISO date string.
 *
 * Integrates with react-hook-form via Controller.
 * Stores value as YYYY-MM-DD string in the form.
 */

import * as React from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  Controller,
} from "react-hook-form";
import { cn } from "@/lib/utils";

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
}

function parseIso(iso: string | undefined) {
  if (!iso) return { day: "", month: "", year: "" };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { day: "", month: "", year: "" };
  return { year: match[1], month: match[2], day: match[3] };
}

function toIso(day: string, month: string, year: string): string | undefined {
  if (!day || !month || !year) return undefined;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return undefined;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

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
}: DateInputProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const parsed = parseIso(field.value as string | undefined);

        const [day, setDay] = React.useState(parsed.day);
        const [month, setMonth] = React.useState(parsed.month);
        const [year, setYear] = React.useState(parsed.year);

        // Sync external value changes
        React.useEffect(() => {
          const p = parseIso(field.value as string | undefined);
          setDay(p.day);
          setMonth(p.month);
          setYear(p.year);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [field.value]);

        function handleChange(
          newDay: string,
          newMonth: string,
          newYear: string
        ) {
          const iso = toIso(newDay, newMonth, newYear);
          field.onChange(iso ?? "");
        }

        const baseInput = cn(
          "block w-full rounded-md border bg-white py-2 px-3 text-sm text-slate-900",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "transition-colors",
          hasError
            ? "border-error-600 focus:ring-error-300"
            : "border-slate-300 focus:border-accent-500 focus:ring-accent-200",
          disabled && "cursor-not-allowed opacity-60"
        );

        return (
          <div className={cn("space-y-1.5", className)}>
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

              <div className="mt-2 flex gap-2">
                {/* Day */}
                <div className="w-16">
                  <label
                    htmlFor={`${String(name)}-day`}
                    className="mb-1 block text-xs text-slate-500"
                  >
                    Day
                  </label>
                  <input
                    id={`${String(name)}-day`}
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="DD"
                    disabled={disabled}
                    value={day}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setDay(v);
                      handleChange(v, month, year);
                    }}
                    onBlur={field.onBlur}
                    aria-invalid={hasError}
                    className={baseInput}
                  />
                </div>

                {/* Month */}
                <div className="w-16">
                  <label
                    htmlFor={`${String(name)}-month`}
                    className="mb-1 block text-xs text-slate-500"
                  >
                    Month
                  </label>
                  <input
                    id={`${String(name)}-month`}
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    disabled={disabled}
                    value={month}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setMonth(v);
                      handleChange(day, v, year);
                    }}
                    onBlur={field.onBlur}
                    aria-invalid={hasError}
                    className={baseInput}
                  />
                </div>

                {/* Year */}
                <div className="w-24">
                  <label
                    htmlFor={`${String(name)}-year`}
                    className="mb-1 block text-xs text-slate-500"
                  >
                    Year
                  </label>
                  <input
                    id={`${String(name)}-year`}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="YYYY"
                    disabled={disabled}
                    value={year}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setYear(v);
                      handleChange(day, month, v);
                    }}
                    onBlur={field.onBlur}
                    aria-invalid={hasError}
                    className={baseInput}
                  />
                </div>
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
