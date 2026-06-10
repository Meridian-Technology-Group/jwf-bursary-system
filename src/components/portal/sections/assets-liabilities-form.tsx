"use client";

/**
 * AssetsLiabilitiesForm — Parents' Assets & Liabilities
 *
 * Three fieldsets mirroring the PARENT'S ASSETS & LIABILITIES workbook tab:
 *   1. Property         — ownership/rent, mortgage, other properties, charging
 *                         order, council tax letter.
 *   2. Car & contents   — own/lease a car, public transport, possessions.
 *   3. Financial        — cash, investments, per-parent bank/investment docs,
 *                         personal debt + supporting documents.
 *
 * Blocking document gates live in section-rules.ts (single source of truth);
 * this form renders the upload controls and binds the resulting IDs.
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { AssetsLiabilitiesFormValues } from "@/lib/schemas/assets-liabilities";
import type { DocumentSlot } from "@/lib/documents/slots";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";

interface AssetsLiabilitiesFormProps {
  /** From PARENT_DETAILS — when true, the Parent 2 financial block is hidden. */
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

/** Array-valued doc-id field names (string[] in the schema). */
type ArrayDocField =
  | "parent1CurrentAccountDocumentIds"
  | "parent1SavingsAccountDocumentIds"
  | "parent1InvestmentDocumentIds"
  | "parent2CurrentAccountDocumentIds"
  | "parent2SavingsAccountDocumentIds"
  | "parent2InvestmentDocumentIds"
  | "creditCardStatementDocumentIds"
  | "loanStatementDocumentIds"
  | "otherDebtDocumentIds";

/**
 * Multi-file upload bound to a string[] doc-id field. Mirrors the existing
 * append-on-upload / filter-on-remove wiring, with a stable initial-IDs ref so
 * the FileUpload's existingDocuments prop never changes between renders.
 */
function MultiDocUpload({
  field,
  slot,
  label,
  hint,
  applicationId,
  documentMap,
}: {
  field: ArrayDocField;
  slot: DocumentSlot;
  label: string;
  hint?: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}) {
  const { control, setValue, getValues } = useFormContext<AssetsLiabilitiesFormValues>();
  const initialIds = React.useRef((getValues(field) as string[] | undefined) ?? []);
  const existing = React.useMemo(
    () =>
      initialIds.current
        .map((id) => resolveDoc(id, documentMap))
        .filter((d): d is NonNullable<typeof d> => Boolean(d)),
    [documentMap]
  );

  return (
    <>
      <FileUpload
        multiple
        slot={slot}
        label={label}
        hint={hint}
        applicationId={applicationId}
        existingDocuments={existing}
        onUploadComplete={(doc: UploadedDocument) => {
          const current = (getValues(field) as string[] | undefined) ?? [];
          setValue(
            field,
            [...current.filter((id) => id !== doc.id), doc.id],
            { shouldValidate: true, shouldDirty: true }
          );
        }}
        onRemove={(docId: string) => {
          const current = (getValues(field) as string[] | undefined) ?? [];
          setValue(
            field,
            current.filter((id) => id !== docId),
            { shouldValidate: true, shouldDirty: true }
          );
        }}
      />
      <FormField
        control={control}
        name={field}
        render={() => (
          <FormItem className="hidden" aria-hidden="true">
            <FormControl><input type="hidden" /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

/**
 * Single-file upload bound to a scalar string doc-id field, with the hidden
 * FormField so a required-doc error can surface beneath it.
 */
function SingleDocUpload({
  field,
  slot,
  label,
  hint,
  applicationId,
  documentMap,
}: {
  field:
    | "mortgageStatementDocumentId"
    | "tenancyAgreementDocumentId"
    | "housingBenefitLetterDocumentId"
    | "relativeLetterDocumentId"
    | "carLeaseAgreementDocumentId"
    | "councilTaxDocumentId";
  slot: DocumentSlot;
  label: string;
  hint?: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}) {
  const { control, setValue, getValues } = useFormContext<AssetsLiabilitiesFormValues>();
  const initialId = React.useRef(getValues(field) as string | undefined);
  const existing = React.useMemo(
    () => resolveDoc(initialId.current, documentMap),
    [documentMap]
  );

  return (
    <>
      <FileUpload
        slot={slot}
        label={label}
        hint={hint}
        applicationId={applicationId}
        existingDocument={existing}
        onUploadComplete={(doc: UploadedDocument) => {
          setValue(field, doc.id, { shouldValidate: true, shouldDirty: true });
        }}
        onRemove={() => {
          setValue(field, undefined, { shouldValidate: true, shouldDirty: true });
        }}
      />
      <FormField
        control={control}
        name={field}
        render={() => (
          <FormItem className="hidden" aria-hidden="true">
            <FormControl><input type="hidden" /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

const RENT_AGREEMENT_OPTIONS = [
  { value: "PRIVATE", label: "We rent privately" },
  { value: "COUNCIL", label: "We rent from the council" },
  {
    value: "COUNCIL_NO_RENT",
    label: "We rent from the council and pay no rent",
  },
  {
    value: "RELATIVES",
    label: "We live with relatives, no rent but contribute to bills",
  },
] as const;

const CAR_OWNERSHIP_OPTIONS = [
  { value: "OWN", label: "I own a car / cars" },
  { value: "LEASE", label: "I lease a car / cars" },
] as const;

export function AssetsLiabilitiesForm({
  isSoleParent,
  applicationId,
  documentMap,
}: AssetsLiabilitiesFormProps) {
  const { control } = useFormContext<AssetsLiabilitiesFormValues>();

  const propertyOwnership = useWatch({ control, name: "propertyOwnership" });
  const hasMortgage = useWatch({ control, name: "hasMortgage" });
  const rentAgreementType = useWatch({ control, name: "rentAgreementType" });
  const hasOtherProperties = useWatch({ control, name: "hasOtherProperties" });
  const hasChargingOrder = useWatch({ control, name: "hasChargingOrder" });
  const carOwnership = useWatch({ control, name: "carOwnership" });
  const usesPublicTransport = useWatch({ control, name: "usesPublicTransport" });
  const parent1OwnsInvestments = useWatch({ control, name: "parent1OwnsInvestments" });
  const parent2OwnsInvestments = useWatch({ control, name: "parent2OwnsInvestments" });
  const hasPersonalDebt = useWatch({ control, name: "hasPersonalDebt" });

  const otherProps = useFieldArray({ control, name: "otherProperties" });

  const showMonthlyRent =
    rentAgreementType === "PRIVATE" || rentAgreementType === "COUNCIL";

  return (
    <div className="space-y-8">
      {/* ── 1. Property ──────────────────────────────────────────────────── */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Property
        </legend>

        <FormField
          control={control}
          name="propertyOwnership"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Do you own or rent your family home?{" "}
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

        {/* OWN branch */}
        <ConditionalField show={propertyOwnership === "OWN"}>
          <CurrencyInput
            control={control}
            name="residenceValue"
            label="Approximate market value of your family home"
            required
          />
          <YesNoToggle
            control={control}
            name="hasMortgage"
            label="Do you have a mortgage on your family home?"
            required
          />
          <ConditionalField show={hasMortgage === true}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyInput
                control={control}
                name="mortgageBalance"
                label="Mortgage balance still due"
                required
              />
              <CurrencyInput
                control={control}
                name="monthlyMortgageRepayment"
                label="Monthly mortgage repayment"
                required
              />
            </div>
            <SingleDocUpload
              field="mortgageStatementDocumentId"
              slot="MAIN_MORTGAGE_STATEMENT"
              label="Latest mortgage statement"
              hint="Upload your most recent mortgage statement for your family home."
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>
        </ConditionalField>

        {/* RENT branch */}
        <ConditionalField show={propertyOwnership === "RENT"}>
          <FormField
            control={control}
            name="rentAgreementType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>
                  Can you tell us more about your rent agreement?{" "}
                  <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-2"
                  >
                    {RENT_AGREEMENT_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`rent-${opt.value}`} />
                        <Label htmlFor={`rent-${opt.value}`} className="font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ConditionalField show={showMonthlyRent}>
            <CurrencyInput
              control={control}
              name="monthlyRent"
              label="Monthly rent"
              required
            />
            <SingleDocUpload
              field="tenancyAgreementDocumentId"
              slot="TENANCY_AGREEMENT"
              label="Tenancy agreement"
              hint="Upload your current tenancy agreement."
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>

          <ConditionalField show={rentAgreementType === "COUNCIL_NO_RENT"}>
            <SingleDocUpload
              field="housingBenefitLetterDocumentId"
              slot="HOUSING_BENEFIT_LETTER"
              label="Housing benefit letter"
              hint="Upload a letter confirming your housing benefit arrangement."
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>

          <ConditionalField show={rentAgreementType === "RELATIVES"}>
            <SingleDocUpload
              field="relativeLetterDocumentId"
              slot="RELATIVE_LETTER"
              label="Letter from your relative"
              hint="Upload a letter from the relative you live with confirming the arrangement."
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>
        </ConditionalField>

        {/* Other properties */}
        <YesNoToggle
          control={control}
          name="hasOtherProperties"
          label="Do you own any other properties besides your family home?"
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

        {/* Charging order */}
        <YesNoToggle
          control={control}
          name="hasChargingOrder"
          label="Do you have any charging order against the property(ies) you own?"
          required
        />
        <ConditionalField show={hasChargingOrder === true}>
          <FormField
            control={control}
            name="chargingOrderAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Property address line 1 <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="chargingOrderPostcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postcode</FormLabel>
                <FormControl>
                  <Input className="uppercase" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <CurrencyInput
            control={control}
            name="chargingOrderValue"
            label="Value of the charging order"
            required
          />
        </ConditionalField>

        {/* Council tax — always required */}
        <SingleDocUpload
          field="councilTaxDocumentId"
          slot="COUNCIL_TAX"
          label="Council Tax letter 2025/26 (required)"
          hint="Upload your most recent council tax letter showing the property address."
          applicationId={applicationId}
          documentMap={documentMap}
        />
      </fieldset>

      <hr className="border-slate-200" />

      {/* ── 2. Car & home contents ───────────────────────────────────────── */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Car &amp; home contents
        </legend>

        <FormField
          control={control}
          name="carOwnership"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>
                Do you own or lease a car? <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="space-y-2"
                >
                  {CAR_OWNERSHIP_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`car-${opt.value}`} />
                      <Label htmlFor={`car-${opt.value}`} className="font-normal">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <ConditionalField show={carOwnership === "OWN"}>
          <CurrencyInput
            control={control}
            name="carValue"
            label="Approximate market value of your car(s)"
          />
        </ConditionalField>

        <ConditionalField show={carOwnership === "LEASE"}>
          <CurrencyInput
            control={control}
            name="carMonthlyLease"
            label="Monthly lease charge"
            required
          />
          <SingleDocUpload
            field="carLeaseAgreementDocumentId"
            slot="CAR_LEASE_AGREEMENT"
            label="Car lease agreement (optional)"
            hint="Optionally upload your car lease agreement."
            applicationId={applicationId}
            documentMap={documentMap}
          />
        </ConditionalField>

        <YesNoToggle
          control={control}
          name="usesPublicTransport"
          label="Do you use public transport regularly?"
          required
        />
        <ConditionalField show={usesPublicTransport === true}>
          <CurrencyInput
            control={control}
            name="publicTransportMonthly"
            label="Household monthly public transport cost"
            required
          />
        </ConditionalField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CurrencyInput
            control={control}
            name="otherPossessionsValue"
            label="Value of other possessions including home contents"
            required
          />
          <CurrencyInput
            control={control}
            name="otherNonFinancialAssetsValue"
            label="Approximate value of any other non-financial assets"
            required
          />
        </div>
      </fieldset>

      <hr className="border-slate-200" />

      {/* ── 3. Financial assets & debt ───────────────────────────────────── */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Financial assets &amp; debt
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CurrencyInput
            control={control}
            name="totalCashBalance"
            label="Total cash balance held at all banks or elsewhere"
            required
          />
          <CurrencyInput
            control={control}
            name="investmentsValue"
            label="Approximate value of investments (Shares, PEPs, ISAs, etc.)"
            required
          />
        </div>

        {/* Parent / Guardian 1 */}
        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-primary-800">
            Parent / Guardian 1
          </h3>
          <MultiDocUpload
            field="parent1CurrentAccountDocumentIds"
            slot="BANK_STATEMENT_CURRENT_PARENT_1"
            label="Current account — last 3 months' statements (required)"
            hint="Upload your three most recent current-account statements."
            applicationId={applicationId}
            documentMap={documentMap}
          />
          <MultiDocUpload
            field="parent1SavingsAccountDocumentIds"
            slot="BANK_STATEMENT_SAVINGS_PARENT_1"
            label="Savings account — last 3 months' statements"
            hint="If you hold a savings account, upload your three most recent statements."
            applicationId={applicationId}
            documentMap={documentMap}
          />
          <YesNoToggle
            control={control}
            name="parent1OwnsInvestments"
            label="Do you own any stocks or bonds?"
          />
          <ConditionalField show={parent1OwnsInvestments === true}>
            <MultiDocUpload
              field="parent1InvestmentDocumentIds"
              slot="INVESTMENT_PARENT_1"
              label="Latest investment / portfolio documents"
              hint="Upload your most recent investment or portfolio statements."
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>
        </div>

        {/* Parent / Guardian 2 — only for dual-parent households */}
        {!isSoleParent && (
          <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-primary-800">
              Parent / Guardian 2
            </h3>
            <MultiDocUpload
              field="parent2CurrentAccountDocumentIds"
              slot="BANK_STATEMENT_CURRENT_PARENT_2"
              label="Current account — last 3 months' statements (required)"
              hint="Upload your three most recent current-account statements."
              applicationId={applicationId}
              documentMap={documentMap}
            />
            <MultiDocUpload
              field="parent2SavingsAccountDocumentIds"
              slot="BANK_STATEMENT_SAVINGS_PARENT_2"
              label="Savings account — last 3 months' statements"
              hint="If you hold a savings account, upload your three most recent statements."
              applicationId={applicationId}
              documentMap={documentMap}
            />
            <YesNoToggle
              control={control}
              name="parent2OwnsInvestments"
              label="Do you own any stocks or bonds?"
            />
            <ConditionalField show={parent2OwnsInvestments === true}>
              <MultiDocUpload
                field="parent2InvestmentDocumentIds"
                slot="INVESTMENT_PARENT_2"
                label="Latest investment / portfolio documents"
                hint="Upload your most recent investment or portfolio statements."
                applicationId={applicationId}
                documentMap={documentMap}
              />
            </ConditionalField>
          </div>
        )}

        {/* Personal debt */}
        <YesNoToggle
          control={control}
          name="hasPersonalDebt"
          label="Do you have any personal debt (excluding mortgages)?"
          required
        />
        <ConditionalField show={hasPersonalDebt === true}>
          <CurrencyInput
            control={control}
            name="creditCardBalance"
            label="Total credit card balance owed"
          />
          <MultiDocUpload
            field="creditCardStatementDocumentIds"
            slot="CREDIT_CARD_STATEMENT"
            label="Latest credit card statement(s)"
            hint="Upload your most recent credit card statement(s)."
            applicationId={applicationId}
            documentMap={documentMap}
          />
          <CurrencyInput
            control={control}
            name="bankOverdraft"
            label="Total bank overdraft(s)"
          />
          <CurrencyInput
            control={control}
            name="loansToAgencies"
            label="Total loan balance(s) owed to credit agencies"
          />
          <MultiDocUpload
            field="loanStatementDocumentIds"
            slot="LOAN_STATEMENT"
            label="Latest loan statement(s) (optional)"
            hint="Optionally upload your most recent loan statement(s)."
            applicationId={applicationId}
            documentMap={documentMap}
          />
          <CurrencyInput
            control={control}
            name="loansToFriendsFamily"
            label="Total loan balance(s) owed to friends and/or family"
          />
          <CurrencyInput
            control={control}
            name="schoolFeesOwed"
            label="Total school-fees balance(s) owed to your children's schools"
          />
          <MultiDocUpload
            field="otherDebtDocumentIds"
            slot="OTHER_DEBT_DOCUMENT"
            label="Any other debt-related document (optional)"
            hint="Optionally upload any other document relating to your debts."
            applicationId={applicationId}
            documentMap={documentMap}
          />
        </ConditionalField>
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

// ─── Per other-property card (workbook Q2) ───────────────────────────────────

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
