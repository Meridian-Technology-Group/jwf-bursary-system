"use client";

/**
 * OtherInfoForm — Section 6: Other Information Required (stub)
 *
 * Court orders, insurance policies, outstanding fees.
 */

import { useFormContext, useWatch } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import type { OtherInfoFormValues } from "@/lib/schemas/other-info";

export function OtherInfoForm() {
  const { control } = useFormContext<OtherInfoFormValues>();

  const hasCOurtOrder = useWatch({ control, name: "hasCOurtOrder" });
  const hasInsurancePolicy = useWatch({ control, name: "hasInsurancePolicy" });
  const hasOutstandingFees = useWatch({ control, name: "hasOutstandingFees" });

  return (
    <div className="space-y-8">
      {/* Court orders */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Court orders
        </legend>

        <YesNoToggle
          control={control}
          name="hasCOurtOrder"
          label="Do you have a court order for the payment of school fees?"
          required
        />

        <ConditionalField show={hasCOurtOrder === true}>
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              control={control}
              name="courtOrderTermAmount"
              label="Amount per term"
              required
            />
            <CurrencyInput
              control={control}
              name="courtOrderYearAmount"
              label="Amount per year"
              required
            />
          </div>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Upload: Evidence of Court Order
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Document upload available once application is created.
            </p>
          </div>
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Insurance policies */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Insurance policies
        </legend>

        <YesNoToggle
          control={control}
          name="hasInsurancePolicy"
          label="Do you have the benefit of any insurance policies specifically to pay school fees?"
          required
        />

        <ConditionalField show={hasInsurancePolicy === true}>
          <CurrencyInput
            control={control}
            name="insurancePolicyAmount"
            label="Amount to be paid this school year"
            required
          />
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Outstanding school fees */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Outstanding school fees
        </legend>

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
                <FormLabel>
                  Name(s) of school <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <CurrencyInput
            control={control}
            name="outstandingFeesAmount"
            label="Amount owed"
            required
          />
        </ConditionalField>
      </fieldset>
    </div>
  );
}
