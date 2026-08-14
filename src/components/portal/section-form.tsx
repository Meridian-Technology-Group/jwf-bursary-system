"use client";

/**
 * SectionForm — generic wrapper for application section forms.
 *
 * - Accepts a Zod schema + default values
 * - Creates a react-hook-form instance with zodResolver
 * - Renders children inside a <Form> context
 * - Handles save: validates → calls server action → updates sidebar
 * - Shows section-level error summary banner if validation fails
 * - Loading state on save button
 * - Autosaves in the background (WP B2) and reports what it did
 *
 * ── Three save paths, one write (read before adding a fourth) ────────────────
 *   1. "Save and Continue" (`onSubmit` → `onSave`) — validates, persists, and
 *      advances. The only path that navigates.
 *   2. The unsaved-changes guard (WP B1) — `saveWithoutAdvancing`, run when the
 *      applicant clicks away mid-edit and chooses "Save".
 *   3. The autosave (WP B2, CF-29) — a debounced background run of the SAME
 *      write, on an idle timer and on blur.
 *
 * (2) and (3) share `persistInPlace`, so there is exactly one answer to "how is
 * a half-finished section written": complete if it passes its schema, a draft
 * (`isComplete = false`) if it does not. They differ only in how loudly they
 * report — the guard fills the error banner because someone is waiting on a
 * dialog; the autosave only moves its own indicator.
 *
 * The autosave has NO independent notion of "dirty". It calls B1's snapshot
 * comparison (`isDirtyNow`), for the reasons set out at length in
 * `@/lib/portal/unsaved-changes`.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  FormProvider,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import type { Resolver } from "react-hook-form";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { snapshotValues, valuesEqual } from "@/lib/portal/unsaved-changes";
import {
  autosaveAnnouncement,
  autosaveLabel,
  createAutosaveController,
  IDLE_STATUS,
  type AutosaveController,
  type AutosaveStatus,
} from "@/lib/portal/autosave";
import { useSectionSaving } from "./section-saving-context";
import { useRegisterUnsavedSection } from "./unsaved-changes-context";
import { GuardedLink } from "./guarded-link";

/**
 * Minimal slice of Next's `AppRouterInstance` that the post-save navigation
 * needs. Declared locally so the side-effect can be unit-tested with a plain
 * mock (no jsdom / RTL in this repo).
 */
type NavRouter = {
  refresh: () => void;
  push: (href: string) => void;
};

/**
 * After a successful section save, re-run the server layout subtree so the
 * stepper/progress rail picks up the already-revalidated gap data
 * (`revalidatePath` in `saveSection`), then soft-navigate to the next section.
 *
 * Order matters: `refresh()` MUST be called before `push()`. `refresh()` does
 * not block navigation; the push proceeds and the refreshed tree resolves for
 * the destination route. `refresh()` re-runs `apply/layout.tsx` (a normal
 * layout in the children tree), which re-fetches the gap data and republishes
 * it to the rail via the stepper-data store — so the stepper/progress goes
 * live. Fixes the frozen "0 of N" progress and the tri-state section icons
 * feeding off stale data.
 */
export function navigateAfterSave(router: NavRouter, nextHref?: string): void {
  router.refresh();
  if (nextHref) {
    router.push(nextHref);
  }
}

// ─── Autosave status store (WP B2) ───────────────────────────────────────────
/**
 * The autosave indicator changes several times a minute while an applicant
 * types. Holding that in `SectionForm`'s own state would re-render the form on
 * every transition — and because `SectionForm` spreads the RHF instance into
 * `FormProvider`, that publishes a fresh context value to every `useFormContext`
 * consumer in the section (the Income section has hundreds of fields). So the
 * status lives in a tiny external store and ONLY the indicator subscribes.
 */
interface AutosaveStatusStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AutosaveStatus;
  publish: (status: AutosaveStatus) => void;
}

function useAutosaveStatusStore(): AutosaveStatusStore {
  const statusRef = React.useRef<AutosaveStatus>(IDLE_STATUS);
  const listenersRef = React.useRef(new Set<() => void>());

  return React.useMemo<AutosaveStatusStore>(
    () => ({
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getSnapshot: () => statusRef.current,
      publish: (status) => {
        statusRef.current = status;
        listenersRef.current.forEach((listener) => listener());
      },
    }),
    []
  );
}

/**
 * "Saving… / Saved HH:MM / Unsaved changes".
 *
 * The wording and the state→label mapping are pure and unit-tested in
 * `@/lib/portal/autosave` — in particular that no state other than a landed
 * write is ever labelled "Saved".
 *
 * Only the OUTCOMES reach the live region: announcing every "Saving…" would
 * interrupt a screen-reader user mid-sentence every few seconds.
 */
function AutosaveIndicator({ store }: { store: AutosaveStatusStore }) {
  const status = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => IDLE_STATUS
  );
  const label = autosaveLabel(status);
  const announcement = autosaveAnnouncement(status);

  return (
    <>
      <div
        className="mb-4 flex h-5 items-center justify-end gap-1.5 text-xs"
        aria-hidden="true"
      >
        {status.state === "saving" && (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        )}
        {status.state === "saved" && (
          <CheckCircle2 className="h-3 w-3 text-success-600" />
        )}
        {status.state === "failed" && (
          <AlertCircle className="h-3 w-3 text-error-600" />
        )}
        {label && (
          <span
            className={cn(
              status.state === "saved" && "text-success-600",
              status.state === "failed" && "text-error-700",
              status.state === "unsaved" && "text-slate-500",
              (status.state === "saving" || status.state === "idle") &&
                "text-slate-400"
            )}
          >
            {label}
          </span>
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

interface SectionFormProps<T extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<T, any, any>;
  defaultValues: DefaultValues<T>;
  /** Called on successful validation. Should persist data. */
  onSave: (data: T) => Promise<{ success: boolean; errors?: string[] }>;
  /**
   * Persist the section IN PLACE — no navigation, no submission — for the
   * unsaved-changes guard (WP B1). Called when the applicant clicks a stepper
   * link mid-edit and chooses "Save and continue"; the guard performs the
   * navigation itself afterwards.
   *
   * `complete` reports whether the current values passed the section's Zod
   * schema, so the caller can choose between a complete save and a draft save.
   * Half-finished sections are the whole point: the applicant is leaving a
   * section they have not finished, and refusing to persist it because it does
   * not validate is exactly the data loss this guard exists to prevent.
   *
   * Omitted (the default) means the section cannot be saved in place, and the
   * guard's "save" option is not offered.
   */
  onSaveWithoutAdvancing?: (
    data: T,
    complete: boolean
  ) => Promise<{ success: boolean; errors?: string[] }>;
  /** URL of the previous section (or dashboard) */
  backHref?: string;
  /** URL to navigate to after successful save */
  nextHref?: string;
  /** Optional override for the primary button label. Defaults to "Save and Continue". */
  nextLabel?: string;
  children: React.ReactNode;
  /** Form element id — must match the external footer submit button (form=…). */
  formId?: string;
  className?: string;
  /**
   * Suppress the in-form Back / Save-and-Continue nav block. The lead-applicant
   * apply flow sets this because its nav is now the single sticky `ApplyFooter`
   * (PR-7, Decision 3). The `/contribute` flow leaves it unset, so it KEEPS the
   * in-form nav (its layout renders no sticky footer) — no regression.
   */
  hideInlineNav?: boolean;
  /**
   * Debounced background persistence of whatever is in the form (WP B2, CF-29).
   *
   * On by default wherever `onSaveWithoutAdvancing` can write a partial draft.
   * The assessor edit-on-behalf shell turns it OFF: its save action has no draft
   * equivalent, so a background write of a half-edited section would fail every
   * time and leave a permanent "Not saved" on a page that is working fine.
   */
  autosave?: boolean;
}

export function SectionForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSave,
  onSaveWithoutAdvancing,
  backHref,
  nextHref,
  nextLabel = "Save and Continue",
  children,
  formId = "section-form",
  className,
  hideInlineNav = false,
  autosave = true,
}: SectionFormProps<T>) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  // The single saving source for the sticky ApplyFooter (PR-7). Outside a
  // provider (e.g. the /contribute flow) this is an inert no-op, so the local
  // `saving` state above still drives the in-form button there.
  const { setSaving: setFooterSaving } = useSectionSaving();
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [serverErrors, setServerErrors] = React.useState<string[]>([]);
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as Parameters<typeof zodResolver>[0]) as any,
    defaultValues,
    mode: "onBlur",
  });

  const {
    handleSubmit,
    formState: { errors, isValid },
  } = form;

  const hasErrors = Object.keys(errors).length > 0 || serverErrors.length > 0;

  // ── Unsaved-changes guard (WP B1) ─────────────────────────────────────────
  // "Has the applicant changed anything" is measured against a snapshot taken
  // once the section has mounted — NOT react-hook-form's `formState.isDirty`,
  // which is a value comparison against `defaultValues` and so counts the
  // sections that write to themselves on mount (Income seeds seven sub-blocks
  // and a total; Child Details re-applies the locked school). Reading `isDirty`
  // made Income prompt on a page nobody had touched. See
  // `@/lib/portal/unsaved-changes` for the contract.
  //
  // A ref, not state: the guard reads it at click time and the rail must not
  // re-render on every keystroke.
  const baselineRef = React.useRef<T | null>(null);

  React.useEffect(() => {
    // Parent effects run AFTER their children's, so every section's own mount
    // effect has already applied its programmatic writes by the time this runs.
    baselineRef.current = snapshotValues(form.getValues());
    // Once per mounted section — a new section is a new SectionForm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirtyNow = React.useCallback(() => {
    // Before the baseline exists there is nothing the applicant could have
    // typed, so "clean" is both true and the safe answer.
    if (baselineRef.current === null) return false;
    return !valuesEqual(form.getValues(), baselineRef.current);
  }, [form]);

  // ── In-place persistence, shared by the guard and the autosave (WP B1/B2) ──
  /** Any write is in flight — the autosave stands aside rather than racing it. */
  const busyRef = React.useRef(false);
  /**
   * Completeness of the last write we made, so the rail is only re-fetched when
   * the stepper's answer could actually have changed. Null until the first
   * write, so that one always refreshes.
   */
  const persistedCompleteRef = React.useRef<boolean | null>(null);

  /**
   * Persist the section where it stands, without navigating.
   *
   * Validation decides HOW it is saved, never WHETHER: a section that passes
   * its schema is saved complete, and one that does not is still written (as a
   * draft, when the caller supports it) so the applicant's typing survives. The
   * schema is parsed directly rather than via `form.trigger()` so that neither
   * a stepper click nor a background autosave splashes red validation errors
   * over a half-filled section the applicant is still working on.
   *
   * A draft write carries `isComplete = false`, so a section the applicant has
   * not finished can never read as done in the stepper — the autosave makes
   * their typing safe without making it look submitted.
   */
  const persistInPlace = React.useCallback(async ({
    background = false,
  }: { background?: boolean } = {}): Promise<{
    ok: boolean;
    complete: boolean;
    /**
     * The write was deliberately waved off rather than attempted — the
     * `{ success: false, errors: [] }` sentinel a save action returns to say
     * "not now, and don't make a fuss". Not a failure: the autosave stays quiet
     * about it and simply keeps reporting the edits as unsaved.
     */
    cancelled: boolean;
    errors?: string[];
  }> => {
    if (!onSaveWithoutAdvancing) {
      return { ok: false, complete: false, cancelled: false };
    }

    const values = form.getValues();
    const complete = schema.safeParse(values).success;

    busyRef.current = true;
    try {
      const result = await onSaveWithoutAdvancing(values, complete);
      if (!result.success) {
        return {
          ok: false,
          complete,
          // An explicit, empty error list is the "cancelled, say nothing"
          // sentinel — distinct from a real failure, which always names a
          // reason.
          cancelled: Array.isArray(result.errors) && result.errors.length === 0,
          errors: result.errors,
        };
      }
      // Re-baseline on exactly what was sent: anything typed during the round
      // trip stays dirty and gets its own write.
      baselineRef.current = snapshotValues(values);
      // A foreground save always refreshes the rail (WP B1's behaviour — the
      // applicant is watching, and a navigation usually follows). A BACKGROUND
      // save only refreshes when the stepper's verdict for this section could
      // have flipped: re-running the server tree every couple of seconds while
      // someone types would be a lot of work for a rail that has not changed.
      const completenessChanged = persistedCompleteRef.current !== complete;
      persistedCompleteRef.current = complete;
      if (!background || completenessChanged) {
        router.refresh();
      }
      return { ok: true, complete, cancelled: false };
    } catch {
      return { ok: false, complete, cancelled: false };
    } finally {
      busyRef.current = false;
    }
  }, [onSaveWithoutAdvancing, form, schema, router]);

  const statusStore = useAutosaveStatusStore();

  // Latest-closure refs: the controller is created once per mount and must not
  // be rebuilt (that would drop its timers), but it has to call through to the
  // CURRENT persist/dirty closures.
  const persistRef = React.useRef(persistInPlace);
  persistRef.current = persistInPlace;
  const isDirtyRef = React.useRef(isDirtyNow);
  isDirtyRef.current = isDirtyNow;

  /**
   * The live autosave controller, or null when autosave is off / not yet
   * mounted. Owned by the subscription effect below (created with it, cancelled
   * with it) so a re-run — React StrictMode double-invokes effects in dev —
   * gets a working controller rather than the cancelled corpse of the last one.
   */
  const controllerRef = React.useRef<AutosaveController | null>(null);

  /**
   * The unsaved-changes guard's save (WP B1). Same write as the autosave, but
   * foregrounded: the buttons go into their saving state and a failure IS
   * surfaced in the error banner, because the applicant is standing at a dialog
   * waiting to be told whether they can leave.
   */
  const saveWithoutAdvancing = React.useCallback(async (): Promise<boolean> => {
    if (!onSaveWithoutAdvancing) return false;

    setSaving(true);
    setFooterSaving(true);
    setSaveState("saving");
    setServerErrors([]);

    try {
      const result = await persistInPlace();
      if (!result.ok) {
        setSaveState("error");
        setServerErrors(result.errors ?? ["An unexpected error occurred."]);
        return false;
      }
      setSaveState("saved");
      controllerRef.current?.markSaved();
      return true;
    } finally {
      setSaving(false);
      setFooterSaving(false);
    }
  }, [onSaveWithoutAdvancing, persistInPlace, setFooterSaving]);

  useRegisterUnsavedSection({
    isDirty: isDirtyNow,
    canSave: !!onSaveWithoutAdvancing,
    save: saveWithoutAdvancing,
  });

  // ── Autosave (WP B2, CF-29) ───────────────────────────────────────────────
  // `form.watch(callback)` is the subscription that does NOT re-render — the
  // callback fires on every field change without the component reading any
  // form state. (Reading `formState.isDirty` instead is the trap WP B1
  // documents: RHF would re-derive it against `defaultValues` on every render
  // and report the sections that write to themselves on mount as edited.)
  const autosaveEnabled = autosave && !!onSaveWithoutAdvancing;
  React.useEffect(() => {
    if (!autosaveEnabled) return;

    const controller = createAutosaveController({
      // B1's dirty signal, unchanged. The autosave deliberately does not have
      // its own idea of "has this section got work in it".
      hasWork: () => isDirtyRef.current(),
      save: async () => {
        // A foreground save (Save and Continue, or the guard's) is already
        // writing this row — stand aside and come back rather than racing it.
        if (busyRef.current) return "deferred";
        if (!isDirtyRef.current()) return "skipped";
        const result = await persistRef.current({ background: true });
        if (result.ok) return "saved";
        // A cancelled write is not a broken one — no red indicator, and no
        // claim that the work is safe either (the controller re-checks whether
        // edits are still outstanding and keeps saying "Unsaved changes").
        return result.cancelled ? "skipped" : "failed";
      },
      onStatus: statusStore.publish,
    });
    controllerRef.current = controller;

    const subscription = form.watch(() => {
      controller.noteChange(isDirtyRef.current());
    });

    return () => {
      subscription.unsubscribe();
      // No write on unmount: a request fired from a component being torn down
      // is not reliably delivered. The B1 guard is what covers leaving the page.
      controller.cancel();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [autosaveEnabled, form, statusStore]);

  // Scroll to error summary when validation fails on submit
  React.useEffect(() => {
    if (hasErrors && saveState === "error") {
      errorSummaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      errorSummaryRef.current?.focus();
    }
  }, [hasErrors, saveState]);

  async function onSubmit(data: T) {
    setSaving(true);
    setFooterSaving(true);
    setSaveState("saving");
    setServerErrors([]);

    try {
      const result = await onSave(data);

      if (result.success) {
        setSaveState("saved");
        // Re-baseline before navigating: between the successful write and the
        // route change the section is no longer dirty, and the guard must not
        // interrupt its own success path.
        baselineRef.current = snapshotValues(data);
        // Adopt this write into the indicator and drop any pending background
        // one, so the two paths cannot contradict each other on screen.
        persistedCompleteRef.current = true;
        controllerRef.current?.markSaved();
        navigateAfterSave(router, nextHref);
      } else {
        setSaveState("error");
        setServerErrors(result.errors ?? ["An unexpected error occurred."]);
      }
    } catch (err) {
      // Next's redirect() throws a NEXT_REDIRECT sentinel that must bubble
      // so the router can navigate. Don't swallow it as a generic error.
      const digest = (err as { digest?: string } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setSaveState("error");
      setServerErrors(["An unexpected error occurred. Please try again."]);
    } finally {
      setSaving(false);
      setFooterSaving(false);
    }
  }

  function onInvalid() {
    setSaveState("error");
    // Scroll to summary
    setTimeout(() => {
      errorSummaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  }

  // Flatten validation errors into messages
  function flattenErrors(
    obj: Record<string, unknown>,
    prefix = ""
  ): string[] {
    return Object.entries(obj).flatMap(([key, val]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        val &&
        typeof val === "object" &&
        "message" in val &&
        typeof (val as { message: unknown }).message === "string"
      ) {
        return [(val as { message: string }).message];
      }
      if (val && typeof val === "object" && !Array.isArray(val)) {
        return flattenErrors(val as Record<string, unknown>, path);
      }
      if (Array.isArray(val)) {
        return val.flatMap((item, i) =>
          item && typeof item === "object"
            ? flattenErrors(item as Record<string, unknown>, `${path}[${i}]`)
            : []
        );
      }
      return [];
    });
  }

  const validationMessages = flattenErrors(
    errors as Record<string, unknown>
  ).slice(0, 5);

  const allErrors = [...validationMessages, ...serverErrors];

  return (
    <FormProvider {...form}>
      {/* Autosave indicator (WP B2). Subscribes to the status store on its own
          so the transitions do not re-render the section's fields. */}
      <AutosaveIndicator store={statusStore} />

      {/* Error summary banner */}
      {hasErrors && saveState === "error" && allErrors.length > 0 && (
        <div
          ref={errorSummaryRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="mb-6 rounded-md border border-error-200 bg-error-50 p-4 outline-none"
        >
          <div className="flex gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-error-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-error-900">
                Please fix the following before continuing:
              </p>
              <ul className="mt-2 list-disc pl-4 space-y-1">
                {allErrors.map((msg, i) => (
                  <li key={i} className="text-sm text-error-700">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit as any, onInvalid)}
        // Leaving a field is the strongest signal that an answer is finished,
        // so don't make the applicant wait out the idle timer for it. React's
        // onBlur is delegated focusout, so this covers every field in the
        // section; a blur with nothing typed does not write (see `hasWork`).
        onBlur={autosaveEnabled ? () => controllerRef.current?.flush() : undefined}
        noValidate
        className={cn("space-y-6", className)}
      >
        {children}
      </form>

      {/* In-form navigation buttons.
          The lead-applicant apply flow sets `hideInlineNav` because its nav is
          now the single sticky `ApplyFooter` (PR-7). The /contribute flow leaves
          it unset and KEEPS these buttons (its layout has no sticky footer). */}
      {!hideInlineNav && (
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
          {backHref ? (
            // Guarded (WP B1): this Back was a raw anchor, so a second parent
            // stepping back out of a half-filled section lost it outright.
            <GuardedLink
              href={backHref}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700",
                "hover:bg-slate-50 hover:text-slate-900 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </GuardedLink>
          ) : (
            <div />
          )}

          <button
            type="submit"
            form={formId}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 rounded-md bg-primary-900 px-5 py-2 text-sm font-medium text-white",
              "hover:bg-primary-800 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
              "disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </FormProvider>
  );
}
