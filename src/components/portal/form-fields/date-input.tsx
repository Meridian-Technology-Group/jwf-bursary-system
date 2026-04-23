"use client";

/**
 * DateInput — popover-based datepicker with month/year dropdown navigation.
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
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  /** Earliest selectable year (default: 2000) */
  fromYear?: number;
  /** Latest selectable year (default: current year) */
  toYear?: number;
}

function parseIsoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  return parse(iso, "yyyy-MM-dd", new Date());
}

function dateToIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
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
  fromYear = 2000,
  toYear = new Date().getFullYear(),
}: DateInputProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const selectedDate = parseIsoToDate(field.value as string | undefined);

        return (
          <div className={cn("space-y-1.5", className)}>
            <label
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

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-offset-0",
                    "transition-colors",
                    hasError
                      ? "border-error-600 focus:ring-error-300"
                      : "border-slate-300 focus:border-accent-500 focus:ring-accent-200",
                    disabled && "cursor-not-allowed opacity-60",
                    !selectedDate && "text-slate-400"
                  )}
                >
                  <span>
                    {selectedDate
                      ? format(selectedDate, "d MMM yyyy")
                      : "Select a date…"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      field.onChange(dateToIso(date));
                    }
                  }}
                  defaultMonth={selectedDate ?? new Date(toYear, 0)}
                  startMonth={new Date(fromYear, 0)}
                  endMonth={new Date(toYear, 11)}
                  disabled={disabled}
                />
              </PopoverContent>
            </Popover>

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
