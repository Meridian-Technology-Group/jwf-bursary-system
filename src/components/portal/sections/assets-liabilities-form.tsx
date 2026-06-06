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
import { useFormContext, useWatch, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
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
  const otherProps = useFieldArray({ control, name: "otherProperties" });

  // Stable initial doc ID refs so FileUpload existingDocument prop doesn't
  // change between renders and reset the component's internal state.
  const initialCouncilTaxDocId = React.useRef(getValues("councilTaxDocumentId"));

  const existingCouncilTax = React.useMemo(
    () => resolveDoc(initialCouncilTaxDocId.current, documentMap),
    [documentMap]
  );

  // Bank statements — multi-file slots. Resolve every saved ID for display.
  const initialP1Ids = React.useRef(getValues("parent1BankStatementDocumentIds") ?? []);
  const existingP1BankStatements = React.useMemo(() => {
    return initialP1Ids.current
      .map((id) => resolveDoc(id, documentMap))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));
  }, [documentMap]);

  const initialP2Ids = React.useRef(getValues("parent2BankStatementDocumentIds") ?? []);
  const existingP2BankStatements = React.useMemo(() => {
    return initialP2Ids.current
      .map((id) => resolveDoc(id, documentMap))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));
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
          <div className="space-y-4">
            {otherProps.fields.map((f, index) => (
              <OtherPropertyCard
                key={f.id}
                index={index}
                applicationId={applicationId}
                documentMap={documentMap}
                onRemove={() => otherProps.remove(index)}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              otherProps.append({
                id: crypto.randomUUID(),
                address: "",
                postcode: "",
                value: 0,
                mortgageBalance: 0,
                monthlyRepayment: 0,
                usedAsRental: false,
              })
            }
            className="gap-1.5 border-dashed border-slate-300 text-slate-600 hover:border-accent-500 hover:text-accent-600"
          >
            <Plus className="h-4 w-4" />
            Add property
          </Button>
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

        {/* Bank statements — Parent 1 (always required, multi-file) */}
        <FileUpload
          multiple
          slot="BANK_STATEMENT_PARENT_1"
          label="Bank statements — Parent / Guardian 1 (required)"
          hint="Upload your three most recent monthly bank statements for Parent/Guardian 1."
          applicationId={applicationId}
          existingDocuments={existingP1BankStatements}
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
              multiple
              slot="BANK_STATEMENT_PARENT_2"
              label="Bank statements — Parent / Guardian 2 (required)"
              hint="Upload your three most recent monthly bank statements for Parent/Guardian 2."
              applicationId={applicationId}
              existingDocuments={existingP2BankStatements}
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

// ─── Per other-property card (workbook §6/7 Q2) ──────────────────────────────

function OtherPropertyCard({
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
  const { control, setValue, getValues } = useFormContext<AssetsLiabilitiesFormValues>();
  const mortgageBalance = useWatch({ control, name: `otherProperties.${index}.mortgageBalance` });
  const initialStmtId = React.useRef(
    getValues(`otherProperties.${index}.mortgageStatementDocumentId`) as string | undefined
  );
  const existingStmt = React.useMemo(
    () => resolveDoc(initialStmtId.current, documentMap),
    [documentMap]
  );

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-900">Property {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"
          aria-label="Remove property"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <FormField
        control={control}
        name={`otherProperties.${index}.address`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address line 1 <span className="text-error-600">*</span></FormLabel>
            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`otherProperties.${index}.postcode`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Postcode <span className="text-error-600">*</span></FormLabel>
            <FormControl><Input className="uppercase" {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CurrencyInput control={control} name={`otherProperties.${index}.value`} label="Current market value" required />
        <CurrencyInput control={control} name={`otherProperties.${index}.mortgageBalance`} label="Current mortgage balance" />
        <CurrencyInput control={control} name={`otherProperties.${index}.monthlyRepayment`} label="Monthly mortgage repayment" />
      </div>

      <YesNoToggle
        control={control}
        name={`otherProperties.${index}.usedAsRental`}
        label="Is this property used as a rental?"
      />

      <ConditionalField show={Number(mortgageBalance ?? 0) > 0}>
        <FileUpload
          slot={`OTHER_PROPERTY_MORTGAGE_${index}`}
          label="Latest mortgage statement (required)"
          hint="Required because a mortgage balance is declared for this property."
          applicationId={applicationId}
          existingDocument={existingStmt}
          onUploadComplete={(doc: UploadedDocument) =>
            setValue(`otherProperties.${index}.mortgageStatementDocumentId`, doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          onRemove={() =>
            setValue(`otherProperties.${index}.mortgageStatementDocumentId`, undefined, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />
      </ConditionalField>
    </div>
  );
}
