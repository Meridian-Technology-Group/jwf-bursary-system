"use client";

/**
 * Send Invitation Form
 *
 * Inline form on the Invitations page for sending individual invitations.
 * Uses react-hook-form + Zod, delegates to createInvitationAction.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createInvitationAction } from "@/app/(admin)/invitations/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoundOption {
  id: string;
  academicYear: string;
}

interface SendInvitationFormProps {
  rounds: RoundOption[];
  defaultRoundId?: string;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  email: z.string().email("A valid email address is required"),
  firstName: z.string().optional(),
  // Epic 04: surname, child name and school are now REQUIRED on the quick-invite
  // form (parity with the contact register) so partial invites can't slip
  // through. The `__none__` school sentinel is gone.
  lastName: z.string().min(1, "A surname is required"),
  childName: z.string().min(1, "The child's name is required"),
  school: z.enum(["TRINITY", "WHITGIFT"], { error: "A school is required" }),
  // B3 (CG-26, LA-3) — the 3-way situation choice selecting the invitation
  // template variant; the school half resolves from `school` above.
  situation: z.enum(["NEW", "INTERNAL", "ROLLING_OVER"]),
  // Q1 (Brian, 2026-08-14): the entry year-group is JWF-facing only and the
  // parent can never supply it, so the quick invite has to capture it.
  entryYearGroup: z.enum(["Y6", "Y7", "Y9", "Y12", "OTHER"], {
    error: "An entry year group is required",
  }),
  roundId: z
    .string()
    .uuid("An application round is required")
    .refine((v) => v !== "__none__", "An application round is required"),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendInvitationForm({
  rounds,
  defaultRoundId,
}: SendInvitationFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Render the round picker as a two-option segmented control when there are
  // ≤ 2 live rounds (the expected steady state per D13), falling back to a
  // dropdown when more are live.
  const useSegmentedRoundPicker = rounds.length > 0 && rounds.length <= 2;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      childName: "",
      school: undefined,
      situation: "NEW",
      entryYearGroup: undefined,
      roundId: defaultRoundId ?? "__none__",
    },
  });

  // Step 1: validation passed → open the confirmation dialog instead of sending
  // straight away. Prevents accidental invites (the demo pain point).
  function onReview(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);
    setPendingValues(values);
  }

  // Step 2: explicit confirm → dispatch the invite.
  function onConfirm() {
    const values = pendingValues;
    if (!values) return;
    setPendingValues(null);

    const formData = new FormData();
    formData.set("email", values.email);
    if (values.firstName) formData.set("firstName", values.firstName);
    if (values.lastName) formData.set("lastName", values.lastName);
    formData.set("childName", values.childName);
    formData.set("school", values.school);
    formData.set("situation", values.situation);
    formData.set("entryYearGroup", values.entryYearGroup);
    formData.set("roundId", values.roundId);

    startTransition(async () => {
      const result = await createInvitationAction(formData);
      if (result.success) {
        setSuccessMessage(`Invitation sent to ${values.email}`);
        form.reset({
          email: "",
          firstName: "",
          lastName: "",
          childName: "",
          school: undefined,
          situation: "NEW",
          entryYearGroup: undefined,
          roundId: defaultRoundId ?? "__none__",
        });
        router.refresh();
      } else {
        setServerError(result.error ?? "Failed to send invitation.");
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof FormValues, { message: messages[0] });
          }
        }
      }
    });
  }

  const confirmRoundYear =
    rounds.find((r) => r.id === pendingValues?.roundId)?.academicYear ?? "—";
  const confirmRecipient = pendingValues
    ? [pendingValues.firstName, pendingValues.lastName]
        .filter(Boolean)
        .join(" ") || pendingValues.email
    : "";
  const confirmSchool =
    pendingValues?.school === "TRINITY"
      ? "Trinity School"
      : pendingValues?.school === "WHITGIFT"
        ? "Whitgift School"
        : "—";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-800">
        Quick invite a family
      </h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">
        A one-off parent invite. Surname, child name, school and entry year
        group are required — they are locked and the parent cannot see or
        change them.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onReview)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Email <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="applicant@example.com"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* First Name */}
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
                      autoComplete="given-name"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Last Name */}
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Last Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Smith"
                      autoComplete="family-name"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Child Name */}
            <FormField
              control={form.control}
              name="childName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Child Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Alex Smith"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* School */}
            <FormField
              control={form.control}
              name="school"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    School <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select school" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TRINITY">Trinity School</SelectItem>
                      <SelectItem value="WHITGIFT">Whitgift School</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Situation — B3 (CG-26): picks the invitation template
                variant (new / internal / rolling-over); school resolves the
                TS/WS half automatically. */}
            <FormField
              control={form.control}
              name="situation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Situation <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? "NEW"}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select situation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NEW">New application</SelectItem>
                      <SelectItem value="INTERNAL">
                        Internal bursary application
                      </SelectItem>
                      <SelectItem value="ROLLING_OVER">
                        Rolling over (existing bursary family)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Entry year group — JWF-facing only (Q1). Captured here because
                the parent can never supply it and the application created on
                acceptance needs it for the assessment engine. */}
            <FormField
              control={form.control}
              name="entryYearGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Entry year group <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entry year group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Y6">Year 6</SelectItem>
                      <SelectItem value="Y7">Year 7</SelectItem>
                      <SelectItem value="Y9">Year 9</SelectItem>
                      <SelectItem value="Y12">Year 12</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Round — live rounds only (OPEN). Two-option segmented control
                when ≤2 are live (D13), dropdown fallback otherwise. */}
            <FormField
              control={form.control}
              name="roundId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Round <span className="text-red-500">*</span>
                  </FormLabel>
                  {rounds.length === 0 ? (
                    <p className="text-sm text-amber-600">
                      No open round to invite into. Open a round first.
                    </p>
                  ) : useSegmentedRoundPicker ? (
                    <FormControl>
                      <div
                        role="radiogroup"
                        aria-label="Application round"
                        className="inline-flex rounded-md border border-slate-200 p-0.5"
                      >
                        {rounds.map((r) => {
                          const selected = field.value === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={isPending}
                              onClick={() => field.onChange(r.id)}
                              className={cn(
                                "min-w-[6rem] rounded px-4 py-1.5 text-sm font-medium transition-colors",
                                selected
                                  ? "bg-primary-900 text-white"
                                  : "text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              {r.academicYear}
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                  ) : (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "__none__"}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select round" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rounds.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.academicYear}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Feedback */}
          {serverError && (
            <p className="text-sm text-red-600">{serverError}</p>
          )}
          {successMessage && (
            <p className="text-sm text-green-600">{successMessage}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending || rounds.length === 0}
              className="gap-2"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation step — naming recipient + round before dispatch, to stop
          accidental sends (the demo pain point). Matches the bulk-action
          confirmation pattern. */}
      <Dialog
        open={pendingValues !== null}
        onOpenChange={(next) => {
          if (!next) setPendingValues(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this invitation?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 pt-1 text-sm text-slate-600">
                <p>
                  Invite{" "}
                  <span className="font-medium text-slate-800">
                    {confirmRecipient}
                  </span>{" "}
                  into round{" "}
                  <span className="font-medium text-slate-800">
                    {confirmRoundYear}
                  </span>
                  ?
                </p>
                {pendingValues?.email && confirmRecipient !== pendingValues.email && (
                  <p className="text-xs text-slate-400">{pendingValues.email}</p>
                )}
                <p className="text-xs text-slate-500">
                  Child:{" "}
                  <span className="font-medium text-slate-700">
                    {pendingValues?.childName || "—"}
                  </span>{" "}
                  · School:{" "}
                  <span className="font-medium text-slate-700">
                    {confirmSchool}
                  </span>
                </p>
                <p className="pt-1 text-xs text-slate-400">
                  This emails the applicant a link to start their bursary
                  application. The school is locked.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingValues(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Sending..." : "Confirm & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
