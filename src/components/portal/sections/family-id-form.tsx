"use client";

/**
 * FamilyIdForm — Section 2: Family Identification
 *
 * Upload passport/ILR for each family member.
 * Hidden for re-assessments.
 */

import * as React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { Plus, Trash2 } from "lucide-react";
import type { FamilyIdFormValues } from "@/lib/schemas/family-id";

export function FamilyIdForm() {
  const { control } = useFormContext<FamilyIdFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "familyMembers",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [memberName, setMemberName] = React.useState("");

  function handleAdd() {
    if (!memberName.trim()) return;
    append({
      id: crypto.randomUUID(),
      familyMemberName: memberName.trim(),
      isBritishCitizen: true,
    });
    setMemberName("");
    setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          <strong>Note:</strong> This includes all dependent children and any
          dependent elderly family members.
        </p>
      </div>

      {/* Members list */}
      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">No family members added yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-md border border-slate-200 bg-white p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-primary-900">
                  {field.familyMemberName}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
                  aria-label={`Remove ${field.familyMemberName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <YesNoToggle
                control={control}
                name={`familyMembers.${index}.isBritishCitizen`}
                label="Is this family member a British citizen?"
              />

              <ConditionalField
                show={field.isBritishCitizen === true}
              >
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">
                    Upload: UK Passport
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Document upload available once application is created.
                  </p>
                </div>
              </ConditionalField>

              <ConditionalField
                show={field.isBritishCitizen === false}
              >
                <div className="space-y-3">
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">
                      Upload: Passport
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Document upload available once application is created.
                    </p>
                  </div>
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">
                      Upload: Evidence of Indefinite Leave to Remain in the UK
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Document upload available once application is created.
                    </p>
                  </div>
                </div>
              </ConditionalField>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="gap-1.5 border-dashed border-slate-300 text-slate-600 hover:border-accent-500 hover:text-accent-600"
      >
        <Plus className="h-4 w-4" />
        Add family member
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add family member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="member-name">
                Family member name <span className="text-error-600">*</span>
              </Label>
              <Input
                id="member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
