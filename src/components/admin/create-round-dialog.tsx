"use client";

/**
 * Create Round Dialog
 *
 * Modal form for creating a new assessment round. Uses react-hook-form with
 * Zod validation. Delegates to the createRoundAction server action.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createRoundAction } from "@/app/(admin)/rounds/actions";
import { defaultRollingDeadlineFor } from "@/lib/rounds/submission-deadline";

// ---------------------------------------------------------------------------
// Schema (mirrors server-side, but client-side for instant feedback)
// ---------------------------------------------------------------------------

const schema = z
  .object({
    academicYear: z
      .string()
      .min(1, "Academic year is required")
      .regex(/^\d{4}\/\d{2}$/, "Format must be YYYY/YY (e.g. 2026/27)"),
    openDate: z.string().min(1, "Open date is required"),
    closeDate: z.string().min(1, "Close date is required"),
    decisionDate: z.string().optional(),
    // Item 12, split by application type in E1/D13-8: one optional round-level
    // default submission-by date for new applicants, one for bursary holders
    // rolling over. No cross-field refinement — a round with no default is
    // valid, and either date may sit before or after closeDate (e.g. a grace
    // period), so this is permissive.
    defaultSubmissionDeadlineNew: z.string().optional(),
    defaultSubmissionDeadlineRolling: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.closeDate ||
      !data.openDate ||
      new Date(data.closeDate) > new Date(data.openDate),
    { message: "Close date must be after open date", path: ["closeDate"] }
  )
  .refine(
    (data) =>
      !data.decisionDate ||
      !data.closeDate ||
      new Date(data.decisionDate) > new Date(data.closeDate),
    {
      message: "Decision date must be after close date",
      path: ["decisionDate"],
    }
  );

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateRoundDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      academicYear: "",
      openDate: "",
      closeDate: "",
      decisionDate: "",
      defaultSubmissionDeadlineNew: "",
      defaultSubmissionDeadlineRolling: "",
    },
  });

  // Q4 (Brian, 2026-08-14): the rolling-over deadline is one global date per
  // round, "defaulting to April". Prefill it from the academic year as soon as
  // that field reads as `YYYY/YY` — but only while the admin has not touched
  // the rolling field themselves, so a deliberate choice is never overwritten.
  // A suggestion, not an implied value: clearing the field still means "no
  // rolling default" and falls back to the close date.
  const academicYear = form.watch("academicYear");
  const rollingTouched = Boolean(
    form.formState.dirtyFields.defaultSubmissionDeadlineRolling
  );
  useEffect(() => {
    if (rollingTouched) return;
    const suggested = defaultRollingDeadlineFor(academicYear ?? "");
    if (!suggested) return;
    if (form.getValues("defaultSubmissionDeadlineRolling") === suggested) return;
    form.setValue("defaultSubmissionDeadlineRolling", suggested);
  }, [academicYear, rollingTouched, form]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setServerError(null);
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    formData.set("academicYear", values.academicYear);
    formData.set("openDate", values.openDate);
    formData.set("closeDate", values.closeDate);
    if (values.decisionDate) {
      formData.set("decisionDate", values.decisionDate);
    }
    if (values.defaultSubmissionDeadlineNew) {
      formData.set(
        "defaultSubmissionDeadlineNew",
        values.defaultSubmissionDeadlineNew
      );
    }
    if (values.defaultSubmissionDeadlineRolling) {
      formData.set(
        "defaultSubmissionDeadlineRolling",
        values.defaultSubmissionDeadlineRolling
      );
    }

    startTransition(async () => {
      const result = await createRoundAction(formData);
      if (!result?.success) {
        setServerError(result?.error ?? "An unexpected error occurred.");
        // Apply server-side field errors back to the form
        if (result?.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof FormValues, {
              message: messages[0],
            });
          }
        }
        return;
      }

      // Success: close the dialog (resets the form) and navigate client-side.
      // The action no longer redirects (it threw NEXT_REDIRECT, which the
      // client mis-rendered as an error — defect plan §2.3).
      handleOpenChange(false);
      router.push("/rounds");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Round
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assessment Round</DialogTitle>
          <DialogDescription>
            Define a new bursary assessment cycle. Status will be set to DRAFT.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-2"
          >
            {/* Academic Year */}
            <FormField
              control={form.control}
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Year</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="2026/27"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Open Date */}
            <FormField
              control={form.control}
              name="openDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Open Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Close Date */}
            <FormField
              control={form.control}
              name="closeDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Close Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Decision Date (optional) */}
            <FormField
              control={form.control}
              name="decisionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Decision Date{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Default submission-by dates (optional, Item 12 / E1 D13-8) */}
            <FormField
              control={form.control}
              name="defaultSubmissionDeadlineNew"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Submission-by date — new applications{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isPending} />
                  </FormControl>
                  <p className="text-xs text-slate-400">
                    Every new application in this round inherits this deadline
                    unless it has its own override. Leave blank to fall back to
                    the close date.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultSubmissionDeadlineRolling"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Submission-by date — rolling over{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isPending} />
                  </FormControl>
                  <p className="text-xs text-slate-400">
                    Applies to existing bursary holders being re-assessed —
                    usually earlier than the date for new applications.
                    Pre-filled with 30 April of the academic year; change or
                    clear it as needed.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Server error */}
            {serverError && (
              <p className="text-sm text-red-600">{serverError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Round"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
