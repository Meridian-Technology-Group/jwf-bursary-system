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
  lastName: z.string().optional(),
  childName: z.string().optional(),
  school: z.enum(["TRINITY", "WHITGIFT", "__none__"]).optional(),
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      childName: "",
      school: "__none__",
      roundId: defaultRoundId ?? "__none__",
    },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("email", values.email);
    if (values.firstName) formData.set("firstName", values.firstName);
    if (values.lastName) formData.set("lastName", values.lastName);
    if (values.childName) formData.set("childName", values.childName);
    if (values.school && values.school !== "__none__") formData.set("school", values.school);
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
          school: "__none__",
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-800">
        Send New Invitation
      </h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    Last Name{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (optional)
                    </span>
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
                    Child Name{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (optional)
                    </span>
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
                  <FormLabel>School</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? "__none__"}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select school" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Any / Not specified</SelectItem>
                      <SelectItem value="TRINITY">Trinity School</SelectItem>
                      <SelectItem value="WHITGIFT">Whitgift School</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Round */}
            <FormField
              control={form.control}
              name="roundId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Round <span className="text-red-500">*</span>
                  </FormLabel>
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
            <Button type="submit" disabled={isPending} className="gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
