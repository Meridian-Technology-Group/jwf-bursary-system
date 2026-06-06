"use client";

/**
 * DeclarationForm — Section 8 (workbook): Declaration.
 *
 * Workbook-verbatim closing declaration (the six numbered terms, D11 — built to
 * the workbook structure, swappable when Charlotte supplies final wording) with
 * a SEPARATE acceptance tick + signature for Parent/Guardian 1 AND
 * Parent/Guardian 2. The P2 block is hidden for a sole-parent application.
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

/**
 * The closing declaration. Confirms the information is a complete & accurate
 * declaration of income and assets; that a JWF bursary is a discretionary grant;
 * and that the terms apply between the applicant, the Foundation and the School.
 * (Workbook §8; final wording per D11.)
 */
const DECLARATION_INTRO =
  "I/We confirm that the information given in this application is a complete and accurate declaration of our income and assets. I/We understand that a John Whitgift Foundation bursary is a discretionary grant, and that the following terms apply between me/us, the Foundation, and the School:";

const DECLARATION_TERMS = [
  "While a bursary award is in effect, a credit will be applied to the termly school-fee invoice.",
  "Every bursary award is subject to an annual review, and a new declaration of income and assets must be submitted each year.",
  "Previous years' awards are not re-reviewed as part of the annual review.",
  "I/We will notify the Foundation immediately of any material change in our financial or family circumstances.",
  "The Foundation may withdraw or reduce an award if the Parent Contract is breached, if requested information is not provided, if a fee balance is carried between terms, or following a positive material change in circumstances.",
  "An award will be withdrawn if false information has been provided, and the full fees will become payable.",
];

interface DeclarationFormProps {
  /** When true, the Parent/Guardian 2 acceptance block is hidden (sole parent). */
  isSoleParent?: boolean;
}

function ParentDeclaration({
  acceptedName,
  signedName,
  label,
  idSuffix,
}: {
  acceptedName: "acceptedParent1" | "acceptedParent2";
  signedName: "signedOnBehalfOfParent1" | "signedOnBehalfOfParent2";
  label: string;
  idSuffix: string;
}) {
  const { control } = useFormContext<DeclarationFormValues>();
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-primary-900">{label}</h3>
      <FormField
        control={control}
        name={acceptedName}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3">
              <FormControl>
                <Checkbox
                  id={`declaration-accepted-${idSuffix}`}
                  checked={field.value as boolean}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <FormLabel
                htmlFor={`declaration-accepted-${idSuffix}`}
                className="cursor-pointer font-normal leading-relaxed text-slate-700"
              >
                On behalf of {label}, I confirm I have read and agree to the
                declaration and terms set out above, and that all information
                provided is true and accurate to the best of my knowledge.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={signedName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Full name of {label}{" "}
              <span className="text-error-600" aria-hidden="true">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="Full name" {...field} value={(field.value as string) ?? ""} className="max-w-sm" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function DeclarationForm({ isSoleParent }: DeclarationFormProps) {
  return (
    <div className="space-y-8">
      {/* Declaration text */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-6">
        <h2 className="mb-3 text-base font-semibold text-primary-900">Declaration</h2>
        <p className="mb-4 text-sm text-primary-800">{DECLARATION_INTRO}</p>
        <ol className="space-y-3">
          {DECLARATION_TERMS.map((term, index) => (
            <li key={index} className="flex gap-3 text-sm text-primary-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-900 text-xs font-medium text-white">
                {index + 1}
              </span>
              <span>{term}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Per-parent acceptance */}
      <ParentDeclaration
        acceptedName="acceptedParent1"
        signedName="signedOnBehalfOfParent1"
        label="Parent / Guardian 1"
        idSuffix="p1"
      />

      {!isSoleParent && (
        <ParentDeclaration
          acceptedName="acceptedParent2"
          signedName="signedOnBehalfOfParent2"
          label="Parent / Guardian 2"
          idSuffix="p2"
        />
      )}

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
