"use client";

/**
 * Internal Bursary Request Dialog
 *
 * Modal form that allows an ASSESSOR to create an internal bursary application
 * on behalf of a parent. Follows the CreateRoundDialog pattern.
 *
 * On submit it:
 *   1. Validates inputs client-side with react-hook-form + Zod
 *   2. Calls createInternalRequestAction (server action)
 *   3. Shows success with the generated reference, or field/server errors
 *
 * Uses shadcn Dialog, Form, Input, Select, RadioGroup, Textarea, Button.
 */

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createInternalRequestAction } from "@/app/(admin)/queue/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoundOption {
  id: string;
  academicYear: string;
  status: string;
}

interface InternalRequestDialogProps {
  /** List of rounds to offer in the dropdown (all statuses — assessor decides) */
  rounds: RoundOption[];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  parentEmail: z.string().email("A valid email address is required"),
  parentName: z.string().min(1, "Parent name is required").max(200),
  childName: z.string().min(1, "Child name is required").max(200),
  school: z.enum(["WHITGIFT", "TRINITY"], {
    error: "Please select a school",
  }),
  roundId: z.string().min(1, "Please select a round"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional(),
  entryYear: z.string().min(1, "Please select an entry year"),
});

type FormValues = z.infer<typeof schema>;

// ─── Entry year options ───────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const ENTRY_YEARS = Array.from({ length: 8 }, (_, i) => currentYear + i - 1);

// ─── Component ────────────────────────────────────────────────────────────────

export function InternalRequestDialog({ rounds }: InternalRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      parentEmail: "",
      parentName: "",
      childName: "",
      school: undefined,
      roundId: "",
      reason: "",
      entryYear: "",
    },
  });

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      form.reset();
      setServerError(null);
      setSuccessReference(null);
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null);

    const formData = new FormData();
    formData.set("parentEmail", values.parentEmail);
    formData.set("parentName", values.parentName);
    formData.set("childName", values.childName);
    formData.set("school", values.school);
    formData.set("roundId", values.roundId);
    formData.set("entryYear", values.entryYear);
    if (values.reason) {
      formData.set("reason", values.reason);
    }

    startTransition(async () => {
      const result = await createInternalRequestAction(formData);

      if (!result.success) {
        setServerError(result.error ?? "An unexpected error occurred.");
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof FormValues, { message: messages[0] });
          }
        }
      } else {
        setSuccessReference(result.reference ?? "");
      }
    });
  }

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Internal Request
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {/* Success state */}
          {successReference ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Internal Request Created
                </DialogTitle>
                <DialogDescription>
                  The internal bursary request has been created and an invitation
                  email has been sent to the parent.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm text-slate-600">Application reference</p>
                <p className="mt-1 font-mono text-xl font-semibold text-primary-900">
                  {successReference}
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            /* Form state */
            <>
              <DialogHeader>
                <DialogTitle>Create Internal Bursary Request</DialogTitle>
                <DialogDescription>
                  Create an application on behalf of a parent. An invitation
                  email will be sent so they can complete the form.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 py-2"
                >
                  {/* Parent email */}
                  <FormField
                    control={form.control}
                    name="parentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Email</FormLabel>
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

                  {/* Parent name */}
                  <FormField
                    control={form.control}
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Jane Smith"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Child name */}
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* School (radio) */}
                  <FormField
                    control={form.control}
                    name="school"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending}
                            className="flex gap-6 pt-1"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="WHITGIFT" id="school-whitgift" />
                              <Label
                                htmlFor="school-whitgift"
                                className="cursor-pointer font-normal"
                              >
                                Whitgift
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="TRINITY" id="school-trinity" />
                              <Label
                                htmlFor="school-trinity"
                                className="cursor-pointer font-normal"
                              >
                                Trinity
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Round (select) */}
                  <FormField
                    control={form.control}
                    name="roundId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Academic Round</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a round" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {rounds.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.academicYear}
                                {r.status !== "OPEN" && (
                                  <span className="ml-1 text-xs text-slate-400">
                                    ({r.status.toLowerCase()})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Entry year (select) */}
                  <FormField
                    control={form.control}
                    name="entryYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Year</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select entry year" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ENTRY_YEARS.map((year) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reason for request (optional textarea) */}
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Reason for Request{" "}
                          <span className="text-xs font-normal text-slate-400">
                            (optional, max 500 chars)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Referred by headteacher; child has exceptional circumstances…"
                            rows={3}
                            maxLength={500}
                            {...field}
                            disabled={isPending}
                            className="resize-none"
                          />
                        </FormControl>
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
                    <Button type="submit" disabled={isPending} className="gap-2">
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Creating…
                        </>
                      ) : (
                        "Create Request"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
