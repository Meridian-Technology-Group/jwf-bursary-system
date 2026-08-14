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

  /**
   * Persist the section where it stands, without navigating.
   *
   * Validation decides HOW it is saved, never WHETHER: a section that passes
   * its schema is saved complete, and one that does not is still written (as a
   * draft, when the caller supports it) so the applicant's typing survives. The
   * schema is parsed directly rather than via `form.trigger()` so that merely
   * clicking a stepper link does not splash red validation errors over a
   * half-filled section the applicant may choose to stay on.
   */
  const saveWithoutAdvancing = React.useCallback(async (): Promise<boolean> => {
    if (!onSaveWithoutAdvancing) return false;

    const values = form.getValues();
    const complete = schema.safeParse(values).success;

    setSaving(true);
    setFooterSaving(true);
    setSaveState("saving");
    setServerErrors([]);

    try {
      const result = await onSaveWithoutAdvancing(values, complete);
      if (!result.success) {
        setSaveState("error");
        setServerErrors(result.errors ?? ["An unexpected error occurred."]);
        return false;
      }
      setSaveState("saved");
      // Re-baseline on what was just persisted, so the guard stops considering
      // the section dirty, and refresh the rail so the stepper reflects the new
      // (possibly draft, therefore still incomplete) state.
      baselineRef.current = snapshotValues(values);
      router.refresh();
      return true;
    } catch {
      setSaveState("error");
      setServerErrors(["An unexpected error occurred. Please try again."]);
      return false;
    } finally {
      setSaving(false);
      setFooterSaving(false);
    }
  }, [onSaveWithoutAdvancing, form, schema, router, setFooterSaving]);

  useRegisterUnsavedSection({
    isDirty: isDirtyNow,
    canSave: !!onSaveWithoutAdvancing,
    save: saveWithoutAdvancing,
  });

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
      {/* Auto-save indicator */}
      <div className="mb-4 flex h-5 items-center justify-end gap-1.5 text-xs">
        {saveState === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            <span className="text-slate-400">Saving...</span>
          </>
        )}
        {saveState === "saved" && (
          <>
            <CheckCircle2 className="h-3 w-3 text-success-600" />
            <span className="text-success-600">All changes saved</span>
          </>
        )}
      </div>

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
