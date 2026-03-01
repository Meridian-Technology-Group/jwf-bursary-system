"use client";

/**
 * DependentChildrenForm — Section 4: Dependent Children
 *
 * Number of dependents + repeatable table of children.
 */

import * as React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { DependentChildrenFormValues } from "@/lib/schemas/dependent-children";
import { cn } from "@/lib/utils";

// ─── Child dialog form ────────────────────────────────────────────────────────

interface ChildDialogProps {
  open: boolean;
  editIndex: number | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    school: string;
    unearnedIncome: number;
    bursaryAmount?: number;
    isNamedChild?: boolean;
  }) => void;
}

function ChildDialog({ open, editIndex, onClose, onSave }: ChildDialogProps) {
  const [name, setName] = React.useState("");
  const [school, setSchool] = React.useState("");
  const [unearnedIncome, setUnearnedIncome] = React.useState("0");
  const [bursaryAmount, setBursaryAmount] = React.useState("0");
  const [isNamedChild, setIsNamedChild] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) {
      setName("");
      setSchool("");
      setUnearnedIncome("0");
      setBursaryAmount("0");
      setIsNamedChild(false);
      setErrors({});
    }
  }, [open]);

  function handleSave() {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Child name is required";
    if (isNaN(parseFloat(unearnedIncome)))
      newErrors.unearnedIncome = "Enter 0 if not applicable";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    onSave({
      name: name.trim(),
      school: school.trim(),
      unearnedIncome: parseFloat(unearnedIncome) || 0,
      bursaryAmount: parseFloat(bursaryAmount) || undefined,
      isNamedChild,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editIndex !== null ? "Edit child" : "Add child"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Is named child toggle */}
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              id="isNamedChild"
              checked={isNamedChild}
              onCheckedChange={(v) => setIsNamedChild(!!v)}
            />
            <label htmlFor="isNamedChild" className="text-sm cursor-pointer">
              This is the named child of this application
            </label>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="child-name">
              Child name{" "}
              <span className="text-error-600" aria-hidden="true">*</span>
            </Label>
            <Input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isNamedChild}
              placeholder={isNamedChild ? "Pre-populated from child details" : ""}
            />
            {errors.name && (
              <p className="text-xs text-error-600">{errors.name}</p>
            )}
          </div>

          {/* School */}
          <div className="space-y-1.5">
            <Label htmlFor="child-school">School</Label>
            <Input
              id="child-school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="School name"
            />
          </div>

          {/* Bursary amount */}
          <div className="space-y-1.5">
            <Label htmlFor="child-bursary">Amount of bursary (£)</Label>
            <div className="relative flex items-center">
              <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                £
              </span>
              <input
                id="child-bursary"
                type="text"
                inputMode="decimal"
                value={bursaryAmount}
                onChange={(e) => setBursaryAmount(e.target.value)}
                className="block flex-1 rounded-r-md border border-slate-300 bg-white py-2 pr-3 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-500"
              />
            </div>
          </div>

          {/* Unearned income */}
          <div className="space-y-1.5">
            <Label htmlFor="child-unearned">
              Children&rsquo;s unearned income (£){" "}
              <span className="text-error-600" aria-hidden="true">*</span>
            </Label>
            <p className="text-xs text-slate-500">
              Where a value is not applicable, please enter 0.
            </p>
            <div className="relative flex items-center">
              <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                £
              </span>
              <input
                id="child-unearned"
                type="text"
                inputMode="decimal"
                value={unearnedIncome}
                onChange={(e) => setUnearnedIncome(e.target.value)}
                className={cn(
                  "block flex-1 rounded-r-md border bg-white py-2 pr-3 text-right text-sm tabular-nums",
                  "focus:outline-none focus:ring-2",
                  errors.unearnedIncome
                    ? "border-error-600 focus:ring-error-300"
                    : "border-slate-300 focus:ring-accent-200 focus:border-accent-500"
                )}
              />
            </div>
            {errors.unearnedIncome && (
              <p className="text-xs text-error-600">{errors.unearnedIncome}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────

export function DependentChildrenForm() {
  const { control, getValues, setValue } =
    useFormContext<DependentChildrenFormValues>();

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "children",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);

  function openAdd() {
    setEditIndex(null);
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditIndex(index);
    setDialogOpen(true);
  }

  function handleSave(data: {
    name: string;
    school: string;
    unearnedIncome: number;
    bursaryAmount?: number;
    isNamedChild?: boolean;
  }) {
    const id = crypto.randomUUID();
    if (editIndex !== null) {
      update(editIndex, { ...fields[editIndex], ...data });
    } else {
      append({ id, ...data });
    }
  }

  return (
    <div className="space-y-8">
      {/* 3.1 Number of dependent children */}
      <FormField
        control={control}
        name="numberOfDependentChildren"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              How many children do you have still living at your address, or who
              are still financially dependent on you?{" "}
              <span className="text-error-600" aria-hidden="true">*</span>
            </FormLabel>
            <FormDescription>
              Include children studying at university or college.
            </FormDescription>
            <FormControl>
              <Input
                type="number"
                min={0}
                step={1}
                className="w-24"
                {...field}
                onChange={(e) =>
                  field.onChange(parseInt(e.target.value, 10) || 0)
                }
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <hr className="border-slate-200" />

      {/* 3.2 Children table */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-primary-900">
            Dependent children details
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Please provide information on the child named in this application as
            well as any other dependent children.
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No children added yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    School
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Bursary (£)
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Unearned income (£)
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {field.name}
                      {field.isNamedChild && (
                        <span className="ml-2 text-xs text-accent-600 font-medium">
                          (named child)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {field.school || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {field.bursaryAmount !== undefined
                        ? `£${field.bursaryAmount.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      £{(field.unearnedIncome ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(index)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${field.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
                          aria-label={`Remove ${field.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openAdd}
          className="gap-1.5 border-dashed border-slate-300 text-slate-600 hover:border-accent-500 hover:text-accent-600"
        >
          <Plus className="h-4 w-4" />
          Add child
        </Button>
      </div>

      <ChildDialog
        open={dialogOpen}
        editIndex={editIndex}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
