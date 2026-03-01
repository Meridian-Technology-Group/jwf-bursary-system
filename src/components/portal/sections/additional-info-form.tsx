"use client";

/**
 * AdditionalInfoForm — Section 9: Additional Information (stub)
 *
 * Circumstances checklist + free-text narrative.
 */

import { useFormContext, useWatch } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import type { AdditionalInfoFormValues } from "@/lib/schemas/additional-info";

type CircumstanceKey = keyof Pick<
  AdditionalInfoFormValues,
  | "divorced"
  | "separated"
  | "sickUnableToWork"
  | "rent"
  | "madeRedundant"
  | "receivingBenefits"
>;

const CIRCUMSTANCES: { key: CircumstanceKey; label: string }[] = [
  { key: "divorced", label: "Divorced (if applicable)" },
  { key: "separated", label: "Separated (if applicable)" },
  { key: "sickUnableToWork", label: "Sick / unable to work" },
  { key: "rent", label: "Paying rent (current statement or lease)" },
  { key: "madeRedundant", label: "Been made redundant or lost employment" },
  { key: "receivingBenefits", label: "Receiving benefits" },
];

function CircumstanceRow({ item }: { item: (typeof CIRCUMSTANCES)[0] }) {
  const { control } = useFormContext<AdditionalInfoFormValues>();
  const applies = useWatch({
    control,
    name: `${item.key}.applies`,
  });

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
      <YesNoToggle
        control={control}
        name={`${item.key}.applies`}
        label={item.label}
      />
      <ConditionalField show={applies === true}>
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">
            Upload: Supporting documents for &ldquo;{item.label}&rdquo;
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Document upload available once application is created.
          </p>
        </div>
      </ConditionalField>
    </div>
  );
}

export function AdditionalInfoForm() {
  const { control, watch } = useFormContext<AdditionalInfoFormValues>();
  const narrative = watch("additionalNarrative") ?? "";
  const maxChars = 3000;

  return (
    <div className="space-y-6">
      {/* Circumstances checklist */}
      <div>
        <h3 className="text-base font-semibold text-primary-900 mb-2">
          Circumstances checklist
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Please use this form to tell us if, in a current or previous
          application, any of the following apply:
        </p>

        <div className="space-y-3">
          {CIRCUMSTANCES.map((item) => (
            <CircumstanceRow key={item.key} item={item} />
          ))}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Free-text narrative */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-primary-900">
          Additional information
        </h3>
        <p className="text-sm text-slate-500">
          Please help us identify any difficulties which you think we may
          consider to be factors in assessing need for this award. The bursary
          committee is unable to consider any information that is not included in
          your application.
        </p>

        <FormField
          control={control}
          name="additionalNarrative"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional narrative</FormLabel>
              <FormControl>
                <Textarea
                  rows={8}
                  placeholder="Provide any additional context relevant to your application..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <div className="flex justify-end">
                <span
                  className={
                    narrative.length > maxChars * 0.9
                      ? "text-xs text-warning-600"
                      : "text-xs text-slate-400"
                  }
                >
                  {narrative.length} / {maxChars} characters
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
