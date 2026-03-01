"use client";

/**
 * RepeatableTable — manages a list of items via useFieldArray.
 *
 * - "Add" button opens an inline modal (Dialog).
 * - Table displays added items with edit/remove actions.
 * - Generic over item type T.
 */

import * as React from "react";
import {
  type UseFormReturn,
  type FieldValues,
  type ArrayPath,
  type FieldArray,
  useFieldArray,
} from "react-hook-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface RepeatableTableProps<
  TFieldValues extends FieldValues,
  TArrayPath extends ArrayPath<TFieldValues>,
> {
  form: UseFormReturn<TFieldValues>;
  name: TArrayPath;
  columns: ColumnDef<FieldArray<TFieldValues, TArrayPath>>[];
  /** Form rendered inside the add/edit dialog */
  renderForm: (
    index: number | null,
    onClose: () => void
  ) => React.ReactNode;
  addLabel?: string;
  emptyMessage?: string;
  className?: string;
}

export function RepeatableTable<
  TFieldValues extends FieldValues,
  TArrayPath extends ArrayPath<TFieldValues>,
>({
  form,
  name,
  columns,
  renderForm,
  addLabel = "Add",
  emptyMessage = "No items added yet.",
  className,
}: RepeatableTableProps<TFieldValues, TArrayPath>) {
  const { fields, remove } = useFieldArray({ control: form.control, name });
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

  function closeDialog() {
    setDialogOpen(false);
    setEditIndex(null);
  }

  type Item = FieldArray<TFieldValues, TArrayPath>;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Table */}
      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    {col.header}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {fields.map((field, index) => {
                const item = field as unknown as Item;
                return (
                  <tr key={field.id} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className="px-4 py-3 text-slate-700"
                      >
                        {col.render
                          ? col.render(item[col.key as keyof Item], item)
                          : String(item[col.key as keyof Item] ?? "")}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(index)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
                          aria-label={`Edit row ${index + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-error-600"
                          aria-label={`Remove row ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openAdd}
        className="gap-1.5 border-dashed border-slate-300 text-slate-600 hover:border-accent-500 hover:text-accent-600"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editIndex !== null ? "Edit item" : addLabel}
            </DialogTitle>
          </DialogHeader>

          {renderForm(editIndex, closeDialog)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
