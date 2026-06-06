"use client";

/**
 * ParentsIncomeForm — Section 6: Parents' Income (status-driven sub-tables).
 *
 * Epic 02 (D3): the flat 14-line model is replaced with sub-tables keyed by the
 * parent's declared employment status (from PARENT_DETAILS). Each sub-table has
 * its own numeric rows + the required upload(s), a live per-parent TOTAL footer,
 * and a compulsory legibility tick. The workbook's "value > £0 ⇒ upload, except
 * Child Benefit" rule is enforced by the rule engine (section-rules.ts); here we
 * surface the matching upload control when the value is non-zero.
 *
 * Tax-year wording derives from the round (D5) via getTaxYearLabels.
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
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import { Textarea } from "@/components/ui/textarea";
import type { ParentsIncomeFormValues } from "@/lib/schemas/parents-income";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import { getTaxYearLabels } from "@/lib/portal/tax-year";
import { newIncomeTotal } from "@/lib/portal/income-model";

// ─── status → sub-table mapping ──────────────────────────────────────────────

type Prefix = "parent1Income" | "parent2Income";
type SlotSuffix = "_PARENT_1" | "_PARENT_2";

/**
 * Which sub-tables to show for a declared portal EmploymentStatus. Divorced/
 * separated and third-party are not employment statuses — they are layered in by
 * the parent component based on relationship status (divorced/separated) and are
 * always offered (third-party).
 */
function subTablesForStatus(status: string | undefined): {
  employed: boolean;
  selfEmployed: boolean;
  benefits: boolean;
  unemployed: boolean;
  retired: boolean;
} {
  return {
    employed: status === "PAYE",
    selfEmployed:
      status === "SELF_EMPLOYED_DIRECTOR" || status === "SELF_EMPLOYED_SOLE",
    benefits: status === "BENEFITS",
    unemployed: status === "UNEMPLOYED",
    retired: status === "OLD_AGE_PENSION" || status === "PAST_PENSION",
  };
}

function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

// ─── reusable bits ───────────────────────────────────────────────────────────

function Row({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4 px-4 py-3">
      {children}
    </div>
  );
}

/** A single currency row inside a sub-table. */
function MoneyRow({
  prefix,
  path,
  label,
}: {
  prefix: Prefix;
  path: string;
  label: string;
}) {
  const { control } = useFormContext<ParentsIncomeFormValues>();
  return (
    <Row>
      <span className="col-span-2 text-sm text-slate-700">{label}</span>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CurrencyInput control={control as any} name={`${prefix}.${path}` as any} label="" className="col-span-1" />
    </Row>
  );
}

/** A conditional upload tied to a doc-id path; shown when `show` is true. */
function DocUpload({
  prefix,
  docIdPath,
  slot,
  label,
  hint,
  applicationId,
  documentMap,
  show,
}: {
  prefix: Prefix;
  docIdPath: string;
  slot: string;
  label: string;
  hint?: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  show: boolean;
}) {
  const { control, setValue, getValues } = useFormContext<ParentsIncomeFormValues>();
  const initial = React.useRef(
    getValues(`${prefix}.${docIdPath}` as never) as unknown as string | undefined
  );
  const existing = React.useMemo(
    () => resolveDoc(initial.current, documentMap),
    [documentMap]
  );
  return (
    <ConditionalField show={show}>
      <FileUpload
        slot={slot}
        label={label}
        hint={hint}
        applicationId={applicationId}
        existingDocument={existing}
        onUploadComplete={(doc: UploadedDocument) =>
          setValue(`${prefix}.${docIdPath}` as never, doc.id as never, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
        onRemove={() =>
          setValue(`${prefix}.${docIdPath}` as never, undefined as never, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FormField
        control={control as any}
        name={`${prefix}.${docIdPath}` as any}
        render={() => (
          <FormItem className="hidden" aria-hidden="true">
            <FormControl><input type="hidden" /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </ConditionalField>
  );
}

function SubTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-primary-700">{title}</h4>
      <div className="overflow-hidden rounded-md border border-slate-200 divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

// ─── per-parent column ───────────────────────────────────────────────────────

interface ParentIncomeColumnProps {
  prefix: Prefix;
  parentLabel: string;
  slotSuffix: SlotSuffix;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  academicYear?: string | null;
  employmentStatus?: string;
  showDivorcedSeparated: boolean;
}

function ParentIncomeColumn({
  prefix,
  parentLabel,
  slotSuffix,
  applicationId,
  documentMap,
  academicYear,
  employmentStatus,
  showDivorcedSeparated,
}: ParentIncomeColumnProps) {
  const { control, setValue, getValues } = useFormContext<ParentsIncomeFormValues>();
  const taxYear = getTaxYearLabels(academicYear);
  const show = subTablesForStatus(employmentStatus);

  // Seed the empty sub-blocks for the sub-tables we render, so (a) the
  // CurrencyInput fields bind to a real path and (b) the saved blob carries the
  // sub-block keys the rule engine gates on (`onlyIfExistsPath`). Runs once per
  // shown-set change; never overwrites a sub-block that already has data.
  React.useEffect(() => {
    const cur = (getValues(prefix) ?? {}) as Record<string, unknown>;
    const ensure = (key: string, seed: Record<string, unknown>) => {
      if (cur[key] === undefined || cur[key] === null) {
        setValue(`${prefix}.${key}` as never, seed as never, { shouldDirty: false });
      }
    };
    if (show.employed) ensure("employed", { annualSalaryPaye: 0 });
    if (show.selfEmployed)
      ensure("selfEmployed", {
        grossSalaried: 0, propertyIncome: 0, dividends: 0, otherInvestmentIncome: 0,
      });
    if (show.benefits)
      ensure("benefits", {
        universalCredit: 0, housingBenefit: 0, childBenefit: 0,
        childWorkingTaxCredit: 0, esa: 0, pipOrDla: 0, carersAllowance: 0,
        childcareSupport: 0, other: 0,
      });
    if (show.unemployed)
      ensure("unemployed", {
        finalGrossPay: 0, redundancy: 0, jsa: 0, grantSupport: 0, leavePay: 0,
      });
    if (show.retired) ensure("retired", { statePension: 0, privatePension: 0 });
    if (showDivorcedSeparated)
      ensure("divorcedSeparated", { maintenanceReceived: 0, sharedCustodyNote: "" });
    ensure("thirdParty", { incomeSupportReceived: 0, supportNote: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefix,
    show.employed,
    show.selfEmployed,
    show.benefits,
    show.unemployed,
    show.retired,
    showDivorcedSeparated,
  ]);

  // Live total — recomputed whenever any numeric cell in this column changes.
  const record = useWatch({ control, name: prefix });
  const total = React.useMemo(
    () => newIncomeTotal((record as never) ?? {}),
    [record]
  );
  React.useEffect(() => {
    setValue(`${prefix}.total` as never, total as never, { shouldDirty: false });
  }, [total, prefix, setValue]);

  const sub = (record ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const subGt0 = (block: string, field: string) =>
    Number(sub[block]?.[field] ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-primary-900">{parentLabel} — Income</h3>
        <p className="mt-1 text-xs text-slate-500">
          GROSS income (before tax) from all sources for the{" "}
          {taxYear.financialYearEndedLabel}. Enter 0 where not applicable.
        </p>
      </div>

      {show.employed && (
        <SubTable title="Employed (PAYE)">
          <MoneyRow prefix={prefix} path="employed.annualSalaryPaye" label="Gross earned income / annual salary (PAYE, as on P60)" />
          <div className="space-y-4 px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="employed.p60DocumentId"
              slot={`P60${slotSuffix}`}
              label={`P60 (dated ${taxYear.p60DateLabel})`}
              hint="Upload your P60, or the March payslip below — at least one is required."
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("employed", "annualSalaryPaye")}
            />
            <DocUpload
              prefix={prefix}
              docIdPath="employed.marchPayslipDocumentId"
              slot={`MARCH_PAYSLIP${slotSuffix}`}
              label={taxYear.marchPayslipLabel}
              hint="Upload your most recent March payslip, or the P60 above — at least one is required."
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("employed", "annualSalaryPaye")}
            />
          </div>
        </SubTable>
      )}

      {show.selfEmployed && (
        <SubTable title="Self-employed (SA302)">
          <MoneyRow prefix={prefix} path="selfEmployed.grossSalaried" label="Gross salaried income" />
          <MoneyRow prefix={prefix} path="selfEmployed.propertyIncome" label="Property income" />
          <MoneyRow prefix={prefix} path="selfEmployed.dividends" label="Dividends" />
          <MoneyRow prefix={prefix} path="selfEmployed.otherInvestmentIncome" label="Additional other interest / investment income" />
          <div className="px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="selfEmployed.sa302DocumentId"
              slot={`SA302${slotSuffix}`}
              label={`SA302 (tax year ${taxYear.sa302TaxYearLabel})`}
              hint="Required when self-employed income is declared."
              applicationId={applicationId}
              documentMap={documentMap}
              show={
                subGt0("selfEmployed", "grossSalaried") ||
                subGt0("selfEmployed", "propertyIncome") ||
                subGt0("selfEmployed", "dividends") ||
                subGt0("selfEmployed", "otherInvestmentIncome")
              }
            />
          </div>
        </SubTable>
      )}

      {show.benefits && (
        <SubTable title="On benefits (totals April–March)">
          <MoneyRow prefix={prefix} path="benefits.universalCredit" label="Universal Credit (excl. childcare)" />
          <div className="px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="benefits.ucStatementDocumentId"
              slot={`UC_STATEMENT${slotSuffix}`}
              label="Universal Credit 12-month statement"
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("benefits", "universalCredit")}
            />
            <DocUpload
              prefix={prefix}
              docIdPath="benefits.ucMonthlyDocumentIds.0"
              slot={`UC_MONTHLY${slotSuffix}`}
              label="3 monthly Universal Credit payment documents"
              hint="Upload your three most recent monthly UC payment statements."
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("benefits", "universalCredit")}
            />
          </div>
          <MoneyRow prefix={prefix} path="benefits.housingBenefit" label="Housing Benefit (if not in Universal Credit)" />
          <div className="px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="benefits.housingBenefitDocumentId"
              slot={`HOUSING_BENEFIT${slotSuffix}`}
              label="Housing Benefit award letter"
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("benefits", "housingBenefit")}
            />
          </div>
          <MoneyRow prefix={prefix} path="benefits.childBenefit" label="Child Benefit (number only — upload not required)" />
          <MoneyRow prefix={prefix} path="benefits.childWorkingTaxCredit" label="Child / Working Tax Credit" />
          <MoneyRow prefix={prefix} path="benefits.esa" label="Employment & Support Allowance (ESA)" />
          <MoneyRow prefix={prefix} path="benefits.pipOrDla" label="Disability Allowance or PIP" />
          <MoneyRow prefix={prefix} path="benefits.carersAllowance" label="Carer's Allowance" />
          <MoneyRow prefix={prefix} path="benefits.childcareSupport" label="Childcare Support" />
          <MoneyRow prefix={prefix} path="benefits.other" label="Other benefits" />
          <div className="px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="benefits.otherBenefitsDocumentId"
              slot={`OTHER_BENEFITS${slotSuffix}`}
              label="Evidence of declared benefits"
              hint="Required for declared tax credits / ESA / PIP / Carer's / childcare / other benefits (not Child Benefit)."
              applicationId={applicationId}
              documentMap={documentMap}
              show={
                subGt0("benefits", "childWorkingTaxCredit") ||
                subGt0("benefits", "esa") ||
                subGt0("benefits", "pipOrDla") ||
                subGt0("benefits", "carersAllowance") ||
                subGt0("benefits", "childcareSupport") ||
                subGt0("benefits", "other")
              }
            />
          </div>
        </SubTable>
      )}

      {show.unemployed && (
        <SubTable title="Unemployed / in between roles (last 12 months)">
          <MoneyRow prefix={prefix} path="unemployed.finalGrossPay" label="Final gross pay" />
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.p45DocumentId" slot={`P45${slotSuffix}`} label="P45" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "finalGrossPay")} />
          </div>
          <MoneyRow prefix={prefix} path="unemployed.redundancy" label="Redundancy / severance" />
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.redundancyDocumentId" slot={`REDUNDANCY${slotSuffix}`} label="Redundancy / severance letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "redundancy")} />
          </div>
          <MoneyRow prefix={prefix} path="unemployed.jsa" label="Job Seeker's Allowance (JSA)" />
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.jsaDocumentId" slot={`JSA${slotSuffix}`} label="JSA award letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "jsa")} />
          </div>
          <MoneyRow prefix={prefix} path="unemployed.grantSupport" label="Student grant / support" />
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.grantSupportDocumentId" slot={`GRANT_SUPPORT${slotSuffix}`} label="Grant / support letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "grantSupport")} />
          </div>
          <MoneyRow prefix={prefix} path="unemployed.leavePay" label="Parental / adoption / sickness leave pay" />
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.leavePayDocumentId" slot={`LEAVE_PAY${slotSuffix}`} label="Status-change document" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "leavePay")} />
          </div>
        </SubTable>
      )}

      {show.retired && (
        <SubTable title="Retired">
          <MoneyRow prefix={prefix} path="retired.statePension" label="State Pension" />
          <MoneyRow prefix={prefix} path="retired.privatePension" label="Private Pension & other plan" />
          <div className="px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="retired.pensionDocumentId"
              slot={`PENSION${slotSuffix}`}
              label="Pension documentation"
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("retired", "statePension") || subGt0("retired", "privatePension")}
            />
          </div>
        </SubTable>
      )}

      {showDivorcedSeparated && (
        <SubTable title="Divorced or separated">
          <MoneyRow prefix={prefix} path="divorcedSeparated.maintenanceReceived" label="Child Maintenance Allowance received" />
          <div className="space-y-4 px-4 py-3">
            <DocUpload
              prefix={prefix}
              docIdPath="divorcedSeparated.maintenanceDocumentId"
              slot={`MAINTENANCE${slotSuffix}`}
              label="Letter evidencing maintenance received"
              applicationId={applicationId}
              documentMap={documentMap}
              show={subGt0("divorcedSeparated", "maintenanceReceived")}
            />
            <FormField
              control={control}
              name={`${prefix}.divorcedSeparated.sharedCustodyNote` as never}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shared-custody arrangement (if any)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={(field.value as string) ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SubTable>
      )}

      {/* Third-party support — always offered. */}
      <SubTable title="Third-party support (friends / family / other)">
        <MoneyRow prefix={prefix} path="thirdParty.incomeSupportReceived" label="Additional Income Support received" />
        <div className="px-4 py-3">
          <FormField
            control={control}
            name={`${prefix}.thirdParty.supportNote` as never}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who provides it, how regularly, and for how long</FormLabel>
                <FormControl>
                  <Textarea {...field} value={(field.value as string) ?? ""} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </SubTable>

      {/* Per-parent TOTAL */}
      <div className="flex items-center justify-between rounded-md bg-primary-50 border border-primary-200 px-4 py-3">
        <span className="text-sm font-semibold text-primary-900">TOTAL (£)</span>
        <span className="text-lg font-semibold text-primary-900">
          £{total.toLocaleString("en-GB")}
        </span>
      </div>

      {/* Legibility tick */}
      <FormField
        control={control}
        name={`${prefix}.documentsConfirmed` as never}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-4">
              <FormControl>
                <Checkbox
                  checked={field.value as boolean}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <FormLabel className="cursor-pointer font-normal text-slate-700">
                I confirm all documents on this page are correct and legible.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ─── form ────────────────────────────────────────────────────────────────────

interface ParentsIncomeFormProps {
  isSoleParent?: boolean;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  academicYear?: string | null;
  parent1EmploymentStatus?: string;
  parent2EmploymentStatus?: string;
  relationshipStatus?: string;
}

function isDivorcedSeparated(relationshipStatus?: string): boolean {
  return relationshipStatus === "DIVORCED" || relationshipStatus === "SEPARATED";
}

export function ParentsIncomeForm({
  isSoleParent,
  applicationId,
  documentMap,
  academicYear,
  parent1EmploymentStatus,
  parent2EmploymentStatus,
  relationshipStatus,
}: ParentsIncomeFormProps) {
  const showDivSep = isDivorcedSeparated(relationshipStatus);
  return (
    <div className="space-y-10">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          The sections shown below match the employment status you entered for
          each parent/guardian. Enter GROSS income (before tax). Where a value is
          required but not relevant, enter 0. If a row has a value other than £0,
          its supporting document is required — except Child Benefit.
        </p>
      </div>

      <ParentIncomeColumn
        prefix="parent1Income"
        parentLabel="Parent / Guardian 1"
        slotSuffix="_PARENT_1"
        applicationId={applicationId}
        documentMap={documentMap}
        academicYear={academicYear}
        employmentStatus={parent1EmploymentStatus}
        showDivorcedSeparated={showDivSep}
      />

      {!isSoleParent && (
        <>
          <hr className="border-slate-200" />
          <ParentIncomeColumn
            prefix="parent2Income"
            parentLabel="Parent / Guardian 2"
            slotSuffix="_PARENT_2"
            applicationId={applicationId}
            documentMap={documentMap}
            academicYear={academicYear}
            employmentStatus={parent2EmploymentStatus}
            showDivorcedSeparated={showDivSep}
          />
        </>
      )}
    </div>
  );
}
