"use client";

/**
 * Create / edit a lead-applicant contact (Epic 04).
 *
 * The contact form captures the family identity, the LOCKED school + entry
 * year (these move here OFF the parent form — D1), and a structured home
 * address. `childDob` is a recommended field whose helper text explains it
 * disambiguates twins (D12).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { ADULT_TITLES } from "@/lib/contacts/titles";
import {
  ENTRY_YEAR_GROUP_CODES,
  ENTRY_YEAR_GROUP_OPTIONS,
  type EntryYearGroupCode,
} from "@/lib/assessment/schooling-years";
import {
  entryAcademicYearLabelOrNull,
  entryAcademicYearOptions,
} from "@/lib/schools/academic-year";

export interface ContactFormValues {
  id?: string;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  childTitle: string;
  childFirstName: string;
  childLastName: string;
  childDob: string;
  school: "TRINITY" | "WHITGIFT" | "";
  situation: "NEW" | "INTERNAL" | "ROLLING_OVER";
  /** START year of the academic year of entry — 2027 means "2027/2028". */
  entryYear: string;
  entryYearGroup: EntryYearGroupCode | "";
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  notes: string;
}

const schema = z.object({
  title: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Parent surname is required"),
  email: z.string().email("A valid email address is required"),
  phone: z.string().optional(),
  childTitle: z.string().optional(),
  // Epic 15 G2 (CH-09): first name, surname and DOB are all required — the
  // invitation cannot be prepared without the full child identity.
  childFirstName: z.string().min(1, "Child's first name is required"),
  childLastName: z.string().min(1, "Child's surname is required"),
  childDob: z.string().min(1, "Child's date of birth is required"),
  school: z.enum(["TRINITY", "WHITGIFT"], { error: "A school is required" }),
  // B3 (CG-26) — the invitation-template situation; defaults to NEW.
  situation: z.enum(["NEW", "INTERNAL", "ROLLING_OVER"]),
  // CH-26: captured (and shown back) as the academic year "2027/2028"; the
  // value on the wire stays the 4-digit START year the DB column holds.
  entryYear: z
    .string()
    .min(1, "An academic year is required")
    .regex(/^\d{4}$/, "Select an academic year"),
  // Required as of Q1: the entry year-group is JWF-facing only and the parent
  // can never supply it, so it must be captured here.
  entryYearGroup: z.enum(ENTRY_YEAR_GROUP_CODES, {
    error: "An entry school year is required",
  }),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  town: z.string().optional(),
  postcode: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const EMPTY: ContactFormValues = {
  title: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  childTitle: "",
  childFirstName: "",
  childLastName: "",
  childDob: "",
  school: "",
  situation: "NEW",
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

  // CH-26: the academic-year dropdown offers a rolling window, but a record
  // being edited may sit outside it (a back-dated entrant). Always include the
  // record's own year, so opening and saving an old contact can never silently
  // blank the field.
  const academicYearOptions = useMemo(() => {
    const options = entryAcademicYearOptions();
    const current = initial?.entryYear;
    if (current && !options.some((o) => o.value === current)) {
      const label = entryAcademicYearLabelOrNull(current);
      if (label) {
        options.push({ value: current, label });
        options.sort((a, b) => a.value.localeCompare(b.value));
      }
    }
    return options;
  }, [initial?.entryYear]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(initial ?? EMPTY),
      school: (initial?.school as Values["school"]) || undefined,
      situation: (initial?.situation as Values["situation"]) || "NEW",
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
      situation: (initial?.situation as Values["situation"]) || "NEW",
      entryYearGroup:
        (initial?.entryYearGroup as Values["entryYearGroup"]) || undefined,
    });
    setServerError(null);
  }, [open, initial, reset]);

  function onSubmit(values: Values) {
    setServerError(null);
    const fd = new FormData();
    if (values.title) fd.set("title", values.title);
    if (values.firstName) fd.set("firstName", values.firstName);
    fd.set("lastName", values.lastName);
    fd.set("email", values.email);
    if (values.phone) fd.set("phone", values.phone);
    if (values.childTitle) fd.set("childTitle", values.childTitle);
    if (values.childFirstName) fd.set("childFirstName", values.childFirstName);
    fd.set("childLastName", values.childLastName);
    if (values.childDob) fd.set("childDob", values.childDob);
    fd.set("school", values.school);
    fd.set("situation", values.situation);
    fd.set("entryYear", values.entryYear);
    fd.set("entryYearGroup", values.entryYearGroup);
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
            and academic year set here are locked — the parent cannot change them.
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
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ADULT_TITLES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              {/* No child title — the recipient record is first name, surname,
                  DOB, school and year of entry only (CH-09). */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="childFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        First name <span className="text-red-500">*</span>
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
                  name="childLastName"
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
                  name="childDob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Date of birth <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isPending} />
                      </FormControl>
                      <FormDescription>
                        Also distinguishes twins (one account per child).
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
                School &amp; academic year (locked for the parent)
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
                            Rolling over
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
                        Academic year <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an academic year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {academicYearOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The academic year of entry, e.g. 2027/2028.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entryYearGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Entry school year{" "}
                        <span className="text-red-500">*</span>
                      </FormLabel>
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
                          {ENTRY_YEAR_GROUP_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
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
