"use client";

/**
 * Add Second Parent (dual-parent feature, backlog #20, PR 3).
 *
 * Staff-facing control on the application detail page. When no SECONDARY
 * contributor exists, renders an "Add second parent" button that opens a
 * dialog capturing the second parent's email + optional name and calls
 * `addSecondParentAction`. When a SECONDARY contributor already exists, renders
 * a read-only status panel (invited / in-progress / submitted) instead of the
 * add form.
 *
 * Mirrors the InternalRequestDialog pattern (react-hook-form + Zod + shadcn
 * Dialog/Form). Available to ADMIN and ASSESSOR; the server action enforces the
 * same.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Loader2, CheckCircle2, History, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addSecondParentAction } from "@/app/(admin)/invitations/actions";
import type { ApplicationContributorStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecondaryContributorView {
  status: ApplicationContributorStatus;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * The second parent who contributed to the PRIOR-year application, surfaced on
 * a re-assessment so staff can re-invite them for the new round (PR 6,
 * decision #6). Carry-forward, not auto-link: re-inviting goes through the
 * normal `addSecondParentAction` path.
 */
export interface PriorYearSecondaryView {
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** The academic year the parent contributed (for the prompt copy). */
  previousAcademicYear: string | null;
}

interface AddSecondParentCardProps {
  applicationId: string;
  /** Existing SECONDARY contributor, or null if none has been added yet. */
  secondary: SecondaryContributorView | null;
  /**
   * Dual-parent (PR 5): true when the assessor has chosen to proceed without
   * the second parent (override on the assessment). When set and the secondary
   * has NOT submitted, the status panel reads "Did not respond — override" so
   * staff see the application was assessed without the second parent's input.
   */
  overrideActive?: boolean;
  /**
   * Dual-parent (PR 6): the second parent from the prior-year application,
   * present only on a re-assessment that has NO second parent yet. When set,
   * the card shows a "re-invite" prompt pre-filled with their details.
   */
  priorYearSecondary?: PriorYearSecondaryView | null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email("A valid email address is required"),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Status display ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ApplicationContributorStatus, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
};

const STATUS_CLASSES: Record<ApplicationContributorStatus, string> = {
  INVITED: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  SUBMITTED: "bg-green-50 text-green-700 border-green-200",
};

function contributorName(s: SecondaryContributorView): string {
  const name = [s.firstName, s.lastName].filter(Boolean).join(" ").trim();
  return name || s.email;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddSecondParentCard({
  applicationId,
  secondary,
  overrideActive = false,
  priorYearSecondary = null,
}: AddSecondParentCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", firstName: "", lastName: "" },
  });

  // Open the add dialog pre-filled with the prior-year parent's details so the
  // re-invite goes through the normal addSecondParentAction path for the new
  // round. The staff member can still edit before sending.
  function openReinvite() {
    if (!priorYearSecondary) return;
    form.reset({
      email: priorYearSecondary.email,
      firstName: priorYearSecondary.firstName ?? "",
      lastName: priorYearSecondary.lastName ?? "",
    });
    setServerError(null);
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      form.reset();
      setServerError(null);
      if (success) {
        setSuccess(false);
        router.refresh();
      }
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addSecondParentAction(
        applicationId,
        values.email,
        values.firstName || undefined,
        values.lastName || undefined
      );
      if (!result.success) {
        setServerError(result.error ?? "An unexpected error occurred.");
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof FormValues, { message: messages[0] });
          }
        }
      } else {
        setSuccess(true);
      }
    });
  }

  // ── Existing SECONDARY contributor → read-only status panel ───────────────
  if (secondary) {
    // When the assessor proceeded without the second parent and they have not
    // submitted, surface that explicitly rather than the raw invite status.
    const showOverride =
      overrideActive && secondary.status !== "SUBMITTED";
    const statusLabel = showOverride
      ? "Did not respond — proceeding without"
      : STATUS_LABELS[secondary.status];
    const statusClass = showOverride
      ? "bg-slate-100 text-slate-600 border-slate-200"
      : STATUS_CLASSES[secondary.status];

    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Second Parent
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">
              {contributorName(secondary)}
            </span>
            {secondary.email && contributorName(secondary) !== secondary.email && (
              <span className="ml-1 text-slate-400">({secondary.email})</span>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
        </CardContent>
      </Card>
    );
  }

  // ── No second parent yet → optional carry-forward prompt + add control ─────
  const priorName = priorYearSecondary
    ? [priorYearSecondary.firstName, priorYearSecondary.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || priorYearSecondary.email
    : null;
  const showReinvitePrompt = !!priorYearSecondary && !promptDismissed;

  return (
    <Card className="mb-6">
      {showReinvitePrompt && priorYearSecondary && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <History
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p>
              A second parent{" "}
              <span className="font-medium">({priorName})</span> contributed
              {priorYearSecondary.previousAcademicYear
                ? ` in ${priorYearSecondary.previousAcademicYear}`
                : " last year"}
              . Re-invite them for this round?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-2"
              onClick={openReinvite}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Re-invite
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-amber-700 hover:bg-amber-100"
              onClick={() => setPromptDismissed(true)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Skip
            </Button>
          </div>
        </div>
      )}

      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-800">Second parent</p>
          <p className="text-slate-500">
            Invite a separated or divorced second parent to confidentially
            provide their own financial details.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => setOpen(true)}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add second parent
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {success ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Second Parent Invited
                </DialogTitle>
                <DialogDescription>
                  An invitation email has been sent to the second parent so they
                  can register and complete their section confidentially.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add Second Parent</DialogTitle>
                <DialogDescription>
                  Invite a second parent to provide their own financial details.
                  Their information stays confidential to them and is not visible
                  to the first parent.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 py-2"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Second Parent Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="parent@example.com"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            First Name{" "}
                            <span className="text-xs font-normal text-slate-400">
                              (optional)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Jane"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Last Name{" "}
                            <span className="text-xs font-normal text-slate-400">
                              (optional)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Smith"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                    <Button type="submit" disabled={isPending} className="gap-2">
                      {isPending ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          Inviting…
                        </>
                      ) : (
                        "Send Invitation"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
