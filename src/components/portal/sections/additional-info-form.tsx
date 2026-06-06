"use client";

/**
 * AdditionalInfoForm — Section 7 (workbook §7): Additional Information.
 *
 * Circumstances checklist (each with a supporting-document upload when it
 * applies), a MANDATORY free-text narrative (≥1 char — enforced by the schema),
 * and a general upload area for documents not covered by the checklist.
 */

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import type { AdditionalInfoFormValues } from "@/lib/schemas/additional-info";

type CircumstanceKey = keyof Pick<
  AdditionalInfoFormValues,
  | "divorced"
  | "separated"
  | "sickUnableToWork"
  | "rent"
  | "madeRedundant"
  | "receivingBenefits"
>;

const CIRCUMSTANCES: { key: CircumstanceKey; label: string; slot: string }[] = [
  { key: "divorced", label: "Divorced (if applicable)", slot: "CIRCUMSTANCE_DIVORCED" },
  { key: "separated", label: "Separated (if applicable)", slot: "CIRCUMSTANCE_SEPARATED" },
  { key: "sickUnableToWork", label: "Sick / unable to work", slot: "CIRCUMSTANCE_SICK" },
  { key: "rent", label: "Paying rent (current statement or lease)", slot: "CIRCUMSTANCE_RENT" },
  { key: "madeRedundant", label: "Been made redundant or lost employment", slot: "CIRCUMSTANCE_REDUNDANT" },
  { key: "receivingBenefits", label: "Receiving benefits", slot: "CIRCUMSTANCE_BENEFITS" },
];

function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

function CircumstanceRow({
  item,
  applicationId,
  documentMap,
}: {
  item: (typeof CIRCUMSTANCES)[0];
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}) {
  const { control, setValue, getValues } = useFormContext<AdditionalInfoFormValues>();
  const applies = useWatch({ control, name: `${item.key}.applies` });
  const initialDocId = React.useRef(getValues(`${item.key}.documentId`));
  const existing = React.useMemo(() => resolveDoc(initialDocId.current, documentMap), [documentMap]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
      <YesNoToggle control={control} name={`${item.key}.applies`} label={item.label} />
      <ConditionalField show={applies === true}>
        <FileUpload
          slot={item.slot}
          label={`Supporting document for "${item.label}"`}
          hint="Optional — upload any evidence that supports this circumstance."
          applicationId={applicationId}
          existingDocument={existing}
          onUploadComplete={(doc: UploadedDocument) =>
            setValue(`${item.key}.documentId`, doc.id, { shouldValidate: true, shouldDirty: true })
          }
          onRemove={() =>
            setValue(`${item.key}.documentId`, undefined, { shouldValidate: true, shouldDirty: true })
          }
        />
      </ConditionalField>
    </div>
  );
}

interface AdditionalInfoFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

export function AdditionalInfoForm({ applicationId, documentMap }: AdditionalInfoFormProps) {
  const { control, watch, setValue, getValues } = useFormContext<AdditionalInfoFormValues>();
  const narrative = watch("additionalNarrative") ?? "";
  const maxChars = 3000;

  const additionalIds = useWatch({ control, name: "additionalDocumentIds" }) ?? [];
  const initialAdditional = React.useRef(getValues("additionalDocumentIds") ?? []);
  const existingAdditional = React.useMemo(
    () =>
      initialAdditional.current
        .map((id) => resolveDoc(id, documentMap))
        .filter((d): d is NonNullable<typeof d> => Boolean(d)),
    [documentMap]
  );

  return (
    <div className="space-y-6">
      {/* Circumstances checklist */}
      <div>
        <h3 className="text-base font-semibold text-primary-900 mb-2">Circumstances checklist</h3>
        <p className="text-sm text-slate-500 mb-4">
          Please use this form to tell us if, in a current or previous application, any of
          the following apply:
        </p>
        <div className="space-y-3">
          {CIRCUMSTANCES.map((item) => (
            <CircumstanceRow
              key={item.key}
              item={item}
              applicationId={applicationId}
              documentMap={documentMap}
            />
          ))}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Mandatory narrative */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-primary-900">Additional information</h3>
        <p className="text-sm text-slate-500">
          Please help us identify any difficulties which you think we may consider to be
          factors in assessing need for this award. The bursary committee is unable to
          consider any information that is not included in your application. If there is
          nothing further to add, please enter &ldquo;N/A&rdquo;.
        </p>
        <FormField
          control={control}
          name="additionalNarrative"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Additional narrative <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={8}
                  placeholder="Provide any additional context relevant to your application (or N/A)..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <div className="flex justify-end">
                <span className={narrative.length > maxChars * 0.9 ? "text-xs text-warning-600" : "text-xs text-slate-400"}>
                  {narrative.length} / {maxChars} characters
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <hr className="border-slate-200" />

      {/* General supporting documents not covered by the checklist */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-primary-900">Other supporting documents</h3>
        <p className="text-sm text-slate-500">
          Upload any documents relevant to your application that are not covered elsewhere
          (e.g. health, separation, or other pastoral context).
        </p>
        <FileUpload
          multiple
          slot="ADDITIONAL_DOCUMENT"
          label="Additional documents"
          applicationId={applicationId}
          existingDocuments={existingAdditional}
          onUploadComplete={(doc: UploadedDocument) =>
            setValue("additionalDocumentIds", [...additionalIds.filter((id) => id !== doc.id), doc.id], {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          onRemove={(docId: string) =>
            setValue("additionalDocumentIds", additionalIds.filter((id) => id !== docId), {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />
      </div>
    </div>
  );
}
