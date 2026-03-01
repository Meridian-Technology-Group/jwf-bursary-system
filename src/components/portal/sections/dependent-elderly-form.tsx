"use client";

/**
 * DependentElderlyForm — Section 5: Dependent Elderly (stub)
 *
 * At-home and in-care elderly dependants with repeatable forms.
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
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import type { DependentElderlyFormValues } from "@/lib/schemas/dependent-elderly";

export function DependentElderlyForm() {
  const { control } = useFormContext<DependentElderlyFormValues>();

  const hasElderlyAtHome = useWatch({ control, name: "hasElderlyAtHome" });
  const hasElderlyInCare = useWatch({ control, name: "hasElderlyInCare" });

  return (
    <div className="space-y-8">
      {/* At home section */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Elderly dependants at home
        </legend>

        <YesNoToggle
          control={control}
          name="hasElderlyAtHome"
          label="Do you have any elderly dependant that you are providing for at home?"
          required
        />

        <ConditionalField show={hasElderlyAtHome === true}>
          <FormField
            control={control}
            name="elderlyAtHomeCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How many? <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 0)
                    }
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-500">
              Elderly dependant details form will be fully implemented in a
              future work package.
            </p>
          </div>
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* In care section */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Elderly dependants in a care home
        </legend>

        <YesNoToggle
          control={control}
          name="hasElderlyInCare"
          label="Do you have any elderly dependant that you are providing for in a care home?"
          required
        />

        <ConditionalField show={hasElderlyInCare === true}>
          <FormField
            control={control}
            name="elderlyInCareCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How many? <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 0)
                    }
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-500">
              Care home dependant details form will be fully implemented in a
              future work package.
            </p>
          </div>
        </ConditionalField>
      </fieldset>
    </div>
  );
}
