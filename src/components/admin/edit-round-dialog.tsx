"use client";

/**
 * Edit Round Dialog (Epic 03).
 *
 * Surfaces the already-built `updateRoundAction` behind a dialog so admins can
 * edit / extend a round's open, close and decision dates after creation —
 * including extending `closeDate` while the round is OPEN (the common "give
 * everyone another week" case). Mirrors `create-round-dialog`'s fields and
 * validation; the academic year is shown read-only (it is the round's unique
 * key and re-keying a live round is out of scope).
 *
 * The Round Cockpit gauge and watchlist Rule 8 read `Round.closeDate` directly,
 * so an extension here flows through the same field and the cockpit recomputes
 * automatically — no cockpit change needed.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { updateRoundAction } from "@/app/(admin)/rounds/actions";

const schema = z
  .object({
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

export interface EditRoundDialogProps {
  roundId: string;
  academicYear: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  /** ISO yyyy-MM-dd strings for the date inputs. */
  openDate: string;
  closeDate: string;
  decisionDate: string;
  /** ISO yyyy-MM-dd, or "" when the round has no NEW default (E1/D13-8). */
  defaultSubmissionDeadlineNew: string;
  /** ISO yyyy-MM-dd, or "" when the round has no ROLLING_OVER default. */
  defaultSubmissionDeadlineRolling: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRoundDialog({
  roundId,
  academicYear,
  status,
  openDate,
  closeDate,
  decisionDate,
  defaultSubmissionDeadlineNew,
  defaultSubmissionDeadlineRolling,
  open,
  onOpenChange,
}: EditRoundDialogProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      openDate,
      closeDate,
      decisionDate,
      defaultSubmissionDeadlineNew,
      defaultSubmissionDeadlineRolling,
    },
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset({
        openDate,
        closeDate,
        decisionDate,
        defaultSubmissionDeadlineNew,
        defaultSubmissionDeadlineRolling,
      });
      setServerError(null);
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    // academicYear is unchanged but RoundSchema (server) still requires it.
    formData.set("academicYear", academicYear);
    formData.set("openDate", values.openDate);
    formData.set("closeDate", values.closeDate);
    if (values.decisionDate) formData.set("decisionDate", values.decisionDate);
    // Only non-empty values are sent; an empty field means "clear the round
    // default for this application type" and is simply absent from the
    // FormData, which the action reads as `undefined` → NULL.
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
      const result = await updateRoundAction(roundId, formData);
      if (!result?.success) {
        setServerError(result?.error ?? "An unexpected error occurred.");
        if (result?.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (field in form.getValues()) {
              form.setError(field as keyof FormValues, {
                message: messages[0],
              });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  }

  const isOpenRound = status === "OPEN";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isOpenRound ? "Extend / adjust dates" : "Edit round dates"}
          </DialogTitle>
          <DialogDescription>
            {isOpenRound
              ? `Adjust the dates for the OPEN round ${academicYear}. Extending the close date keeps the round open longer.`
              : `Adjust the dates for round ${academicYear}.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
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
                    unless it has its own override. Clear the field and save to
                    remove it.
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
                    usually earlier than the date for new applications, by
                    convention in April. Clear the field and save to remove it.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isPending ? "Saving..." : "Save dates"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standalone trigger button + dialog. Kept separate so `round-detail-actions`
 * can place the trigger inline with the other action buttons.
 */
export function EditRoundDatesButton(
  props: Omit<EditRoundDialogProps, "open" | "onOpenChange">
) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {props.status === "OPEN" ? "Extend dates" : "Edit dates"}
      </Button>
      <EditRoundDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}
