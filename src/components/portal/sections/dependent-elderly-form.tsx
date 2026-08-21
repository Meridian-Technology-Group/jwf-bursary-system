"use client";

/**
 * DependentElderlyForm — Section 4 (workbook §4 Q12/Q13): Dependent Elderly.
 *
 * At-home count + per-elder care-home details (first/surname/DOB/care-home name/
 * yearly fees/latest invoice upload) for in-care dependants. The invoice upload
 * is required per in-care elder (rule engine, section-rules.ts).
 */

import * as React from "react";
import { useFormContext, useWatch, useFieldArray } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CountInput } from "@/components/portal/form-fields/count-input";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { DateInput } from "@/components/portal/form-fields/date-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import type { DependentElderlyFormValues } from "@/lib/schemas/dependent-elderly";
import { Plus, Trash2 } from "lucide-react";

interface DependentElderlyFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

export function DependentElderlyForm({
  applicationId,
  documentMap,
}: DependentElderlyFormProps) {
  const { control } = useFormContext<DependentElderlyFormValues>();

  const hasElderlyAtHome = useWatch({ control, name: "hasElderlyAtHome" });
  const hasElderlyInCare = useWatch({ control, name: "hasElderlyInCare" });

  const inCare = useFieldArray({ control, name: "elderlyInCare" });

  return (
    <div className="space-y-8">
      {/* At home */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Elderly dependants at home
        </legend>
        <YesNoToggle
          control={control}
          name="hasElderlyAtHome"
          label="Do you have any elderly dependant that you are providing for at home?"
          required
        />
        <ConditionalField show={hasElderlyAtHome === true}>
          <FormField
            control={control}
            name="elderlyAtHomeCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How many? <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <CountInput
                    className="w-24"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(count) => field.onChange(count)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* In care */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Elderly dependants in a care home
        </legend>
        <YesNoToggle
          control={control}
          name="hasElderlyInCare"
          label="Do you have any elderly dependant that you are providing for in a care home?"
          required
        />

        <ConditionalField show={hasElderlyInCare === true}>
          <FormField
            control={control}
            name="elderlyInCareCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How many? <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <CountInput
                    className="w-24"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(count) => field.onChange(count)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            {inCare.fields.map((f, index) => (
              <ElderCard
                key={f.id}
                index={index}
                applicationId={applicationId}
                documentMap={documentMap}
                onRemove={() => inCare.remove(index)}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              inCare.append({
                id: crypto.randomUUID(),
                firstName: "",
                surname: "",
                isOver100: false,
              })
            }
            className="gap-1.5 border-dashed border-slate-300 text-slate-600 hover:border-accent-500 hover:text-accent-600"
          >
            <Plus className="h-4 w-4" />
            Add elderly dependant
          </Button>
        </ConditionalField>
      </fieldset>
    </div>
  );
}

function ElderCard({
  index,
  applicationId,
  documentMap,
  onRemove,
}: {
  index: number;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  onRemove: () => void;
}) {
  const { control, setValue, getValues } = useFormContext<DependentElderlyFormValues>();
  const initialInvoiceId = React.useRef(
    getValues(`elderlyInCare.${index}.careHomeInvoiceDocumentId`) as string | undefined
  );
  const existingInvoice = React.useMemo(
    () => resolveDoc(initialInvoiceId.current, documentMap),
    [documentMap]
  );

  return (
    <fieldset className="rounded-md border border-slate-200 bg-white p-3 space-y-4 sm:p-4">
      <legend className="sr-only">Elderly dependant {index + 1}</legend>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-900">
          Elderly dependant {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
          aria-label="Remove dependant"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={`elderlyInCare.${index}.firstName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name <span className="text-error-600">*</span></FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`elderlyInCare.${index}.surname`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Surname <span className="text-error-600">*</span></FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DateInput control={control} name={`elderlyInCare.${index}.dateOfBirth`} label="Date of birth" />
        <FormField
          control={control}
          name={`elderlyInCare.${index}.careHomeName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Care home name <span className="text-error-600">*</span></FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <CurrencyInput
          control={control}
          name={`elderlyInCare.${index}.careHomeFees`}
          label="Yearly care home fees"
          required
        />
      </div>

      <FileUpload
        slot={`CARE_HOME_INVOICE_${index}`}
        label="Latest care-home invoice (required)"
        hint="Upload the most recent invoice showing the yearly fees."
        applicationId={applicationId}
        existingDocument={existingInvoice}
        onUploadComplete={(doc: UploadedDocument) =>
          setValue(`elderlyInCare.${index}.careHomeInvoiceDocumentId`, doc.id, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
        onRemove={() =>
          setValue(`elderlyInCare.${index}.careHomeInvoiceDocumentId`, undefined, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
    </fieldset>
  );
}
