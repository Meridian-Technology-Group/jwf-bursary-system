"use client";

/**
 * StepperDataWriter — the WRITE side of the stepper-data bridge.
 *
 * Mounted by `apply/layout.tsx` (a server layout in the `children` tree) with
 * the freshly-fetched `sections`/`roundName` as props. It pushes those into the
 * shared store (whose Provider lives in the ROOT portal layout) so the rail's
 * `RailStepper` — an ancestor-side sibling that can't receive this data through
 * normal prop flow — can read it.
 *
 * It renders nothing. The `useEffect` re-runs whenever the props change, so each
 * `router.refresh()`-triggered re-execution of `apply/layout.tsx` (after a save)
 * delivers the new gap data into the store and the rail re-renders with live
 * progress + tri-state icons. The dependency on the section identity/status
 * (not the array reference) keeps the effect honest across re-fetches that
 * return a structurally-new-but-equal array.
 */

import { useEffect } from "react";
import { useSetStepperData } from "./stepper-data-context";
import type { SidebarSection } from "./portal-sidebar-sections";

interface StepperDataWriterProps {
  sections: SidebarSection[] | null;
  roundName?: string;
}

/**
 * A compact, stable signature of the sections payload so the effect fires when
 * the meaningful state changes (status / progress / gap count) but not on every
 * render that merely produced a new array reference.
 */
function sectionsSignature(sections: SidebarSection[] | null): string {
  if (!sections) return "null";
  return sections
    .map(
      (s) =>
        `${s.id}:${s.status}:${s.progressSatisfied}/${s.progressTotal}:${s.gapCount}`
    )
    .join("|");
}

export function StepperDataWriter({
  sections,
  roundName,
}: StepperDataWriterProps) {
  const setStepperData = useSetStepperData();
  const signature = sectionsSignature(sections);

  useEffect(() => {
    setStepperData({ sections, roundName });
    // `signature` captures the meaningful section state; `roundName` is a scalar.
    // `sections`/`setStepperData` are intentionally not deps — the signature is
    // the change trigger and the setter identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, roundName]);

  return null;
}
