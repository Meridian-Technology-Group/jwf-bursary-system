"use client";

/**
 * AssetsLiabilitiesForm — Section 8: Parents' Assets & Liabilities
 *
 * Property ownership, vehicles, investments, mortgages, and document uploads:
 *   - Council tax bill (always required)
 *   - Bank statements Parent 1 (always required)
 *   - Bank statements Parent 2 (when isSoleParent is false)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { AssetsLiabilitiesFormValues } from "@/lib/schemas/assets-liabilities";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";

interface AssetsLiabilitiesFormProps {
  /** From PARENT_DETAILS — when true, the P2 bank-statement block is hidden. */
  isSoleParent?: boolean;
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

export function AssetsLiabilitiesForm({
  isSoleParent,
  applicationId,
  documentMap,
}: AssetsLiabilitiesFormProps) {
  const { control, setValue, getValues } = useFormContext<AssetsLiabilitiesFormValues>();

  const hasOtherProperties = useWatch({ control, name: "hasOtherProperties" });
  const hasHirePurchase = useWatch({ control, name: "hasHirePurchase" });

  // Stable initial doc ID refs so FileUpload existingDocument prop doesn't
  // change between renders and reset the component's internal state.
  const initialCouncilTaxDocId = React.useRef(getValues("councilTaxDocumentId"));

  const existingCouncilTax = React.useMemo(
    () => resolveDoc(initialCouncilTaxDocId.current, documentMap),
    [documentMap]
  );

  // Bank statement P1 — the field is an array; resolve the first entry for display
  // (FileUpload is single-file; the array is kept for multi-upload in a future WP)
  const initialP1Ids = React.useRef(getValues("parent1BankStatementDocumentIds") ?? []);
  const existingP1BankStatement = React.useMemo(() => {
    const firstId = initialP1Ids.current[0];
    return resolveDoc(firstId, documentMap);
  }, [documentMap]);

  const initialP2Ids = React.useRef(getValues("parent2BankStatementDocumentIds") ?? []);
  const existingP2BankStatement = React.useMemo(() => {
    const firstId = initialP2Ids.current[0];
    return resolveDoc(firstId, documentMap);
  }, [documentMap]);

  return (
    <div className="space-y-8">
      {/* Capital assets */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Capital assets — what you own
        </legend>

        <FormField
          control={control}
          name="propertyOwnership"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Do you own or rent your home?{" "}
                <span className="text-error-600">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="OWN">Own</SelectItem>
                  <SelectItem value="RENT">Rent</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CurrencyInput
            control={control}
            name="residenceValue"
            label="Approximate value of residence/property"
            required
          />
          <CurrencyInput
            control={control}
            name="carValue"
            label="Value of your car(s)"
            required
          />
          <CurrencyInput
            control={control}
            name="otherPossessionsValue"
            label="Value of other possessions including home contents"
            required
          />
          <CurrencyInput
            control={control}
            name="stocksAndSharesValue"
            label="Total of all stocks or shares / equities"
            required
          />
          <CurrencyInput
            control={control}
            name="investmentsValue"
            label="Approximate value of investments (Bonds, PEPs, ISAs, etc.)"
            required
          />
          <CurrencyInput
            control={control}
            name="otherAssetsValue"
            label="Approximate value of any other assets not included above"
            required
          />
        </div>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Other properties */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Other properties
        </legend>

        <YesNoToggle
          control={control}
          name="hasOtherProperties"
          label="Do you have any other properties?"
          required
        />

        <ConditionalField show={hasOtherProperties === true}>
          <CurrencyInput
            control={control}
            name="otherPropertiesTotalValue"
            label="Total value of any other properties owned"
            required
          />
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              Property list table will be fully implemented in a future work
              package.
            </p>
          </div>
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Liabilities */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Capital liabilities — what you owe
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CurrencyInput
            control={control}
            name="outstandingMainMortgage"
            label="Outstanding mortgage (main family home)"
            required
          />
          <CurrencyInput
            control={control}
            name="totalOtherMortgages"
            label="Total of all other outstanding mortgages"
            required
          />
          <CurrencyInput
            control={control}
            name="currentOverdraft"
            label="Total of any current overdraft"
            required
          />
        </div>

        <YesNoToggle
          control={control}
          name="hasHirePurchase"
          label="Do you have any hire / hire purchase agreements?"
          required
        />

        <ConditionalField show={hasHirePurchase === true}>
          <CurrencyInput
            control={control}
            name="hirePurchaseBalance"
            label="Total of all hire purchase balances outstanding"
            required
          />
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Supporting documents */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Supporting documents
        </legend>

        {/* Council tax bill — always required */}
        <FileUpload
          slot="COUNCIL_TAX"
          label="Council tax bill (required)"
          hint="Upload your most recent council tax bill showing the property address."
          applicationId={applicationId}
          existingDocument={existingCouncilTax}
          onUploadComplete={(doc: UploadedDocument) => {
            setValue("councilTaxDocumentId", doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onRemove={() => {
            setValue("councilTaxDocumentId", undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
        <FormField
          control={control}
          name="councilTaxDocumentId"
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl><input type="hidden" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bank statements — Parent 1 (always required) */}
        <FileUpload
          slot="BANK_STATEMENT_PARENT_1"
          label="Bank statement — Parent / Guardian 1 (required)"
          hint="Upload at least one recent bank statement for Parent/Guardian 1 (last 3 months preferred)."
          applicationId={applicationId}
          existingDocument={existingP1BankStatement}
          onUploadComplete={(doc: UploadedDocument) => {
            // Append the new doc ID to the array field
            const current = getValues("parent1BankStatementDocumentIds") ?? [];
            setValue(
              "parent1BankStatementDocumentIds",
              [...current.filter((id) => id !== doc.id), doc.id],
              { shouldValidate: true, shouldDirty: true }
            );
          }}
          onRemove={(docId: string) => {
            const current = getValues("parent1BankStatementDocumentIds") ?? [];
            setValue(
              "parent1BankStatementDocumentIds",
              current.filter((id) => id !== docId),
              { shouldValidate: true, shouldDirty: true }
            );
          }}
        />
        <FormField
          control={control}
          name="parent1BankStatementDocumentIds"
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl><input type="hidden" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bank statements — Parent 2 (when isSoleParent is false) */}
        {!isSoleParent && (
          <>
            <FileUpload
              slot="BANK_STATEMENT_PARENT_2"
              label="Bank statement — Parent / Guardian 2 (required)"
              hint="Upload at least one recent bank statement for Parent/Guardian 2 (last 3 months preferred)."
              applicationId={applicationId}
              existingDocument={existingP2BankStatement}
              onUploadComplete={(doc: UploadedDocument) => {
                const current = getValues("parent2BankStatementDocumentIds") ?? [];
                setValue(
                  "parent2BankStatementDocumentIds",
                  [...current.filter((id) => id !== doc.id), doc.id],
                  { shouldValidate: true, shouldDirty: true }
                );
              }}
              onRemove={(docId: string) => {
                const current = getValues("parent2BankStatementDocumentIds") ?? [];
                setValue(
                  "parent2BankStatementDocumentIds",
                  current.filter((id) => id !== docId),
                  { shouldValidate: true, shouldDirty: true }
                );
              }}
            />
            <FormField
              control={control}
              name="parent2BankStatementDocumentIds"
              render={() => (
                <FormItem className="hidden" aria-hidden="true">
                  <FormControl><input type="hidden" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </fieldset>

      <hr className="border-slate-200" />

      {/* Documents confirmation */}
      <FormField
        control={control}
        name="documentsConfirmed"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <FormLabel className="cursor-pointer font-normal text-slate-700">
                I confirm that all documents uploaded on this page are current
                and legible.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
