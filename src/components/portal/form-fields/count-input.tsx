"use client";

/**
 * CountInput — whole-number ("how many?") input for the portal.
 *
 * The money sibling is `CurrencyInput`; between them they are the only numeric
 * inputs an applicant ever types into, and both take their entry behaviour from
 * `number-entry.ts` rather than hand-rolling it (CF-18).
 *
 * `inputMode="numeric"` on a text input, not `type="number"`: the same choice
 * `CurrencyInput` documents. It still raises the numeric keypad on mobile, but
 * the displayed string stays ours to control — a `type="number"` field hands
 * the browser the value and there is no way to keep `0` + `1` from rendering as
 * `01`.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { parseCount, sanitizeCount, selectAllOnFocus } from "./number-entry";

export interface CountInputProps
  extends Omit<
    React.ComponentProps<typeof Input>,
    "value" | "onChange" | "type" | "inputMode"
  > {
  value: number | string | null | undefined;
  /** Receives the parsed whole number; an emptied field reports 0. */
  onChange: (value: number) => void;
}

export const CountInput = React.forwardRef<HTMLInputElement, CountInputProps>(
  function CountInput({ value, onChange, onFocus, ...rest }, ref) {
    const display =
      value === null || value === undefined || value === ""
        ? ""
        : sanitizeCount(String(value));

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        {...rest}
        value={display}
        onFocus={(event) => {
          selectAllOnFocus(event);
          onFocus?.(event);
        }}
        onChange={(event) => onChange(parseCount(event.target.value) ?? 0)}
      />
    );
  }
);
