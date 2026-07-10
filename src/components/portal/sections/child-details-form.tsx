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
import { CHILD_TITLES } from "@/lib/schemas/child-details";
import type { UploadedDocument } from "@/components/portal/file-upload";
import type { DocumentMeta } from "@/lib/db/queries/applications";

const GENDERS = ["Male", "Female", "Prefer not to say", "Other"];

const SCHOOL_LABELS: Record<string, string> = {
  TRINITY: "Trinity School",
  WHITGIFT: "Whitgift School",
};

/** The stored Parent/Guardian 1 address, shown when the child shares it (D1). */
export interface StoredParentAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

interface ChildDetailsFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  /** The school LOCKED at the admin invite (D1) — shown read-only as Q1. */
  lockedSchool?: "TRINITY" | "WHITGIFT" | null;
  /** Stored Parent 1 address from the contact/parent details — shown read-only
   *  when the child lives at the same address (workbook §3 Q7). */
  parent1Address?: StoredParentAddress | null;
}

export function ChildDetailsForm({
  applicationId,
  documentMap,
  lockedSchool,
  parent1Address,
}: ChildDetailsFormProps) {
  const form = useFormContext<ChildDetailsFormValues>();
  const { control, setValue } = form;

  // Ensure the LOCKED school is always written to the form value, even though
  // the field is display-only (Q1 read-only, D1). It is seeded from the
  // application; pin it so the submitted blob always carries the locked value.
  React.useEffect(() => {
    if (lockedSchool) {
      setValue("school", lockedSchool, { shouldValidate: true, shouldDirty: false });
    }
  }, [lockedSchool, setValue]);

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
      {/* Section 1.1 — School (Q1, read-only, LOCKED at the admin invite — D1) */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-primary-900">
          School applying for
        </legend>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            School
          </p>
          <p className="mt-1 text-sm font-medium text-primary-900">
            {lockedSchool ? SCHOOL_LABELS[lockedSchool] ?? lockedSchool : "—"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            The school for this application was set when you were invited and
            cannot be changed here. If it is incorrect, please contact the
            bursary team.
          </p>
        </div>
        {/* Keep the school value in the form state (display-only field). */}
        <FormField
          control={control}
          name="school"
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl><input type="hidden" /></FormControl>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr_1fr]">
          <FormField
            control={control}
            name="childTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHILD_TITLES.map((t) => (
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
            name="childFirstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  First name{" "}
                  <span className="text-error-600" aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter first name(s)"
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
            name="childSurname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Surname{" "}
                  <span className="text-error-600" aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter surname"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
          name="placeOfBirthCity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Place of birth — town / city{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter town or city of birth"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <CountryCombobox
          control={control}
          name="placeOfBirth"
          label="Place of birth — country"
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

        {/* When the child shares Parent 1's address, show the stored address
            read-only (workbook §3 Q7) rather than asking for free-text re-entry. */}
        <ConditionalField show={sameAddressAsParent1 === true}>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Parent / Guardian 1 address
            </p>
            {parent1Address &&
            (parent1Address.addressLine1 || parent1Address.postcode) ? (
              <address className="mt-1 not-italic text-sm text-primary-900">
                {[
                  parent1Address.addressLine1,
                  parent1Address.addressLine2,
                  parent1Address.city,
                  parent1Address.postcode,
                  parent1Address.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </address>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Your address will be shown here once you complete the Parent /
                Guardian Details section. You can edit it there.
              </p>
            )}
          </div>
        </ConditionalField>

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
