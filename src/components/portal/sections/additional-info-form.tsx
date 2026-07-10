"use client";

/**
 * AdditionalInfoForm — Additional Information.
 *
 * A free-form section: an OPTIONAL narrative where the applicant can share any
 * contextual information relevant to their bursary application, plus an upload
 * area for any supporting documents not covered by the checklist elsewhere.
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
import { FileUpload } from "@/components/portal/file-upload";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import type { AdditionalInfoFormValues } from "@/lib/schemas/additional-info";

function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

interface AdditionalInfoFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

export function AdditionalInfoForm({ applicationId, documentMap }: AdditionalInfoFormProps) {
  const { control, watch, setValue, getValues } = useFormContext<AdditionalInfoFormValues>();
  const narrative = watch("additionalNarrative") ?? "";
  const maxChars = 10000;

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
      <p className="text-sm text-slate-600">
        If you would like to share with us some additional contextual information
        which you think may be relevant to us when assessing your bursary
        application, please use the field below to add your comments and use the
        uploading section below the text box to attach to your form any documents
        which do not show in our checklist.
      </p>

      <FormField
        control={control}
        name="additionalNarrative"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Your comments</FormLabel>
            <FormControl>
              <Textarea
                rows={6}
                placeholder="Add any additional context relevant to your application..."
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
  );
}
