"use client";

/**
 * ChildDetailsForm — Section 1: Details of Child
 *
 * School selection, child info, birth certificate upload, address, current school.
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { DateInput } from "@/components/portal/form-fields/date-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { FileUpload } from "@/components/portal/file-upload";
import type { ChildDetailsFormValues } from "@/lib/schemas/child-details";
import type { UploadedDocument } from "@/components/portal/file-upload";

const COUNTRIES = [
  "United Kingdom",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Canada",
  "China",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Hungary",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kenya",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United States",
  "Zimbabwe",
];

const GENDERS = ["Male", "Female", "Prefer not to say", "Other"];

interface ChildDetailsFormProps {
  applicationId: string;
}

export function ChildDetailsForm({ applicationId }: ChildDetailsFormProps) {
  const form = useFormContext<ChildDetailsFormValues>();
  const { control, setValue, watch } = form;

  const birthCertDocId = watch("birthCertificateDocumentId");

  const applyingToAnotherSchool = useWatch({
    control,
    name: "applyingToAnotherSchool",
  });

  const sameAddressAsParent1 = useWatch({
    control,
    name: "sameAddressAsParent1",
  });

  return (
    <div className="space-y-8">
      {/* Section 1.1 — School Selection */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          School selection
        </legend>

        <FormField
          control={control}
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                School you are applying for{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a school..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="TRINITY">Trinity School</SelectItem>
                  <SelectItem value="WHITGIFT">Whitgift School</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <YesNoToggle
          control={control}
          name="applyingToAnotherSchool"
          label="Are you applying to another school?"
          required
        />
      </fieldset>

      <hr className="border-slate-200" />

      {/* Section 1.2 — Child Information */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Child information
        </legend>

        <FormField
          control={control}
          name="childFullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Child&rsquo;s full name{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Enter child's full legal name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Gender{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DateInput
          control={control}
          name="dateOfBirth"
          label="Date of birth"
          required
        />

        <FormField
          control={control}
          name="placeOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Place of birth{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country of birth..." />
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
      </fieldset>

      <hr className="border-slate-200" />

      {/* Section 1.3 — Birth Certificate */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-primary-900">
          Birth certificate
        </legend>
        <p className="text-sm text-slate-500">
          Must include names of parents and place of birth.
        </p>

        <FileUpload
          slot="BIRTH_CERTIFICATE"
          label="Birth Certificate"
          hint="PDF, JPG or PNG — must show child's name, date of birth, place of birth, and parents' names."
          applicationId={applicationId}
          existingDocument={
            birthCertDocId
              ? {
                  id: birthCertDocId,
                  filename: "Birth Certificate",
                  fileSize: 0,
                  uploadedAt: new Date().toISOString(),
                }
              : undefined
          }
          onUploadComplete={(doc: UploadedDocument) => {
            setValue("birthCertificateDocumentId", doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onRemove={() => {
            setValue("birthCertificateDocumentId", undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />

        {/* Hidden field to track the document ID in the form state */}
        <FormField
          control={control}
          name="birthCertificateDocumentId"
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl>
                <Input type="hidden" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <hr className="border-slate-200" />

      {/* Section 1.4 — Child's Address */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Child&rsquo;s current address
        </legend>

        <YesNoToggle
          control={control}
          name="sameAddressAsParent1"
          label="Is the child's current address the same as Parent/Guardian 1?"
          required
        />

        <ConditionalField show={sameAddressAsParent1 === false}>
          <p className="text-xs text-slate-500">
            Address details can be edited in the &lsquo;Manage My Details&rsquo; section of the Portal.
          </p>

          <FormField
            control={control}
            name="childAddress.addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Address line 1{" "}
                  <span className="text-error-600" aria-hidden="true">*</span>
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
            name="childAddress.addressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address line 2</FormLabel>
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
              name="childAddress.city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    City / Town{" "}
                    <span className="text-error-600" aria-hidden="true">*</span>
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
              name="childAddress.postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Postcode{" "}
                    <span className="text-error-600" aria-hidden="true">*</span>
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
            name="childAddress.country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Country{" "}
                  <span className="text-error-600" aria-hidden="true">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
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
        </ConditionalField>
      </fieldset>

      <hr className="border-slate-200" />

      {/* Section 1.5 — Current School */}
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-primary-900">
          Current school
        </legend>

        <FormField
          control={control}
          name="currentSchool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                School currently attended{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter current school name"
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
          name="currentSchoolStartDate"
          label="Start date at current school"
          required
        />
      </fieldset>
    </div>
  );
}
