"use client";

/**
 * SectionSavingProvider / useSectionSaving — lift the wizard's "is this section
 * saving?" state out of `SectionForm` so the ONE canonical sticky footer
 * (`ApplyFooter`) can reflect it.
 *
 * The provider sits in `(portal)/apply/layout.tsx`, ABOVE both the page content
 * (which contains `SectionForm`, the writer) and `ApplyFooter` (the reader).
 * `SectionForm` calls `setSaving(true/false)` around its submit; `ApplyFooter`
 * reads `saving` for its disabled/spinner state. One button, one saving source
 * (Decision 3 — single path; the in-form footer is removed for the apply flow).
 *
 * `useSectionSaving()` is safe to call OUTSIDE a provider — it returns the inert
 * default ({ saving: false, no-op setter }). That keeps `SectionForm` working
 * unchanged in the `/contribute` flow, which renders no provider and keeps its
 * own in-form nav.
 */

import * as React from "react";

interface SectionSavingContextValue {
  saving: boolean;
  setSaving: (value: boolean) => void;
}

const SectionSavingContext = React.createContext<SectionSavingContextValue>({
  saving: false,
  setSaving: () => {},
});

export function SectionSavingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [saving, setSaving] = React.useState(false);
  const value = React.useMemo(() => ({ saving, setSaving }), [saving]);
  return (
    <SectionSavingContext.Provider value={value}>
      {children}
    </SectionSavingContext.Provider>
  );
}

export function useSectionSaving(): SectionSavingContextValue {
  return React.useContext(SectionSavingContext);
}
