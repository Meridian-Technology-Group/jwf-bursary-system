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

interface SectionFormProps<T extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<T, any, any>;
  defaultValues: DefaultValues<T>;
  /** Called on successful validation. Should persist data. */
  onSave: (data: T) => Promise<{ success: boolean; errors?: string[] }>;
  /** URL of the previous section (or dashboard) */
  backHref?: string;
  /** URL to navigate to after successful save */
  nextHref?: string;
  children: React.ReactNode;
  /** Form element id — must match the portal-bottom-nav submit button */
  formId?: string;
  className?: string;
}

export function SectionForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSave,
  backHref,
  nextHref,
  children,
  formId = "section-form",
  className,
}: SectionFormProps<T>) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
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
    setSaveState("saving");
    setServerErrors([]);

    try {
      const result = await onSave(data);

      if (result.success) {
        setSaveState("saved");
        if (nextHref) {
          router.push(nextHref);
        }
      } else {
        setSaveState("error");
        setServerErrors(result.errors ?? ["An unexpected error occurred."]);
      }
    } catch (err) {
      setSaveState("error");
      setServerErrors(["An unexpected error occurred. Please try again."]);
    } finally {
      setSaving(false);
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

      {/* Navigation buttons (also rendered in portal-bottom-nav via form="section-form") */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
        {backHref ? (
          <a
            href={backHref}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700",
              "hover:bg-slate-50 hover:text-slate-900 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </a>
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
              Save and Continue
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </FormProvider>
  );
}
