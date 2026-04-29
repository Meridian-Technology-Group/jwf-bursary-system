"use client";

/**
 * ParentsIncomeForm — Section 7: Parents' Income
 *
 * 14 income line items per parent + supporting document uploads:
 *   - P60 (always required)
 *   - Self-assessment SA302 (when dividend / rent / bond income > 0)
 *   - Benefits evidence (when working tax credits or other benefits > 0)
 *   - Capital repayments evidence (when hasCapitalRepayments is true)
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
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { ParentsIncomeFormValues } from "@/lib/schemas/parents-income";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";

const INCOME_FIELDS: { key: keyof ParentsIncomeFormValues["parent1Income"]; label: string }[] = [
  { key: "salaryWagesPension", label: "Salary / wages, state or private pension(s)" },
  { key: "supplementsAndBonus", label: "Any supplement(s) and/or bonus" },
  { key: "otherBenefitsAndCommissions", label: "Any other benefits and commission(s)" },
  { key: "amountFromPartner", label: "Amount supplied by partner" },
  { key: "workingTaxCredits", label: "Working tax credits" },
  { key: "grossInterestReceived", label: "Gross interest received (on deposits)" },
  { key: "allDividendIncome", label: "All dividend income (UK or overseas)" },
  { key: "grossRentsReceived", label: "Gross rent(s) received" },
  { key: "allIncomeBonds", label: "All income (bonds)" },
  { key: "otherGrossIncomes", label: "Other gross income(s)" },
  { key: "maintenanceOrEquivalents", label: "Maintenance or equivalent(s)" },
  { key: "bursariesOrSponsorships", label: "Bursaries / sponsorships" },
  { key: "otherIncomeNotIncluded", label: "Other income not included above" },
  { key: "otherIncome", label: "Other income" },
];

interface ParentIncomeSectionProps {
  prefix: "parent1Income" | "parent2Income";
  parentLabel: string;
  /** Slot suffix: "_PARENT_1" or "_PARENT_2" */
  slotSuffix: "_PARENT_1" | "_PARENT_2";
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

function ParentIncomeSection({
  prefix,
  parentLabel,
  slotSuffix,
  applicationId,
  documentMap,
}: ParentIncomeSectionProps) {
  const { control, setValue, getValues } = useFormContext<ParentsIncomeFormValues>();

  // Capture initial doc IDs once (stable refs so the existing-document prop
  // doesn't change on every render and reset the FileUpload state).
  const initialP60DocId = React.useRef(getValues(`${prefix}.p60DocumentId`));
  const initialSaDocId = React.useRef(getValues(`${prefix}.selfAssessmentDocumentId`));
  const initialBenDocId = React.useRef(getValues(`${prefix}.benefitsEvidenceDocumentId`));
  const initialCapDocId = React.useRef(getValues(`${prefix}.capitalRepaymentsDocumentId`));

  const existingP60 = React.useMemo(
    () => resolveDoc(initialP60DocId.current, documentMap),
    [documentMap]
  );
  const existingSa = React.useMemo(
    () => resolveDoc(initialSaDocId.current, documentMap),
    [documentMap]
  );
  const existingBen = React.useMemo(
    () => resolveDoc(initialBenDocId.current, documentMap),
    [documentMap]
  );
  const existingCap = React.useMemo(
    () => resolveDoc(initialCapDocId.current, documentMap),
    [documentMap]
  );

  // Watch income fields that gate conditional uploads
  const allDividendIncome = useWatch({ control, name: `${prefix}.allDividendIncome` });
  const grossRentsReceived = useWatch({ control, name: `${prefix}.grossRentsReceived` });
  const allIncomeBonds = useWatch({ control, name: `${prefix}.allIncomeBonds` });
  const workingTaxCredits = useWatch({ control, name: `${prefix}.workingTaxCredits` });
  const otherBenefitsAndCommissions = useWatch({ control, name: `${prefix}.otherBenefitsAndCommissions` });
  const hasCapitalRepayments = useWatch({ control, name: `${prefix}.hasCapitalRepayments` });

  const needsSelfAssessment =
    (Number(allDividendIncome) ?? 0) > 0 ||
    (Number(grossRentsReceived) ?? 0) > 0 ||
    (Number(allIncomeBonds) ?? 0) > 0;

  const needsBenefitsEvidence =
    (Number(workingTaxCredits) ?? 0) > 0 ||
    (Number(otherBenefitsAndCommissions) ?? 0) > 0;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-primary-800">
        {parentLabel} — Income
      </h3>
      <p className="text-xs text-slate-500">
        Please enter GROSS income before tax deductions. Enter 0 where not
        applicable.
      </p>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className="bg-slate-50 px-4 py-2.5">
          <div className="grid grid-cols-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            <span className="col-span-2">Income source</span>
            <span className="text-right">To April (actual)</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {INCOME_FIELDS.map((f) => (
            <div
              key={f.key}
              className="grid grid-cols-3 items-center gap-4 px-4 py-3"
            >
              <span className="col-span-2 text-sm text-slate-700">
                {f.label}
              </span>
              <CurrencyInput
                control={control}
                name={`${prefix}.${f.key}` as `parent1Income.${typeof f.key}`}
                label=""
                className="col-span-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Supporting documents ─────────────────────────────────────────────── */}
      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-primary-800">
          Supporting documents — {parentLabel}
        </legend>

        {/* P60 — always required */}
        <FileUpload
          slot={`P60${slotSuffix}`}
          label="P60 (required)"
          hint="Most recent P60 form from your employer or pension provider."
          applicationId={applicationId}
          existingDocument={existingP60}
          onUploadComplete={(doc: UploadedDocument) => {
            setValue(`${prefix}.p60DocumentId`, doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onRemove={() => {
            setValue(`${prefix}.p60DocumentId`, undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
        {/* Hidden form field to track the document ID */}
        <FormField
          control={control}
          name={`${prefix}.p60DocumentId` as "parent1Income.p60DocumentId"}
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl><input type="hidden" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Self-assessment SA302 — conditional on dividend / rent / bond income */}
        <ConditionalField show={needsSelfAssessment}>
          <FileUpload
            slot={`SELF_ASSESSMENT${slotSuffix}`}
            label="Self-assessment tax return (SA302)"
            hint="Required because you have declared dividend, rental, or bond income. Upload your most recent SA302 or tax calculation."
            applicationId={applicationId}
            existingDocument={existingSa}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.selfAssessmentDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.selfAssessmentDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.selfAssessmentDocumentId` as "parent1Income.selfAssessmentDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>

        {/* Benefits evidence — conditional on tax credits / other benefits */}
        <ConditionalField show={needsBenefitsEvidence}>
          <FileUpload
            slot={`BENEFITS_EVIDENCE${slotSuffix}`}
            label="Benefits / tax credits evidence"
            hint="Required because you have declared working tax credits or benefits income. Upload your most recent award notice or benefits letter."
            applicationId={applicationId}
            existingDocument={existingBen}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.benefitsEvidenceDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.benefitsEvidenceDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.benefitsEvidenceDocumentId` as "parent1Income.benefitsEvidenceDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>

        {/* Capital repayments toggle + conditional upload */}
        <YesNoToggle
          control={control}
          name={`${prefix}.hasCapitalRepayments` as "parent1Income.hasCapitalRepayments"}
          label="Do you make regular capital repayments?"
          required
        />

        <ConditionalField show={hasCapitalRepayments === true}>
          <FileUpload
            slot={`CAPITAL_REPAYMENTS${slotSuffix}`}
            label="Capital repayments evidence"
            hint="Upload a letter or statement confirming the nature and amount of the regular capital repayments."
            applicationId={applicationId}
            existingDocument={existingCap}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.capitalRepaymentsDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.capitalRepaymentsDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.capitalRepaymentsDocumentId` as "parent1Income.capitalRepaymentsDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>
      </fieldset>

      {/* Documents confirmation */}
      <FormField
        control={control}
        name={`${prefix}.documentsConfirmed` as "parent1Income.documentsConfirmed"}
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

interface ParentsIncomeFormProps {
  /** From PARENT_DETAILS — when true, the P2 income block is hidden. */
  isSoleParent?: boolean;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

export function ParentsIncomeForm({
  isSoleParent,
  applicationId,
  documentMap,
}: ParentsIncomeFormProps) {
  return (
    <div className="space-y-10">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          Please complete the table below showing GROSS INCOME before deduction
          of tax from all sources of income. Where a source is not applicable to
          you, please enter 0.
        </p>
      </div>

      <ParentIncomeSection
        prefix="parent1Income"
        parentLabel="Parent / Guardian 1"
        slotSuffix="_PARENT_1"
        applicationId={applicationId}
        documentMap={documentMap}
      />

      {!isSoleParent && (
        <>
          <hr className="border-slate-200" />
          <ParentIncomeSection
            prefix="parent2Income"
            parentLabel="Parent / Guardian 2"
            slotSuffix="_PARENT_2"
            applicationId={applicationId}
            documentMap={documentMap}
          />
        </>
      )}
    </div>
  );
}
