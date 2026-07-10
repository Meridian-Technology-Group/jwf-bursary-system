"use client";

/**
 * CALC-07 — live v2 assessment calculation hook (sibling to
 * `use-assessment-calculation.ts`).
 *
 * Runs the full notional model (`calculateAssessmentV2`, the CALC-06
 * orchestrator) client-side on every input change, debounced at 150 ms — the
 * same shape as the v1 hook. No network requests. The pure wiring
 * (`runAssessmentV2`) is exported separately so it can be unit-tested React-free.
 */

import * as React from "react";
import { calculateAssessmentV2 } from "@/lib/assessment/v2/orchestrator";
import type {
  AssessmentV2Input,
  AssessmentV2Output,
} from "@/lib/assessment/v2/orchestrator";
import type { ReferenceBundle } from "@/lib/assessment/v2/types";

/**
 * Pure orchestrator wiring: runs the v2 calculation, returning `null` on any
 * error (so the UI shows an awaiting-data placeholder instead of throwing).
 * React-free — the unit test for the hook's wiring targets this.
 */
export function runAssessmentV2(
  input: AssessmentV2Input,
  ref: ReferenceBundle,
): AssessmentV2Output | null {
  try {
    return calculateAssessmentV2(input, ref);
  } catch (err) {
    console.error("[runAssessmentV2] Calculation error:", err);
    return null;
  }
}

/**
 * Runs `calculateAssessmentV2` on every input change, debounced at 150 ms.
 * Returns `null` until the first successful calculation (or on error).
 */
export function useAssessmentCalculationV2(
  input: AssessmentV2Input,
  ref: ReferenceBundle,
): AssessmentV2Output | null {
  const [output, setOutput] = React.useState<AssessmentV2Output | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Serialise for the dependency check (the ref bundle is stable per page load;
  // include it defensively so a settings change mid-session still recomputes).
  const inputKey = JSON.stringify(input);
  const refKey = React.useMemo(() => JSON.stringify(ref), [ref]);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOutput(runAssessmentV2(input, ref));
    }, 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, refKey]);

  return output;
}
