"use client";

/**
 * Stepper-data client bridge — replaces the `@stepper` parallel-route slot.
 *
 * WHY THIS EXISTS (the React-tree constraint)
 * -------------------------------------------
 * The section stepper renders in the persistent left rail (`PortalNav`, owned by
 * `(portal)/layout.tsx`), but its gap data is fetched in the apply CONTENT
 * subtree (`apply/layout.tsx`, inside `{children}`). The rail is an
 * ancestor-side SIBLING of the apply content, so a Provider placed in
 * `apply/layout.tsx` could never feed a consumer in the rail — React data only
 * flows DOWN. The old design solved this with a parallel-route slot, but that
 * slot does not re-run on `router.refresh()` (Next 14.2.35) and is not cleared
 * on soft-nav — the root cause of defects #2/#3/#4.
 *
 * THE BRIDGE
 * ----------
 * A tiny client store whose Provider sits in the ROOT portal layout (the common
 * ancestor of BOTH the rail and `{children}`). The apply content subtree WRITES
 * its freshly-fetched sections into the store (via `StepperDataWriter`); the
 * rail READS them (`RailStepper` → `useStepperData()`). Because the Provider is
 * above both, the write from the content branch is visible to the reader in the
 * rail branch.
 *
 * WHY THIS FIXES THE PROGRESS BUG (#3) — the refresh path
 * -------------------------------------------------------
 * `apply/layout.tsx` is a NORMAL server layout in the `children` tree (not a
 * parallel slot). `router.refresh()` (kept in `navigateAfterSave`) re-executes
 * the current route's layouts + page in that tree — well-established refresh
 * behaviour — so after a save it re-runs `apply/layout.tsx` → `loadRailStepper()`
 * re-queries the (already `revalidatePath`-ed) gap data → `StepperDataWriter`'s
 * effect pushes the fresh `sections` into this store → the rail's `RailStepper`
 * re-renders with live progress and tri-state icons.
 *
 * Outside a Provider, `useStepperData()` returns the inert default (no sections)
 * and `useSetStepperData()` is a no-op, so any stray consumer degrades safely.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SidebarSection } from "./portal-sidebar-sections";

export interface StepperData {
  sections: SidebarSection[] | null;
  roundName?: string;
}

/** Read shape: the current stepper payload (null sections = nothing to show). */
const StepperDataContext = createContext<StepperData>({
  sections: null,
  roundName: undefined,
});

/** Write shape: replace the stored payload. No-op outside a Provider. */
const SetStepperDataContext = createContext<(data: StepperData) => void>(
  () => {}
);

export function StepperDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StepperData>({
    sections: null,
    roundName: undefined,
  });

  // Stable setter identity so the writer's effect dependency list is honest and
  // does not re-fire on every provider render.
  const set = useCallback((next: StepperData) => {
    setData(next);
  }, []);

  // Memoise the read value so consumers only re-render when the payload changes.
  const value = useMemo<StepperData>(
    () => ({ sections: data.sections, roundName: data.roundName }),
    [data.sections, data.roundName]
  );

  return (
    <SetStepperDataContext.Provider value={set}>
      <StepperDataContext.Provider value={value}>
        {children}
      </StepperDataContext.Provider>
    </SetStepperDataContext.Provider>
  );
}

/** Read the current stepper payload (rail / reader side). */
export function useStepperData(): StepperData {
  return useContext(StepperDataContext);
}

/** Get the setter to write the stepper payload (apply content / writer side). */
export function useSetStepperData(): (data: StepperData) => void {
  return useContext(SetStepperDataContext);
}
