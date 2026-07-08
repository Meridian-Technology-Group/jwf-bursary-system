"use client";

/**
 * ParentsIncomeForm — Section 6: Parents' Income (spreadsheet layout).
 *
 * Epic 02 (D3): the flat 14-line model is replaced with sub-tables keyed by the
 * parent's declared employment status (from PARENT_DETAILS). Each sub-table has
 * its own numeric rows + the required upload(s), a live per-parent TOTAL footer,
 * and a compulsory legibility tick. The workbook's "value > £0 ⇒ upload, except
 * Child Benefit" rule is enforced by the rule engine (section-rules.ts); here we
 * surface the matching upload control when the value is non-zero.
 *
 * Layout (income redesign): every group is ALWAYS open — there are no
 * collapsible disclosures. Each group renders as a dense `Source | Amount (£) |
 * Evidence` grid (one line per income source). Required uploads render inline in
 * the Evidence column as a one-line "⬆ Upload …" button that becomes a
 * "✓ file [view][x]" chip once uploaded, so evidence consumes no extra vertical
 * space. On mobile each row reflows to a stacked card (label, then £ input, then
 * the evidence chip) — no horizontal scroll.
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

// ─── spreadsheet grid primitives ─────────────────────────────────────────────

// Shared 3-column template: Source | Amount (£) | Evidence. Single column on
// mobile (each row reflows to a stacked card); three columns from `sm:` upward.
const GRID_COLS =
  "grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_180px_minmax(200px,1.1fr)] sm:items-start";

/**
 * A static, always-open income group. Replaces the previous collapsible
 * `<details>` sub-table: nothing here toggles, everything is visible at once.
 * Renders a header bar, a (desktop-only) column-header row, then its rows.
 */
function IncomeGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-primary-700">
        {title}
      </div>
      <div
        className={`${GRID_COLS} hidden border-b border-slate-200 bg-slate-50/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 sm:grid`}
        aria-hidden="true"
      >
        <span>Income source</span>
        <span>Amount</span>
        <span>Evidence</span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

/**
 * One income line: a visible label cell, the £ input, and the evidence cell.
 * `evidence` is the inline upload control when the figure requires a document;
 * pass `undefined` for "no value yet" (renders a muted dash) or an explicit node
 * (e.g. "not required") to override.
 */
function IncomeRow({
  prefix,
  path,
  label,
  evidence,
}: {
  prefix: Prefix;
  path: string;
  label: string;
  evidence?: React.ReactNode;
}) {
  const { control } = useFormContext<ParentsIncomeFormValues>();
  return (
    <div className={`${GRID_COLS} px-4 py-2.5`}>
      <div className="min-w-0 text-sm text-slate-700 sm:pt-2">{label}</div>
      <div className="min-w-0">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CurrencyInput control={control as any} name={`${prefix}.${path}` as any} label={label} hideLabel />
      </div>
      <div className="min-w-0 sm:pt-1">
        {evidence ?? <span className="block text-xs text-slate-400 sm:pt-1.5">—</span>}
      </div>
    </div>
  );
}

/**
 * A group-level evidence row (e.g. one SA302 covering all self-employed lines).
 * Spans the same grid but leaves the Amount cell empty; the caller renders it
 * only when the group's gating condition is met.
 */
function GroupEvidenceRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${GRID_COLS} bg-slate-50/40 px-4 py-2.5`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="hidden sm:block" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A full-width row for free-text notes that don't fit the money grid. */
function NoteRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

/**
 * An inline (one-line) document upload bound to a doc-id path. Renders the
 * compact FileUpload chip plus a hidden FormField mirror so the doc-id
 * participates in validation. Visibility is decided by the caller (it is only
 * mounted when the matching figure is > £0), so when not mounted the row's
 * evidence cell falls back to a muted dash.
 */
function DocUpload({
  prefix,
  docIdPath,
  slot,
  label,
  hint,
  applicationId,
  documentMap,
}: {
  prefix: Prefix;
  docIdPath: string;
  slot: string;
  label: string;
  hint?: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
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
    <>
      <FileUpload
        variant="inline"
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
    </>
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

  // Convenience: build an inline upload node for a given doc-id path.
  const doc = (docIdPath: string, slot: string, label: string, hint?: string) => (
    <DocUpload
      prefix={prefix}
      docIdPath={docIdPath}
      slot={`${slot}${slotSuffix}`}
      label={label}
      hint={hint}
      applicationId={applicationId}
      documentMap={documentMap}
    />
  );

  // Shown beside any benefit row with a value > 0, pointing the applicant to
  // the free-upload box at the bottom of the benefits group.
  const uploadHint = (
    <span className="block text-xs text-slate-500 sm:pt-1.5">
      Please upload your supporting document below.
    </span>
  );

  const employedHasValue = subGt0("employed", "annualSalaryPaye");
  const selfEmployedHasValue =
    subGt0("selfEmployed", "grossSalaried") ||
    subGt0("selfEmployed", "propertyIncome") ||
    subGt0("selfEmployed", "dividends") ||
    subGt0("selfEmployed", "otherInvestmentIncome");
  const otherBenefitsHasValue =
    subGt0("benefits", "childBenefit") ||
    subGt0("benefits", "childWorkingTaxCredit") ||
    subGt0("benefits", "esa") ||
    subGt0("benefits", "pipOrDla") ||
    subGt0("benefits", "carersAllowance") ||
    subGt0("benefits", "childcareSupport") ||
    subGt0("benefits", "other");
  const retiredHasValue =
    subGt0("retired", "statePension") || subGt0("retired", "privatePension");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-primary-900">{parentLabel} — Income</h3>
        <p className="mt-1 text-xs text-slate-500">
          GROSS income (before tax) from all sources for the{" "}
          {taxYear.financialYearEndedLabel}. Enter 0 where not applicable.
        </p>
      </div>

      <IncomeGroup title="Employed (PAYE)">
        <IncomeRow
          prefix={prefix}
          path="employed.annualSalaryPaye"
          label="Annual salary (PAYE, as on P60)"
          evidence={
            employedHasValue ? (
              <div className="space-y-1.5">
                {doc(
                  "employed.p60DocumentId",
                  "P60",
                  `P60 (dated ${taxYear.p60DateLabel})`,
                  "Upload your P60 for the period above."
                )}
                {doc(
                  "employed.marchPayslipDocumentId",
                  "MARCH_PAYSLIP",
                  taxYear.marchPayslipLabel,
                  "Upload your payslip for the month above."
                )}
              </div>
            ) : undefined
          }
        />
      </IncomeGroup>

      <IncomeGroup title="Self-employed (SA302)">
        <IncomeRow prefix={prefix} path="selfEmployed.grossSalaried" label="Gross earned income" />
        <IncomeRow prefix={prefix} path="selfEmployed.propertyIncome" label="Property income" />
        <IncomeRow prefix={prefix} path="selfEmployed.dividends" label="Dividends" />
        <IncomeRow prefix={prefix} path="selfEmployed.otherInvestmentIncome" label="Additional other interest / investment income" />
        {selfEmployedHasValue && (
          <GroupEvidenceRow label="Supporting document — covers all self-employed income above">
            {doc(
              "selfEmployed.sa302DocumentId",
              "SA302",
              `SA302 (tax year ${taxYear.sa302TaxYearLabel})`,
              `SA302 for the tax year ${taxYear.sa302TaxYearLabel}* (* if your financial year is between April and October, please report your self-employed income one year in arrears, so upload your SA302 for the previous tax year)`
            )}
          </GroupEvidenceRow>
        )}
      </IncomeGroup>

      <IncomeGroup title="On benefits (totals April–March)">
        <IncomeRow
          prefix={prefix}
          path="benefits.universalCredit"
          label="Universal Credit (excl. childcare)"
          evidence={
            subGt0("benefits", "universalCredit") ? (
              <div className="space-y-1.5">
                {doc("benefits.ucStatementDocumentId", "UC_STATEMENT", "Universal Credit 12-month statement")}
                {doc(
                  "benefits.ucMonthlyDocumentIds.0",
                  "UC_MONTHLY",
                  "3 monthly UC detailed payment calculations (not just the front page)"
                )}
              </div>
            ) : undefined
          }
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.housingBenefit"
          label="Housing Benefit (if not in Universal Credit)"
          evidence={
            subGt0("benefits", "housingBenefit")
              ? doc("benefits.housingBenefitDocumentId", "HOUSING_BENEFIT", "Housing Benefit award letter")
              : undefined
          }
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.childBenefit"
          label="Child Benefit (number only)"
          evidence={subGt0("benefits", "childBenefit") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.childWorkingTaxCredit"
          label="Child / Working Tax Credit"
          evidence={subGt0("benefits", "childWorkingTaxCredit") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.esa"
          label="Employment & Support Allowance (ESA)"
          evidence={subGt0("benefits", "esa") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.pipOrDla"
          label="Disability Allowance or PIP"
          evidence={subGt0("benefits", "pipOrDla") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.carersAllowance"
          label="Carer's Allowance"
          evidence={subGt0("benefits", "carersAllowance") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.childcareSupport"
          label="Childcare Support"
          evidence={subGt0("benefits", "childcareSupport") ? uploadHint : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="benefits.other"
          label="Other benefits"
          evidence={subGt0("benefits", "other") ? uploadHint : undefined}
        />
        {otherBenefitsHasValue && (
          <GroupEvidenceRow label="Evidence of declared benefits — upload your supporting documents here">
            {doc("benefits.otherBenefitsDocumentId", "OTHER_BENEFITS", "Evidence of declared benefits")}
          </GroupEvidenceRow>
        )}
      </IncomeGroup>

      <IncomeGroup title="Unemployed / in between roles (last 12 months)">
        <IncomeRow
          prefix={prefix}
          path="unemployed.finalGrossPay"
          label="Final gross pay"
          evidence={subGt0("unemployed", "finalGrossPay") ? doc("unemployed.p45DocumentId", "P45", "P45") : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="unemployed.redundancy"
          label="Redundancy / severance"
          evidence={subGt0("unemployed", "redundancy") ? doc("unemployed.redundancyDocumentId", "REDUNDANCY", "Redundancy / severance letter") : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="unemployed.jsa"
          label="Job Seeker's Allowance (JSA)"
          evidence={subGt0("unemployed", "jsa") ? doc("unemployed.jsaDocumentId", "JSA", "JSA award letter") : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="unemployed.grantSupport"
          label="Student grant / support"
          evidence={subGt0("unemployed", "grantSupport") ? doc("unemployed.grantSupportDocumentId", "GRANT_SUPPORT", "Grant / support letter") : undefined}
        />
        <IncomeRow
          prefix={prefix}
          path="unemployed.leavePay"
          label="Parental / adoption / sickness leave pay"
          evidence={subGt0("unemployed", "leavePay") ? doc("unemployed.leavePayDocumentId", "LEAVE_PAY", "Status-change document") : undefined}
        />
      </IncomeGroup>

      <IncomeGroup title="Retired">
        <IncomeRow prefix={prefix} path="retired.statePension" label="State Pension" />
        <IncomeRow prefix={prefix} path="retired.privatePension" label="Private Pension & other plan" />
        {retiredHasValue && (
          <GroupEvidenceRow label="Supporting document — covers pension income above">
            {doc("retired.pensionDocumentId", "PENSION", "Pension documentation")}
          </GroupEvidenceRow>
        )}
      </IncomeGroup>

      <IncomeGroup title="Divorced or separated">
        <IncomeRow
          prefix={prefix}
          path="divorcedSeparated.maintenanceReceived"
          label="Child Maintenance Allowance received"
          evidence={
            subGt0("divorcedSeparated", "maintenanceReceived")
              ? doc("divorcedSeparated.maintenanceDocumentId", "MAINTENANCE", "Letter evidencing maintenance received")
              : undefined
          }
        />
        <NoteRow>
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
        </NoteRow>
      </IncomeGroup>

      <IncomeGroup title="Third-party support (friends / family / other)">
        <IncomeRow
          prefix={prefix}
          path="thirdParty.incomeSupportReceived"
          label="Additional Income Support received"
        />
        <NoteRow>
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
        </NoteRow>
      </IncomeGroup>

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
    // fills its card and lays its blocks out vertically.
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
