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
import { AlertTriangle } from "lucide-react";

// ─── status → sub-table mapping ──────────────────────────────────────────────

type Prefix = "parent1Income" | "parent2Income";
type SlotSuffix = "_PARENT_1" | "_PARENT_2";

// EVERY income sub-table (Employed, Self-employed, On benefits, Unemployed,
// Retired, Divorced/separated, Third-party) is ALWAYS displayed — regardless of
// the employment / relationship status the applicant picked in Parent Details.
// Circumstances change across the 12-month window (e.g. employed → unemployed →
// self-employed), so the applicant enters the relevant total in each relevant
// section and 0 where it doesn't apply. Matches the "(all sections are displayed,
// regardless of status picked on previous tab)" rule in the application-form
// workbook (PARENTS' INCOME tab, R5). Per-section uploads stay value-gated: a
// figure > £0 makes that section's document mandatory (except Child Benefit).

function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

/**
 * Resolve a document by SLOT (newest DocumentMeta whose `.slot === slot`).
 *
 * Used for the P45/REDUNDANCY uploads, which share their slots
 * (`P45_PARENT_*` / `REDUNDANCY_PARENT_*`) with the Parent/Guardian Details
 * page. Resolving by slot (rather than by this section's stored blob field id)
 * means a single upload made in either section shows in both.
 */
function resolveDocBySlot(
  slot: string,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!documentMap) return undefined;
  let newest: DocumentMeta | undefined;
  for (const doc of Object.values(documentMap)) {
    if (doc.slot !== slot) continue;
    if (!newest || doc.uploadedAt > newest.uploadedAt) newest = doc;
  }
  if (!newest) return undefined;
  return {
    id: newest.id,
    filename: newest.filename,
    fileSize: newest.fileSize,
    uploadedAt: newest.uploadedAt,
  };
}

// ─── reusable bits ───────────────────────────────────────────────────────────

/**
 * Density wrapper (PR-10): lays related currency fields two-up. Single column on
 * mobile, two columns from `sm:` upward, so the combined-income view stays short
 * without sub-stepping (Decision 8). RHF field `name`s are unchanged — this only
 * changes how the existing MoneyRow cells are arranged.
 */
function MoneyGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
      {children}
    </div>
  );
}

/**
 * A single currency cell inside a {@link MoneyGrid}. The label now renders above
 * the input (CurrencyInput's own label), which is what lets two fields sit
 * side-by-side. The RHF path (`${prefix}.${path}`) is identical to before.
 */
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
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    <CurrencyInput control={control as any} name={`${prefix}.${path}` as any} label={label} />
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
  resolveBySlot,
}: {
  prefix: Prefix;
  docIdPath: string;
  slot: string;
  label: string;
  hint?: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  show: boolean;
  /**
   * When true, resolve `existingDocument` by SLOT (newest doc with this slot)
   * rather than by the stored blob field id. Used for the P45/REDUNDANCY
   * uploads, whose slots are shared with the Parent/Guardian Details page so a
   * single upload appears in both sections.
   */
  resolveBySlot?: boolean;
}) {
  const { control, setValue, getValues } = useFormContext<ParentsIncomeFormValues>();
  const initial = React.useRef(
    getValues(`${prefix}.${docIdPath}` as never) as unknown as string | undefined
  );
  const existing = React.useMemo(
    () =>
      resolveBySlot
        ? resolveDocBySlot(slot, documentMap)
        : resolveDoc(initial.current, documentMap),
    [documentMap, resolveBySlot, slot]
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

/**
 * A collapsible sub-card (PR-10). Keeps the bordered fieldset shape the section
 * already used; the win is progressive disclosure: a sub-table with no declared
 * figures renders COLLAPSED (saves vertical space), while one that already holds
 * a value renders OPEN so existing data stays visible.
 *
 * Deep-link safety: this is a native `<details>` and `defaultOpen` only seeds the
 * initial `open` state. A field inside a closed disclosure is still in the DOM,
 * so the Review "Go fix this" focus effect (section-page-client.tsx) can — and
 * does — force every ancestor `<details>` open before scrolling/focusing.
 */
function SubTable({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-md border border-slate-200 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-slate-100">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-slate-500">
          <span className="group-open:hidden">Add details</span>
          <svg
            className="h-4 w-4 transition-transform group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </summary>
      <div className="divide-y divide-slate-100 border-t border-slate-200">
        {children}
      </div>
    </details>
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
}

function ParentIncomeColumn({
  prefix,
  parentLabel,
  slotSuffix,
  applicationId,
  documentMap,
  academicYear,
}: ParentIncomeColumnProps) {
  const { control, setValue, getValues } = useFormContext<ParentsIncomeFormValues>();
  const taxYear = getTaxYearLabels(academicYear);

  // Seed EVERY sub-block (all sections are always shown), so (a) the
  // CurrencyInput fields bind to a real path and (b) the saved blob carries the
  // sub-block keys the rule engine gates on (`onlyIfExistsPath`). Runs once per
  // mount; never overwrites a sub-block that already has data.
  React.useEffect(() => {
    const cur = (getValues(prefix) ?? {}) as Record<string, unknown>;
    const ensure = (key: string, seed: Record<string, unknown>) => {
      if (cur[key] === undefined || cur[key] === null) {
        setValue(`${prefix}.${key}` as never, seed as never, { shouldDirty: false });
      }
    };
    ensure("employed", { annualSalaryPaye: 0 });
    ensure("selfEmployed", {
      grossSalaried: 0, propertyIncome: 0, dividends: 0, otherInvestmentIncome: 0,
    });
    ensure("benefits", {
      universalCredit: 0, housingBenefit: 0, childBenefit: 0,
      childWorkingTaxCredit: 0, esa: 0, pipOrDla: 0, carersAllowance: 0,
      childcareSupport: 0, other: 0,
    });
    ensure("unemployed", {
      finalGrossPay: 0, redundancy: 0, jsa: 0, grantSupport: 0, leavePay: 0,
    });
    ensure("retired", { statePension: 0, privatePension: 0 });
    ensure("divorcedSeparated", { maintenanceReceived: 0, sharedCustodyNote: "" });
    ensure("thirdParty", { incomeSupportReceived: 0, supportNote: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

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

  // Progressive disclosure (PR-10): a sub-table renders OPEN when it ALREADY
  // held a declared figure on load (so saved data stays visible) and COLLAPSED
  // when every numeric cell was 0/empty. This is a one-time, mount-time snapshot
  // so the <details> stays uncontrolled after mount — the user can toggle it
  // freely, and typing into / zeroing a cell never yanks it open or shut. Doc-id
  // paths are ignored here — a value > 0 is what surfaces the upload, and the
  // deep-link focus effect re-opens a closed disclosure if Review links to a doc
  // field inside it.
  const initialRecord = React.useRef(
    (getValues(prefix) ?? {}) as Record<string, Record<string, unknown> | undefined>
  );
  const blockHadValue = (block: string, fields: readonly string[]) =>
    fields.some((f) => Number(initialRecord.current[block]?.[f] ?? 0) > 0);
  const blockHadText = (block: string, field: string) =>
    Boolean(initialRecord.current[block]?.[field]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-primary-900">{parentLabel} — Income</h3>
        <p className="mt-1 text-xs text-slate-500">
          GROSS income (before tax) from all sources for the{" "}
          {taxYear.financialYearEndedLabel}. Enter 0 where not applicable.
        </p>
      </div>

        <SubTable
          title="Employed (PAYE)"
          defaultOpen={blockHadValue("employed", ["annualSalaryPaye"])}
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="employed.annualSalaryPaye" label="Gross earned income / annual salary (PAYE, as on P60)" />
          </MoneyGrid>
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

        <SubTable
          title="Self-employed (SA302)"
          defaultOpen={blockHadValue("selfEmployed", [
            "grossSalaried",
            "propertyIncome",
            "dividends",
            "otherInvestmentIncome",
          ])}
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="selfEmployed.grossSalaried" label="Gross salaried income" />
            <MoneyRow prefix={prefix} path="selfEmployed.propertyIncome" label="Property income" />
            <MoneyRow prefix={prefix} path="selfEmployed.dividends" label="Dividends" />
            <MoneyRow prefix={prefix} path="selfEmployed.otherInvestmentIncome" label="Additional other interest / investment income" />
          </MoneyGrid>
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

        <SubTable
          title="On benefits (totals April–March)"
          defaultOpen={blockHadValue("benefits", [
            "universalCredit",
            "housingBenefit",
            "childBenefit",
            "childWorkingTaxCredit",
            "esa",
            "pipOrDla",
            "carersAllowance",
            "childcareSupport",
            "other",
          ])}
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="benefits.universalCredit" label="Universal Credit (excl. childcare)" />
          </MoneyGrid>
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
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="benefits.housingBenefit" label="Housing Benefit (if not in Universal Credit)" />
          </MoneyGrid>
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
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="benefits.childBenefit" label="Child Benefit (number only — upload not required)" />
            <MoneyRow prefix={prefix} path="benefits.childWorkingTaxCredit" label="Child / Working Tax Credit" />
            <MoneyRow prefix={prefix} path="benefits.esa" label="Employment & Support Allowance (ESA)" />
            <MoneyRow prefix={prefix} path="benefits.pipOrDla" label="Disability Allowance or PIP" />
            <MoneyRow prefix={prefix} path="benefits.carersAllowance" label="Carer's Allowance" />
            <MoneyRow prefix={prefix} path="benefits.childcareSupport" label="Childcare Support" />
            <MoneyRow prefix={prefix} path="benefits.other" label="Other benefits" />
          </MoneyGrid>
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

        <SubTable
          title="Unemployed / in between roles (last 12 months)"
          defaultOpen={blockHadValue("unemployed", [
            "finalGrossPay",
            "redundancy",
            "jsa",
            "grantSupport",
            "leavePay",
          ])}
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="unemployed.finalGrossPay" label="Final gross pay" />
          </MoneyGrid>
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.p45DocumentId" slot={`P45${slotSuffix}`} label="P45" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "finalGrossPay")} resolveBySlot />
          </div>
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="unemployed.redundancy" label="Redundancy / severance" />
          </MoneyGrid>
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.redundancyDocumentId" slot={`REDUNDANCY${slotSuffix}`} label="Redundancy / severance letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "redundancy")} resolveBySlot />
          </div>
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="unemployed.jsa" label="Job Seeker's Allowance (JSA)" />
          </MoneyGrid>
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.jsaDocumentId" slot={`JSA${slotSuffix}`} label="JSA award letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "jsa")} />
          </div>
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="unemployed.grantSupport" label="Student grant / support" />
          </MoneyGrid>
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.grantSupportDocumentId" slot={`GRANT_SUPPORT${slotSuffix}`} label="Grant / support letter" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "grantSupport")} />
          </div>
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="unemployed.leavePay" label="Parental / adoption / sickness leave pay" />
          </MoneyGrid>
          <div className="px-4 py-3">
            <DocUpload prefix={prefix} docIdPath="unemployed.leavePayDocumentId" slot={`LEAVE_PAY${slotSuffix}`} label="Status-change document" applicationId={applicationId} documentMap={documentMap} show={subGt0("unemployed", "leavePay")} />
          </div>
        </SubTable>

        <SubTable
          title="Retired"
          defaultOpen={blockHadValue("retired", ["statePension", "privatePension"])}
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="retired.statePension" label="State Pension" />
            <MoneyRow prefix={prefix} path="retired.privatePension" label="Private Pension & other plan" />
          </MoneyGrid>
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

        <SubTable
          title="Divorced or separated"
          defaultOpen={
            blockHadValue("divorcedSeparated", ["maintenanceReceived"]) ||
            blockHadText("divorcedSeparated", "sharedCustodyNote")
          }
        >
          <MoneyGrid>
            <MoneyRow prefix={prefix} path="divorcedSeparated.maintenanceReceived" label="Child Maintenance Allowance received" />
          </MoneyGrid>
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

      {/* Third-party support — always offered. */}
      <SubTable
        title="Third-party support (friends / family / other)"
        defaultOpen={
          blockHadValue("thirdParty", ["incomeSupportReceived"]) ||
          blockHadText("thirdParty", "supportNote")
        }
      >
        <MoneyGrid>
          <MoneyRow prefix={prefix} path="thirdParty.incomeSupportReceived" label="Additional Income Support received" />
        </MoneyGrid>
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

      {/* £0 prompter — when the parent's total income is £0, force an explicit
          acknowledgment that they genuinely had no income / benefit support. */}
      {total === 0 && (
        <FormField
          control={control}
          name={`${prefix}.noIncomeConfirmed` as never}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 p-4">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning-600"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-warning-600">
                    You have entered £0 total income for {parentLabel}.
                  </p>
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal text-slate-700">
                      I confirm that {parentLabel} received no income or benefit
                      support of any kind during the{" "}
                      {taxYear.financialYearEndedLabel}.{" "}
                      <span className="text-error-600" aria-hidden="true">*</span>
                    </FormLabel>
                  </div>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

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
  /**
   * @deprecated No longer used — every income sub-table is now displayed for
   * every applicant regardless of employment / relationship status. These props
   * remain on the interface only so existing call sites keep type-checking; the
   * upstream plumbing (section-page / contribute / page.tsx) can be removed in a
   * dedicated cleanup.
   */
  parent1EmploymentStatus?: string;
  parent2EmploymentStatus?: string;
  relationshipStatus?: string;
}

export function ParentsIncomeForm({
  isSoleParent,
  applicationId,
  documentMap,
  academicYear,
}: ParentsIncomeFormProps) {
  return (
    // The grid-heavy Income section runs at max-w-4xl. That width now lives on
    // the section CARD itself (section-page-client.tsx caps PARENTS_INCOME to
    // max-w-4xl while every other section stays max-w-3xl), so this form just
    // fills its card and lays its blocks out vertically. The previous fixed
    // `-mx-16 + w-[calc(100%+8rem)]` content breakout is gone: it pushed content
    // past the card border and overflowed the viewport at the lg breakpoint.
    <div className="space-y-10">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          All income sections are shown below — your circumstances may have
          changed over the year, so complete every section that applies to you
          and enter 0 in the sections that do not. Enter GROSS income (before
          tax). If a section has a value other than £0, its supporting document
          is required — except Child Benefit.
        </p>
      </div>

      <ParentIncomeColumn
        prefix="parent1Income"
        parentLabel="Parent / Guardian 1"
        slotSuffix="_PARENT_1"
        applicationId={applicationId}
        documentMap={documentMap}
        academicYear={academicYear}
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
          />
        </>
      )}
    </div>
  );
}
