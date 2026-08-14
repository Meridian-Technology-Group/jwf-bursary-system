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
 *
 * It ALSO carries the submit-intent handshake (D4 / CF-32). The footer now shows
 * two actions on the Declaration — "Review" and "Submit Application" — that both
 * submit the SAME `section-form`, so the form itself has to be told which one
 * was pressed. The footer arms the intent in its `onClick`; `SectionPageClient`
 * consumes it inside the save.
 *
 * The intent is held in a REF, not state, for two reasons:
 *   1. It must be readable synchronously by the submit handler that the click's
 *      default action triggers — a `useState` write could still be queued.
 *   2. Arming a button must not re-render the whole wizard subtree.
 *
 * Outside a provider `consumeSubmitIntent()` returns the default "review", so
 * the `/contribute` flow and the assessor's edit-on-behalf shell can never
 * submit through this path.
 */

import * as React from "react";

import {
  DEFAULT_SUBMIT_INTENT,
  type SectionSubmitIntent,
} from "@/lib/portal/declaration-submit";

interface SectionSavingContextValue {
  saving: boolean;
  setSaving: (value: boolean) => void;
  /** Arm the NEXT form submission with an intent. Synchronous (ref-backed). */
  setSubmitIntent: (intent: SectionSubmitIntent) => void;
  /**
   * Read the armed intent and reset it to the default. Read-once, so an intent
   * can never be replayed by a second submission of the same form.
   */
  consumeSubmitIntent: () => SectionSubmitIntent;
}

const SectionSavingContext = React.createContext<SectionSavingContextValue>({
  saving: false,
  setSaving: () => {},
  setSubmitIntent: () => {},
  consumeSubmitIntent: () => DEFAULT_SUBMIT_INTENT,
});

export function SectionSavingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [saving, setSaving] = React.useState(false);

  const submitIntentRef = React.useRef<SectionSubmitIntent>(
    DEFAULT_SUBMIT_INTENT
  );

  const setSubmitIntent = React.useCallback((intent: SectionSubmitIntent) => {
    submitIntentRef.current = intent;
  }, []);

  const consumeSubmitIntent = React.useCallback((): SectionSubmitIntent => {
    const intent = submitIntentRef.current;
    submitIntentRef.current = DEFAULT_SUBMIT_INTENT;
    return intent;
  }, []);

  const value = React.useMemo(
    () => ({ saving, setSaving, setSubmitIntent, consumeSubmitIntent }),
    [saving, setSubmitIntent, consumeSubmitIntent]
  );
  return (
    <SectionSavingContext.Provider value={value}>
      {children}
    </SectionSavingContext.Provider>
  );
}

export function useSectionSaving(): SectionSavingContextValue {
  return React.useContext(SectionSavingContext);
}
