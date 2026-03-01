"use client";

/**
 * ParentsIncomeForm — Section 7: Parents' Income (stub)
 *
 * 14 income line items per parent + supporting documents.
 */

import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import type { ParentsIncomeFormValues } from "@/lib/schemas/parents-income";

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
}

function ParentIncomeSection({ prefix, parentLabel }: ParentIncomeSectionProps) {
  const { control } = useFormContext<ParentsIncomeFormValues>();

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

export function ParentsIncomeForm() {
  return (
    <div className="space-y-10">
      <div className="rounded-md bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          Please complete the table below showing GROSS INCOME before deduction
          of tax from all sources of income. Where a source is not applicable to
          you, please enter 0.
        </p>
      </div>

      <ParentIncomeSection prefix="parent1Income" parentLabel="Parent / Guardian 1" />

      <hr className="border-slate-200" />

      <ParentIncomeSection prefix="parent2Income" parentLabel="Parent / Guardian 2" />
    </div>
  );
}
