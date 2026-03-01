"use client";

/**
 * ParentDetailsForm — Section 3: Parent/Guardian Details
 *
 * Sole parent toggle, Parent 1/2 details, employment status with
 * conditional fields, contact information.
 */

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { DateInput } from "@/components/portal/form-fields/date-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import type { ParentDetailsFormValues } from "@/lib/schemas/parent-details";

const TITLES = [
  { value: "MR", label: "Mr" },
  { value: "MRS", label: "Mrs" },
  { value: "MS", label: "Ms" },
  { value: "MISS", label: "Miss" },
  { value: "DR", label: "Dr" },
  { value: "PROF", label: "Prof" },
  { value: "OTHER", label: "Other" },
];

const RELATIONSHIP_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "SEPARATED", label: "Separated" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "CIVIL_PARTNERSHIP", label: "In a Civil Partnership" },
  { value: "COHABITING", label: "Cohabiting" },
];

const EMPLOYMENT_STATUSES = [
  { value: "EMPLOYED", label: "Employed" },
  { value: "UNEMPLOYED", label: "Unemployed" },
  { value: "SELF_EMPLOYED", label: "Self-employed" },
  { value: "SELF_EMPLOYED_CIS", label: "Self-employed (CIS registered)" },
  { value: "SELF_EMPLOYED_AND_EMPLOYED", label: "Self-employed and employed" },
  { value: "RETIRED", label: "Retired" },
];

const COUNTRIES = [
  "United Kingdom",
  "Australia",
  "Belgium",
  "Canada",
  "China",
  "France",
  "Germany",
  "India",
  "Ireland",
  "Italy",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Pakistan",
  "Poland",
  "Portugal",
  "South Africa",
  "Spain",
  "Sweden",
  "United States",
  "Other",
];

// ─── Parent Contact fields sub-component ─────────────────────────────────────

interface ParentContactFieldsProps {
  prefix: "parent1Contact" | "parent2Contact";
  parentLabel: string;
}

function ParentContactFields({
  prefix,
  parentLabel,
}: ParentContactFieldsProps) {
  const { control } = useFormContext<ParentDetailsFormValues>();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary-800">
        {parentLabel} — Contact details
      </h3>
      <p className="text-xs text-slate-500">
        Your contact details are in the &lsquo;Manage My Details&rsquo; section of the Portal.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={control}
          name={`${prefix}.title` as "parent1Contact.title"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Title <span className="text-error-600">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TITLES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.firstName` as "parent1Contact.firstName"}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>
                First name(s) <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={`${prefix}.lastName` as "parent1Contact.lastName"}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Last name <span className="text-error-600">*</span>
            </FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${prefix}.telephone` as "parent1Contact.telephone"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telephone no.</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.mobile` as "parent1Contact.mobile"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile no.</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {prefix === "parent2Contact" && (
        <FormField
          control={control}
          name="parent2Contact.email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Email address <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <Separator />

      <h4 className="text-sm font-medium text-slate-700">Address</h4>

      <FormField
        control={control}
        name={`${prefix}.addressLine1` as "parent1Contact.addressLine1"}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Address line 1 <span className="text-error-600">*</span>
            </FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`${prefix}.addressLine2` as "parent1Contact.addressLine2"}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address line 2</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${prefix}.city` as "parent1Contact.city"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City / Town <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.postcode` as "parent1Contact.postcode"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Postcode <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="uppercase"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={`${prefix}.country` as "parent1Contact.country"}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Country <span className="text-error-600">*</span>
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ─── Employment fields ────────────────────────────────────────────────────────

interface ParentEmploymentFieldsProps {
  prefix: "parent1Employment" | "parent2Employment";
  parentLabel: string;
}

function ParentEmploymentFields({
  prefix,
  parentLabel,
}: ParentEmploymentFieldsProps) {
  const { control } = useFormContext<ParentDetailsFormValues>();

  const status = useWatch({
    control,
    name: `${prefix}.status` as "parent1Employment.status",
  });

  const isDirector = useWatch({
    control,
    name: `${prefix}.isDirector` as "parent1Employment.isDirector",
  });

  const leftSelfEmployment = useWatch({
    control,
    name: `${prefix}.leftSelfEmployment` as "parent1Employment.leftSelfEmployment",
  });

  const receivesScholarship = useWatch({
    control,
    name: `${prefix}.receivesScholarship` as "parent1Employment.receivesScholarship",
  });

  const isWorking = status
    ? ["EMPLOYED", "SELF_EMPLOYED", "SELF_EMPLOYED_CIS", "SELF_EMPLOYED_AND_EMPLOYED"].includes(
        status
      )
    : false;

  const isUnemployed = status === "UNEMPLOYED";

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-primary-800">
        {parentLabel} — Employment details
      </h3>

      {/* Employment status */}
      <FormField
        control={control}
        name={`${prefix}.status` as "parent1Employment.status"}
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>
              Employment status <span className="text-error-600">*</span>
            </FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="space-y-2"
              >
                {EMPLOYMENT_STATUSES.map((es) => (
                  <div key={es.value} className="flex items-center gap-2">
                    <RadioGroupItem value={es.value} id={`${prefix}-${es.value}`} />
                    <Label htmlFor={`${prefix}-${es.value}`} className="font-normal">
                      {es.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Conditional: employed/self-employed fields */}
      <ConditionalField show={isWorking}>
        <FormField
          control={control}
          name={`${prefix}.profession` as "parent1Employment.profession"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Profession, business or trade <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.employerAddress` as "parent1Employment.employerAddress"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Name and address of employer or business <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DateInput
          control={control}
          name={`${prefix}.bookYearEndDate` as "parent1Employment.bookYearEndDate"}
          label="Book / Account year end date"
        />

        <YesNoToggle
          control={control}
          name={`${prefix}.isDirector` as "parent1Employment.isDirector"}
          label="Are you a director of this company?"
        />

        <ConditionalField show={isDirector === true}>
          <FormField
            control={control}
            name={`${prefix}.sharePercentage` as "parent1Employment.sharePercentage"}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Proportion or exact value of shares / stake (%) <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 50%"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Upload: Copy of latest certified/audited accounts
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Document upload available once application is created.
            </p>
          </div>

          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Upload: Copy of latest balance sheet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Document upload available once application is created.
            </p>
          </div>
        </ConditionalField>

        <YesNoToggle
          control={control}
          name={`${prefix}.leftSelfEmployment` as "parent1Employment.leftSelfEmployment"}
          label="Have you left self-employment since April?"
        />

        <ConditionalField show={leftSelfEmployment === true}>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Upload: Evidence of previous self-employment
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Document upload available once application is created.
            </p>
          </div>
        </ConditionalField>

        <CurrencyInput
          control={control}
          name={`${prefix}.grossPay` as "parent1Employment.grossPay"}
          label="Gross pay"
          required
        />

        <YesNoToggle
          control={control}
          name={`${prefix}.receivesScholarship` as "parent1Employment.receivesScholarship"}
          label="Do you receive a scholarship / maintenance?"
        />

        <ConditionalField show={receivesScholarship === true}>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Upload: Evidence of scholarship / maintenance
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Document upload available once application is created.
            </p>
          </div>
        </ConditionalField>
      </ConditionalField>

      {/* Conditional: unemployed */}
      <ConditionalField show={isUnemployed}>
        <FormField
          control={control}
          name={`${prefix}.unemployedDetails` as "parent1Employment.unemployedDetails"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Please provide details <span className="text-error-600">*</span>
              </FormLabel>
              <FormDescription>
                Describe your current circumstances.
              </FormDescription>
              <FormControl>
                <Textarea
                  rows={4}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </ConditionalField>

      {/* Declaration */}
      <Separator />
      <div className="rounded-md bg-primary-50 p-4 text-sm text-primary-900">
        <p className="font-medium">Declaration of {parentLabel}</p>
        <p className="mt-2 text-xs leading-relaxed text-primary-700">
          I declare to the best of my knowledge and belief, all the particulars
          here submitted are true and contain a full statement of our income from
          all sources during the period stated. I understand that the provision
          of false information will lead to my application being disqualified
          from assessment under the bursary scheme and full fees would become
          payable thereafter.
        </p>
      </div>
      <YesNoToggle
        control={control}
        name={`${prefix}.declarationAccepted` as "parent1Employment.declarationAccepted"}
        label="I accept the above declaration"
        required
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParentDetailsForm() {
  const { control } = useFormContext<ParentDetailsFormValues>();

  const isSoleParent = useWatch({ control, name: "isSoleParent" });

  return (
    <div className="space-y-8">
      {/* 2.1 Sole parent */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <YesNoToggle
          control={control}
          name="isSoleParent"
          label="Are you applying as a sole parent / guardian?"
          description={
            isSoleParent
              ? "Only sections relevant to you will be displayed."
              : "Both sections will appear for you and your partner to fill in."
          }
          required
        />
      </div>

      {/* 2.2 Relationship status */}
      <FormField
        control={control}
        name="relationshipStatus"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>
              Relationship status <span className="text-error-600">*</span>
            </FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {RELATIONSHIP_STATUSES.map((rs) => (
                  <div
                    key={rs.value}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <RadioGroupItem value={rs.value} id={`rs-${rs.value}`} />
                    <Label
                      htmlFor={`rs-${rs.value}`}
                      className="cursor-pointer font-normal"
                    >
                      {rs.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <hr className="border-slate-200" />

      {/* Parent 1 */}
      <ParentContactFields prefix="parent1Contact" parentLabel="Parent / Guardian 1" />
      <ParentEmploymentFields prefix="parent1Employment" parentLabel="Parent / Guardian 1" />

      {/* Parent 2 — conditional on not sole parent */}
      <ConditionalField show={isSoleParent === false}>
        <hr className="border-slate-200" />
        <ParentContactFields prefix="parent2Contact" parentLabel="Parent / Guardian 2" />
        <ParentEmploymentFields prefix="parent2Employment" parentLabel="Parent / Guardian 2" />
      </ConditionalField>
    </div>
  );
}
