"use client";

/**
 * DeclarationForm — Section 10: Declaration
 *
 * Legal declaration text + acceptance checkbox + signature name.
 */

import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { DeclarationFormValues } from "@/lib/schemas/declaration";

const DECLARATION_POINTS = [
  "I/We the undersigned do solemnly and sincerely declare that to the best of our knowledge the information provided is accurate and complete.",
  "Income and assets are truthfully declared from all sources.",
  "The Foundation and the School may verify information provided.",
  "False information will result in disqualification from the bursary scheme and full fees becoming payable.",
  "Bursary awards are subject to annual re-assessment; parents/guardians must re-apply each year.",
  "Parents/guardians accept that the Foundation's decision is final.",
  "By accepting this declaration, you agree to the Bursary Contract terms and conditions.",
  "Financial information submitted will be used solely for the bursary application process.",
  "You acknowledge data protection rights as described in our Privacy Notice.",
  "Reference is made to a separate Bursary Contract which governs the award terms.",
];

export function DeclarationForm() {
  const { control } = useFormContext<DeclarationFormValues>();

  return (
    <div className="space-y-8">
      {/* Declaration text */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-6">
        <h2 className="mb-4 text-base font-semibold text-primary-900">
          Declaration
        </h2>
        <ol className="space-y-3">
          {DECLARATION_POINTS.map((point, index) => (
            <li key={index} className="flex gap-3 text-sm text-primary-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-900 text-xs font-medium text-white">
                {index + 1}
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Acceptance checkbox */}
      <FormField
        control={control}
        name="accepted"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-4">
              <FormControl>
                <Checkbox
                  id="declaration-accepted"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <FormLabel
                htmlFor="declaration-accepted"
                className="cursor-pointer font-normal leading-relaxed text-slate-700"
              >
                By clicking this box, I/we agree to the terms and conditions of
                the declaration set out above. I/we confirm that all information
                provided in this application is true and accurate to the best of
                my/our knowledge.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Signature */}
      <FormField
        control={control}
        name="signedOnBehalfOf"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              On behalf of the applicant{" "}
              <span className="text-error-600" aria-hidden="true">*</span>
            </FormLabel>
            <p className="text-xs text-slate-500">
              Enter the full name of the person accepting this declaration.
            </p>
            <FormControl>
              <Input
                placeholder="Full name"
                {...field}
                value={field.value ?? ""}
                className="max-w-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Warning note */}
      <div className="rounded-md border border-warning-200 bg-warning-50 p-4">
        <p className="text-sm font-medium text-warning-600">
          Important: Submitting this declaration is a legal commitment.
        </p>
        <p className="mt-1 text-xs text-warning-600">
          Any false or misleading information provided may result in your
          application being disqualified and full school fees becoming payable.
        </p>
      </div>
    </div>
  );
}
