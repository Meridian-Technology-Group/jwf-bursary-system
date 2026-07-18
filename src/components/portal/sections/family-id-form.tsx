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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type DocumentType =
  | "BRITISH_PASSPORT"
  | "SETTLED_STATUS"
  | "ILR_VISA"
  | "OTHER";

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "BRITISH_PASSPORT", label: "British passport" },
  { value: "SETTLED_STATUS", label: "Settled Status" },
  { value: "ILR_VISA", label: "ILR VISA status" },
  { value: "OTHER", label: "Other" },
];

export function FamilyIdForm({ applicationId, documentMap }: FamilyIdFormProps) {
  const { control, setValue } = useFormContext<FamilyIdFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "familyMembers",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [memberName, setMemberName] = React.useState("");
  const [memberType, setMemberType] = React.useState<"CHILD" | "ADULT" | "">("");
  const [relationship, setRelationship] = React.useState("");
  const [documentType, setDocumentType] = React.useState<DocumentType | "">("");

  function handleAdd() {
    if (!memberName.trim() || !memberType || !relationship.trim() || !documentType)
      return;
    append({
      id: crypto.randomUUID(),
      familyMemberName: memberName.trim(),
      role: "OTHER",
      memberType,
      relationshipToApplicant: relationship.trim(),
      documentType,
      isBritishCitizen: documentType === "BRITISH_PASSPORT",
    });
    setMemberName("");
    setMemberType("");
    setRelationship("");
    setDocumentType("");
    setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          In this section, we will need the details and evidence of the
          indefinite leave to remain in the UK status for every member of the
          household (please include all children, even older ones who may be at
          Uni but still financially dependent; do not include older children who
          are financially independent and who have left the family home.)
        </p>
        <p className="mt-3 text-sm text-primary-800">
          Please enter their relationship status to the bursary applicant (i.e.
          mother, father, brother, sister)
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
              role={field.role ?? "OTHER"}
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
            <div className="space-y-1.5">
              <Label>
                Is this a child or an adult?{" "}
                <span className="text-error-600">*</span>
              </Label>
              <div className="flex gap-2">
                {(["CHILD", "ADULT"] as const).map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={memberType === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMemberType(opt)}
                  >
                    {opt === "CHILD" ? "Child" : "Adult"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-relationship">
                Relationship to the bursary applicant{" "}
                <span className="text-error-600">*</span>
              </Label>
              <Input
                id="member-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. mother, father, brother, sister"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-document-type">
                Which document are you uploading?{" "}
                <span className="text-error-600">*</span>
              </Label>
              <Select
                value={documentType}
                onValueChange={(v) => setDocumentType(v as DocumentType)}
              >
                <SelectTrigger id="member-document-type">
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button
              type="button"
              onClick={handleAdd}
              disabled={
                !memberName.trim() ||
                !memberType ||
                !relationship.trim() ||
                !documentType
              }
            >
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
  role: "CHILD" | "GUARDIAN" | "OTHER";
  control: ReturnType<typeof useFormContext<FamilyIdFormValues>>["control"];
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  setValue: ReturnType<typeof useFormContext<FamilyIdFormValues>>["setValue"];
  onRemove: () => void;
}

const ROLE_CAPTION: Record<"CHILD" | "GUARDIAN", string> = {
  CHILD: "Child named on this application",
  GUARDIAN: "Parent / guardian named on this application",
};

function FamilyMemberCard({
  index,
  familyMemberName,
  role,
  control,
  applicationId,
  documentMap,
  setValue,
  onRemove,
}: FamilyMemberCardProps) {
  // CHILD / GUARDIAN rows are auto-added, name-locked and always required — no
  // child/adult toggle and no remove control. Only OTHER rows are editable (Q1).
  const isLocked = role !== "OTHER";
  const isBritishCitizen = useWatch({
    control,
    name: `familyMembers.${index}.isBritishCitizen`,
  });
  const memberType = useWatch({
    control,
    name: `familyMembers.${index}.memberType`,
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
    <fieldset className="rounded-md border border-slate-200 bg-white p-3 space-y-4 sm:p-4">
      <legend className="sr-only">{familyMemberName}</legend>
      <div className="flex items-start justify-between">
        <div>
          {isLocked && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {ROLE_CAPTION[role as "CHILD" | "GUARDIAN"]}
            </p>
          )}
          <span className="font-medium text-sm text-primary-900">
            {familyMemberName || "—"}
          </span>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
            aria-label={`Remove ${familyMemberName}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isLocked && (
        <div className="space-y-1.5">
          <Label>
            Is this family member a child or an adult?{" "}
            <span className="text-error-600">*</span>
          </Label>
          <div className="flex gap-2">
            {(["CHILD", "ADULT"] as const).map((opt) => (
              <Button
                key={opt}
                type="button"
                variant={memberType === opt ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setValue(`familyMembers.${index}.memberType`, opt, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                {opt === "CHILD" ? "Child" : "Adult"}
              </Button>
            ))}
          </div>
        </div>
      )}

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
    </fieldset>
  );
}
