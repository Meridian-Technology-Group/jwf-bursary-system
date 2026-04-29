"use client";

/**
 * CountryCombobox — searchable country picker for react-hook-form.
 *
 * Uses shadcn Command (cmdk) inside a Popover to give users a type-to-filter
 * experience over the shared COUNTRIES list. Stores the country string in
 * form state — identical to the plain <Select> it replaces.
 *
 * Props mirror the existing FormField pattern used across portal sections.
 */

import * as React from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRIES } from "@/lib/data/countries";
import { cn } from "@/lib/utils";

interface CountryComboboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export function CountryCombobox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder = "Select country...",
  required = false,
}: CountryComboboxProps<TFieldValues, TName>) {
  const [open, setOpen] = React.useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value: string = (field.value as string) ?? "";
        const hasError = !!fieldState.error;

        return (
          <FormItem>
            <FormLabel>
              {label}
              {required && (
                <span className="ml-0.5 text-error-600" aria-hidden="true">
                  {" "}*
                </span>
              )}
            </FormLabel>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-label={`${label}${value ? `: ${value}` : ""}`}
                  className={cn(
                    "w-full justify-between font-normal",
                    !value && "text-muted-foreground",
                    hasError && "border-error-600 ring-1 ring-error-600"
                  )}
                >
                  {value || placeholder}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Type to search..." />
                  <CommandList>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {COUNTRIES.map((country) => (
                        <CommandItem
                          key={country}
                          value={country}
                          onSelect={(selected) => {
                            field.onChange(selected === value ? "" : selected);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === country ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {country}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
