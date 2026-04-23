"use client";

/**
 * FamilyIdForm — Section 2: Family Identification
 *
 * Upload passport/ILR for each family member.
 * Hidden for re-assessments.
 */

import * as React from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
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
import { FileUpload } from "@/components/portal/file-upload";
import type { UploadedDocument } from "@/components/portal/file-upload";
import { Plus, Trash2 } from "lucide-react";
import type { FamilyIdFormValues } from "@/lib/schemas/family-id";
import type { DocumentMeta } from "@/lib/db/queries/applications";

interface FamilyIdFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

export function FamilyIdForm({ applicationId, documentMap }: FamilyIdFormProps) {
  const { control, setValue } = useFormContext<FamilyIdFormValues>();
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
            <FamilyMemberCard
              key={field.id}
              index={index}
              fieldId={field.id}
              familyMemberName={field.familyMemberName}
              control={control}
              applicationId={applicationId}
              documentMap={documentMap}
              setValue={setValue}
              onRemove={() => remove(index)}
            />
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

// ─── Per-member card ──────────────────────────────────────────────────────────

interface FamilyMemberCardProps {
  index: number;
  fieldId: string;
  familyMemberName: string;
  control: ReturnType<typeof useFormContext<FamilyIdFormValues>>["control"];
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  setValue: ReturnType<typeof useFormContext<FamilyIdFormValues>>["setValue"];
  onRemove: () => void;
}

function FamilyMemberCard({
  index,
  familyMemberName,
  control,
  applicationId,
  documentMap,
  setValue,
  onRemove,
}: FamilyMemberCardProps) {
  const isBritishCitizen = useWatch({
    control,
    name: `familyMembers.${index}.isBritishCitizen`,
  });

  // Resolve existing documents from documentMap
  const form = useFormContext<FamilyIdFormValues>();
  const existingDocs = React.useMemo(() => {
    if (!documentMap) return { ukPassport: undefined, passport: undefined, ilr: undefined };
    const members = form.getValues("familyMembers");
    const member = members?.[index];
    const ukId = member?.ukPassportDocumentId;
    const passId = member?.passportDocumentId;
    const ilrId = member?.ilrDocumentId;
    const toExisting = (id?: string) => {
      if (!id || !documentMap[id]) return undefined;
      const d = documentMap[id];
      return { id: d.id, filename: d.filename, fileSize: d.fileSize, uploadedAt: d.uploadedAt };
    };
    return { ukPassport: toExisting(ukId), passport: toExisting(passId), ilr: toExisting(ilrId) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentMap, index]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-primary-900">
          {familyMemberName}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
          aria-label={`Remove ${familyMemberName}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <YesNoToggle
        control={control}
        name={`familyMembers.${index}.isBritishCitizen`}
        label="Is this family member a British citizen?"
      />

      <ConditionalField show={isBritishCitizen === true}>
        <FileUpload
          slot={`FAMILY_ID_PASSPORT_${index}`}
          label="UK Passport"
          hint="Upload a copy of this family member's UK passport."
          applicationId={applicationId}
          existingDocument={existingDocs.ukPassport}
          onUploadComplete={(doc: UploadedDocument) => {
            setValue(`familyMembers.${index}.ukPassportDocumentId`, doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onRemove={() => {
            setValue(`familyMembers.${index}.ukPassportDocumentId`, undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
      </ConditionalField>

      <ConditionalField show={isBritishCitizen === false}>
        <div className="space-y-3">
          <FileUpload
            slot={`FAMILY_ID_PASSPORT_${index}`}
            label="Passport"
            hint="Upload a copy of this family member's passport."
            applicationId={applicationId}
            existingDocument={existingDocs.passport}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`familyMembers.${index}.passportDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`familyMembers.${index}.passportDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FileUpload
            slot={`FAMILY_ID_ILR_${index}`}
            label="Evidence of Indefinite Leave to Remain in the UK"
            hint="Upload evidence of this family member's right to remain."
            applicationId={applicationId}
            existingDocument={existingDocs.ilr}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`familyMembers.${index}.ilrDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`familyMembers.${index}.ilrDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
        </div>
      </ConditionalField>
    </div>
  );
}
