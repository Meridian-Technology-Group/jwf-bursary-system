"use client";

/**
 * Create / edit a lead-applicant contact (Epic 04).
 *
 * The contact form captures the family identity, the LOCKED school + entry
 * year (these move here OFF the parent form — D1), and a structured home
 * address. `childDob` is a recommended field whose helper text explains it
 * disambiguates twins (D12).
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createContactAction,
  updateContactAction,
} from "@/app/(admin)/contacts/actions";

export interface ContactFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  childName: string;
  childDob: string;
  school: "TRINITY" | "WHITGIFT" | "";
  entryYear: string;
  entryYearGroup: "Y6" | "Y7" | "Y9" | "Y12" | "OTHER" | "";
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  notes: string;
}

const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Parent surname is required"),
  email: z.string().email("A valid email address is required"),
  phone: z.string().optional(),
  childName: z.string().min(1, "Child's name is required"),
  childDob: z.string().optional(),
  school: z.enum(["TRINITY", "WHITGIFT"], { error: "A school is required" }),
  entryYear: z
    .string()
    .min(1, "Entry year is required")
    .regex(/^\d{4}$/, "Enter a 4-digit year"),
  entryYearGroup: z.enum(["Y6", "Y7", "Y9", "Y12", "OTHER"]).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  town: z.string().optional(),
  postcode: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const EMPTY: ContactFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  childName: "",
  childDob: "",
  school: "",
  entryYear: "",
  entryYearGroup: "",
  addressLine1: "",
  addressLine2: "",
  town: "",
  postcode: "",
  notes: "",
};

export function ContactFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initial?: ContactFormValues;
}) {
  const isEdit = Boolean(initial?.id);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(initial ?? EMPTY),
      school: (initial?.school as Values["school"]) || undefined,
      entryYearGroup:
        (initial?.entryYearGroup as Values["entryYearGroup"]) || undefined,
    },
  });

  // Both the create and edit dialogs are mounted permanently by the parent
  // table, so `useForm`'s `defaultValues` are only captured once (when `initial`
  // is still undefined) and never re-applied. Re-seed the form each time the
  // dialog opens so editing presents the record's current values rather than a
  // blank form. The school / entryYearGroup empty-string → undefined coercion
  // mirrors the initial `defaultValues` so the Select placeholders behave.
  const { reset } = form;
  useEffect(() => {
    if (!open) return;
    reset({
      ...(initial ?? EMPTY),
      school: (initial?.school as Values["school"]) || undefined,
      entryYearGroup:
        (initial?.entryYearGroup as Values["entryYearGroup"]) || undefined,
    });
    setServerError(null);
  }, [open, initial, reset]);

  function onSubmit(values: Values) {
    setServerError(null);
    const fd = new FormData();
    if (values.firstName) fd.set("firstName", values.firstName);
    fd.set("lastName", values.lastName);
    fd.set("email", values.email);
    if (values.phone) fd.set("phone", values.phone);
    fd.set("childName", values.childName);
    if (values.childDob) fd.set("childDob", values.childDob);
    fd.set("school", values.school);
    fd.set("entryYear", values.entryYear);
    if (values.entryYearGroup) fd.set("entryYearGroup", values.entryYearGroup);
    if (values.addressLine1) fd.set("addressLine1", values.addressLine1);
    if (values.addressLine2) fd.set("addressLine2", values.addressLine2);
    if (values.town) fd.set("town", values.town);
    if (values.postcode) fd.set("postcode", values.postcode);
    if (values.notes) fd.set("notes", values.notes);

    startTransition(async () => {
      const result = isEdit
        ? await updateContactAction(initial!.id!, fd)
        : await createContactAction(fd);

      if (result.success) {
        onOpenChange(false);
        form.reset(EMPTY as Values);
        router.refresh();
      } else {
        setServerError(result.error ?? "Failed to save contact.");
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof Values, { message: messages[0] });
          }
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>
            A contact is a family record held before any invitation. The school
            and entry year set here are locked — the parent cannot change them.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Parent */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lead applicant (parent)
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
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
                        Surname <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            {/* Child */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Child
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="childName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Child&apos;s name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="childDob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isPending} />
                      </FormControl>
                      <FormDescription>
                        Recommended — distinguishes twins (one account per child).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            {/* School & year — LOCKED for the parent */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                School &amp; entry year (locked for the parent)
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                          <SelectItem value="WHITGIFT">
                            Whitgift School
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entryYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Entry year <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="2026"
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
                  name="entryYearGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry year group</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
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
              </div>
            </fieldset>

            {/* Address */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Home address
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address line 1</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address line 2</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="town"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError && (
              <p className="text-sm text-red-600">{serverError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create contact"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
