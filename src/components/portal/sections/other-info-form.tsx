"use client";

/**
 * OtherInfoForm — Section 5 (workbook §5): Other Information Required.
 *
 * Court orders (amount + school year + evidence upload), child maintenance
 * branch (who pays → divorced/decree absolute or separated/agreement note),
 * insurance policies (amount + school year + evidence upload), and outstanding
 * school fees. Required uploads are enforced by the rule engine.
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import type { OtherInfoFormValues } from "@/lib/schemas/other-info";

interface OtherInfoFormProps {
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

export function OtherInfoForm({ applicationId, documentMap }: OtherInfoFormProps) {
  const { control, setValue, getValues } = useFormContext<OtherInfoFormValues>();

  const hasCOurtOrder = useWatch({ control, name: "hasCOurtOrder" });
  const hasChildMaintenance = useWatch({ control, name: "hasChildMaintenance" });
  const maintenancePayer = useWatch({ control, name: "maintenancePayer" });
  const maintenanceIsDivorced = useWatch({ control, name: "maintenanceIsDivorced" });
  const hasInsurancePolicy = useWatch({ control, name: "hasInsurancePolicy" });
  const hasOutstandingFees = useWatch({ control, name: "hasOutstandingFees" });

  const initialCourtDoc = React.useRef(getValues("courtOrderDocumentId"));
  const initialDecreeDoc = React.useRef(getValues("maintenanceDecreeAbsoluteDocumentId"));
  const initialInsuranceDoc = React.useRef(getValues("insurancePolicyDocumentId"));
  const existingCourt = React.useMemo(() => resolveDoc(initialCourtDoc.current, documentMap), [documentMap]);
  const existingDecree = React.useMemo(() => resolveDoc(initialDecreeDoc.current, documentMap), [documentMap]);
  const existingInsurance = React.useMemo(() => resolveDoc(initialInsuranceDoc.current, documentMap), [documentMap]);

  return (
    <div className="space-y-8">
      {/* Court orders */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">Court orders</legend>
        <YesNoToggle
          control={control}
          name="hasCOurtOrder"
          label="Do you have a court order for the payment of school fees?"
          required
        />
        <ConditionalField show={hasCOurtOrder === true}>
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput control={control} name="courtOrderTermAmount" label="Amount per term" required />
            <CurrencyInput control={control} name="courtOrderYearAmount" label="Amount per year" required />
          </div>
          <FormField
            control={control}
            name="courtOrderSchoolYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which school year does this relate to? <span className="text-error-600">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. 2026/27" {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FileUpload
            slot="COURT_ORDER"
            label="Evidence of the court order (required)"
            applicationId={applicationId}
            existingDocument={existingCourt}
            onUploadComplete={(doc: UploadedDocument) =>
              setValue("courtOrderDocumentId", doc.id, { shouldValidate: true, shouldDirty: true })
            }
            onRemove={() =>
              setValue("courtOrderDocumentId", undefined, { shouldValidate: true, shouldDirty: true })
            }
          />
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Child maintenance */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">Child maintenance</legend>
        <YesNoToggle
          control={control}
          name="hasChildMaintenance"
          label="Is there a child-maintenance arrangement (amicable or court-ordered)?"
        />
        <ConditionalField show={hasChildMaintenance === true}>
          <FormField
            control={control}
            name="maintenancePayer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who pays maintenance to the other parent? <span className="text-error-600">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-72"><SelectValue placeholder="Select..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="YOU">I pay the other parent</SelectItem>
                    <SelectItem value="EX_PARTNER">My ex-partner pays me</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <ConditionalField show={maintenancePayer === "YOU"}>
            <YesNoToggle control={control} name="maintenanceIsDivorced" label="Are you divorced?" />
            <ConditionalField show={maintenanceIsDivorced === true}>
              <FileUpload
                slot="MAINTENANCE_DECREE_ABSOLUTE"
                label="Decree absolute (required)"
                applicationId={applicationId}
                existingDocument={existingDecree}
                onUploadComplete={(doc: UploadedDocument) =>
                  setValue("maintenanceDecreeAbsoluteDocumentId", doc.id, { shouldValidate: true, shouldDirty: true })
                }
                onRemove={() =>
                  setValue("maintenanceDecreeAbsoluteDocumentId", undefined, { shouldValidate: true, shouldDirty: true })
                }
              />
            </ConditionalField>
            <ConditionalField show={maintenanceIsDivorced === false}>
              <FormField
                control={control}
                name="maintenanceAgreementNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Please confirm the mutual agreement <span className="text-error-600">*</span></FormLabel>
                    <FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ConditionalField>
          </ConditionalField>
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Insurance policies */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">Insurance policies</legend>
        <YesNoToggle
          control={control}
          name="hasInsurancePolicy"
          label="Do you have the benefit of any insurance policies specifically to pay school fees?"
          required
        />
        <ConditionalField show={hasInsurancePolicy === true}>
          <CurrencyInput control={control} name="insurancePolicyAmount" label="Amount to be paid this school year" required />
          <FormField
            control={control}
            name="insurancePolicySchoolYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which school year does this relate to? <span className="text-error-600">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. 2026/27" {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FileUpload
            slot="INSURANCE_POLICY"
            label="Evidence of the insurance policy (required)"
            applicationId={applicationId}
            existingDocument={existingInsurance}
            onUploadComplete={(doc: UploadedDocument) =>
              setValue("insurancePolicyDocumentId", doc.id, { shouldValidate: true, shouldDirty: true })
            }
            onRemove={() =>
              setValue("insurancePolicyDocumentId", undefined, { shouldValidate: true, shouldDirty: true })
            }
          />
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Outstanding school fees */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">Outstanding school fees</legend>
        <YesNoToggle
          control={control}
          name="hasOutstandingFees"
          label="Are any outstanding school fees owed at any other school?"
          required
        />
        <ConditionalField show={hasOutstandingFees === true}>
          <FormField
            control={control}
            name="outstandingFeesSchoolName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name(s) of school <span className="text-error-600">*</span></FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <CurrencyInput control={control} name="outstandingFeesAmount" label="Amount owed" required />
        </ConditionalField>
      </fieldset>
    </div>
  );
}
