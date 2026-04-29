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
import { CountryCombobox } from "@/components/portal/form-fields/country-combobox";
import { FileUpload } from "@/components/portal/file-upload";
import type { ChildDetailsFormValues } from "@/lib/schemas/child-details";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";

const GENDERS = ["Male", "Female", "Prefer not to say", "Other"];

interface ChildDetailsFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

export function ChildDetailsForm({ applicationId, documentMap }: ChildDetailsFormProps) {
  const form = useFormContext<ChildDetailsFormValues>();
  const { control, setValue } = form;

  // Resolve the initial existing document from the documentMap (real DB metadata).
  const initialBirthCertDocId = React.useRef(
    form.getValues("birthCertificateDocumentId")
  );
  const existingBirthCert = React.useMemo(() => {
    const docId = initialBirthCertDocId.current;
    if (!docId || !documentMap?.[docId]) return undefined;
    const doc = documentMap[docId];
    return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
  }, [documentMap]);

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

        <CountryCombobox
          control={control}
          name="placeOfBirth"
          label="Place of birth"
          placeholder="Select country of birth..."
          required
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
          existingDocument={existingBirthCert}
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
          label="Does the child live at the same address as Parent/Guardian 1?"
          description="You will enter the parent/guardian address in the Parent Details section. If the child lives elsewhere, enter their address below."
          required
        />

        <ConditionalField show={sameAddressAsParent1 === false}>

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

          <CountryCombobox
            control={control}
            name="childAddress.country"
            label="Country"
            placeholder="Select country..."
            required
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
