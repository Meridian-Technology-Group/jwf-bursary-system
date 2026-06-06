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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { YesNoToggle } from "@/components/portal/form-fields/yes-no-toggle";
import { CurrencyInput } from "@/components/portal/form-fields/currency-input";
import { DateInput } from "@/components/portal/form-fields/date-input";
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { CountryCombobox } from "@/components/portal/form-fields/country-combobox";
import { FileUpload, type UploadedDocument } from "@/components/portal/file-upload";
import type { ParentDetailsFormValues } from "@/lib/schemas/parent-details";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import {
  deriveHouseholdScenario,
  EVIDENCE_LABELS,
  type RelationshipStatus,
} from "@/lib/household/rules";
import { AlertTriangle, ShieldAlert } from "lucide-react";

/** Resolve a stored document id to the FileUpload `existingDocument` shape. */
function resolveDoc(
  docId: string | undefined,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!docId || !documentMap?.[docId]) return undefined;
  const doc = documentMap[docId];
  return { id: doc.id, filename: doc.filename, fileSize: doc.fileSize, uploadedAt: doc.uploadedAt };
}

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

// Values mirror the assessor-side EmploymentStatus enum (assessment_earners
// table). Labels are applicant-facing — slightly more verbose than the
// internal enum names. See B11.
const EMPLOYMENT_STATUSES = [
  { value: "PAYE", label: "Employed (PAYE)" },
  { value: "BENEFITS", label: "Receiving benefits only (not working)" },
  { value: "SELF_EMPLOYED_DIRECTOR", label: "Self-employed — company director" },
  { value: "SELF_EMPLOYED_SOLE", label: "Self-employed — sole trader" },
  { value: "OLD_AGE_PENSION", label: "Receiving state / old-age pension" },
  { value: "PAST_PENSION", label: "Receiving private or occupational pension" },
  { value: "UNEMPLOYED", label: "Unemployed" },
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
              <FormLabel>
                Mobile no. <span className="text-error-600">*</span>
              </FormLabel>
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
      <p className="-mt-2 text-xs text-slate-500">
        A telephone or mobile number is required.
      </p>

      {/* Email — MANDATORY for every parent/guardian (captured even when the
          family was invited by email). */}
      <FormField
        control={control}
        name={`${prefix}.email` as "parent1Contact.email"}
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

      <CountryCombobox
        control={control}
        name={`${prefix}.country` as "parent1Contact.country"}
        label="Country"
        placeholder="Select country..."
        required
      />
    </div>
  );
}

// ─── Employment fields ────────────────────────────────────────────────────────

interface ParentEmploymentFieldsProps {
  prefix: "parent1Employment" | "parent2Employment";
  parentLabel: string;
  /** Slot suffix: "_PARENT_1" or "_PARENT_2" */
  slotSuffix: "_PARENT_1" | "_PARENT_2";
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

function ParentEmploymentFields({
  prefix,
  parentLabel,
  slotSuffix,
  applicationId,
  documentMap,
}: ParentEmploymentFieldsProps) {
  const { control, setValue, getValues } = useFormContext<ParentDetailsFormValues>();

  // Capture initial doc IDs once (stable refs so existingDocument doesn't
  // change on every render and reset the FileUpload state).
  const initialCertifiedAccountsDocId = React.useRef(getValues(`${prefix}.certifiedAccountsDocumentId`));
  const initialBalanceSheetDocId = React.useRef(getValues(`${prefix}.balanceSheetDocumentId`));
  const initialLeftSelfEmploymentDocId = React.useRef(getValues(`${prefix}.leftSelfEmploymentDocumentId`));
  const initialScholarshipDocId = React.useRef(getValues(`${prefix}.scholarshipDocumentId`));

  const existingCertifiedAccounts = React.useMemo(
    () => resolveDoc(initialCertifiedAccountsDocId.current, documentMap),
    [documentMap]
  );
  const existingBalanceSheet = React.useMemo(
    () => resolveDoc(initialBalanceSheetDocId.current, documentMap),
    [documentMap]
  );
  const existingLeftSelfEmployment = React.useMemo(
    () => resolveDoc(initialLeftSelfEmploymentDocId.current, documentMap),
    [documentMap]
  );
  const existingScholarship = React.useMemo(
    () => resolveDoc(initialScholarshipDocId.current, documentMap),
    [documentMap]
  );

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

  // Statuses that reveal profession/employer/director fields. Mirrors
  // WORKING_STATUSES in src/lib/schemas/parent-details.ts.
  const isWorking = status
    ? ["PAYE", "SELF_EMPLOYED_DIRECTOR", "SELF_EMPLOYED_SOLE"].includes(status)
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

          <FileUpload
            slot={`CERTIFIED_ACCOUNTS${slotSuffix}`}
            label="Copy of latest certified/audited accounts"
            applicationId={applicationId}
            existingDocument={existingCertifiedAccounts}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.certifiedAccountsDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.certifiedAccountsDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.certifiedAccountsDocumentId` as "parent1Employment.certifiedAccountsDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FileUpload
            slot={`BALANCE_SHEET${slotSuffix}`}
            label="Copy of latest balance sheet"
            applicationId={applicationId}
            existingDocument={existingBalanceSheet}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.balanceSheetDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.balanceSheetDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.balanceSheetDocumentId` as "parent1Employment.balanceSheetDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>

        <YesNoToggle
          control={control}
          name={`${prefix}.leftSelfEmployment` as "parent1Employment.leftSelfEmployment"}
          label="Have you left self-employment since April?"
        />

        <ConditionalField show={leftSelfEmployment === true}>
          <FileUpload
            slot={`LEFT_SELF_EMPLOYMENT${slotSuffix}`}
            label="Evidence of previous self-employment"
            hint="You can upload this now, or any time before you submit the application."
            applicationId={applicationId}
            existingDocument={existingLeftSelfEmployment}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.leftSelfEmploymentDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.leftSelfEmploymentDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.leftSelfEmploymentDocumentId` as "parent1Employment.leftSelfEmploymentDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <FileUpload
            slot={`SCHOLARSHIP${slotSuffix}`}
            label="Evidence of scholarship / maintenance"
            hint="You can upload this now, or any time before you submit the application."
            applicationId={applicationId}
            existingDocument={existingScholarship}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.scholarshipDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.scholarshipDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.scholarshipDocumentId` as "parent1Employment.scholarshipDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
      <FormField
        control={control}
        name={`${prefix}.declarationAccepted` as "parent1Employment.declarationAccepted"}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value === true}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel className="cursor-pointer">
                I accept the above declaration{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}

// ─── Household evidence upload (Epic 09: death cert / guardianship) ───────────

interface HouseholdEvidenceUploadProps {
  field: "deathCertificateDocumentId" | "guardianshipDocumentId";
  slot: string;
  label: string;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}

function HouseholdEvidenceUpload({
  field,
  slot,
  label,
  applicationId,
  documentMap,
}: HouseholdEvidenceUploadProps) {
  const { control, setValue, getValues } =
    useFormContext<ParentDetailsFormValues>();
  const initialDocId = React.useRef(getValues(field));
  const existing = React.useMemo(
    () => resolveDoc(initialDocId.current, documentMap),
    [documentMap]
  );

  return (
    <>
      <FileUpload
        slot={slot}
        label={label}
        hint="You can upload this now, or any time before you submit the application."
        applicationId={applicationId}
        existingDocument={existing}
        onUploadComplete={(doc: UploadedDocument) =>
          setValue(field, doc.id, { shouldValidate: true, shouldDirty: true })
        }
        onRemove={() =>
          setValue(field, undefined, { shouldValidate: true, shouldDirty: true })
        }
      />
      <FormField
        control={control}
        name={field}
        render={() => (
          <FormItem className="hidden" aria-hidden="true">
            <FormControl>
              <input type="hidden" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ParentDetailsFormProps {
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  /**
   * Secondary-parent (dual-parent, PR 4b) mode. When true the sole-parent
   * toggle and the entire Parent/Guardian 2 block are hidden, and only the
   * single-earner ("Parent / Guardian 1") layout is shown — the second parent
   * supplies only their own details. `isSoleParent` is held at true by the
   * caller's default values so the schema's parent-2 validation is skipped.
   */
  secondaryMode?: boolean;
}

export function ParentDetailsForm({
  applicationId,
  documentMap,
  secondaryMode = false,
}: ParentDetailsFormProps) {
  const { control } = useFormContext<ParentDetailsFormValues>();

  const isSoleParent = useWatch({ control, name: "isSoleParent" });
  const relationshipStatus = useWatch({ control, name: "relationshipStatus" });
  const isGuardian = useWatch({ control, name: "isGuardian" });
  const custodyArrangement = useWatch({ control, name: "custodyArrangement" });
  const hasSchoolFeesCourtOrder = useWatch({
    control,
    name: "hasSchoolFeesCourtOrder",
  });
  const isRemarriedSoleParent = useWatch({
    control,
    name: "isRemarriedSoleParent",
  });
  const financesNotDisentangled = useWatch({
    control,
    name: "financesNotDisentangled",
  });

  // Epic 09: derive the live household scenario from the watched values so the
  // form reveals exactly the right question subset (D15/D16/D17) and the H7
  // cannot-support notice — using the SAME rules module the assessor reads.
  // Suppressed entirely in secondaryMode (the second parent never answers the
  // household-level questions).
  const handling = React.useMemo(
    () =>
      deriveHouseholdScenario({
        relationshipStatus: (relationshipStatus ??
          "SINGLE") as RelationshipStatus,
        isSoleParent: isSoleParent === true,
        isGuardian: isGuardian === true,
        custodyArrangement: custodyArrangement ?? "SOLE",
        hasSchoolFeesCourtOrder: hasSchoolFeesCourtOrder === true,
        isRemarriedSoleParent: isRemarriedSoleParent === true,
        financesNotDisentangled: financesNotDisentangled === true,
      }),
    [
      relationshipStatus,
      isSoleParent,
      isGuardian,
      custodyArrangement,
      hasSchoolFeesCourtOrder,
      isRemarriedSoleParent,
      financesNotDisentangled,
    ]
  );

  const isSeparatedOrDivorced =
    relationshipStatus === "SEPARATED" || relationshipStatus === "DIVORCED";

  return (
    <div className="space-y-8">
      {/* 2.1 Sole parent — hidden in secondary mode (held at sole-parent) */}
      {!secondaryMode && (
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
      )}

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

      {/* ── Epic 09 household questions — suppressed for the second parent
          (they answer only their own subset). Each reveal is driven by the
          relationship status / facets so we ask only the right question set. ── */}
      {!secondaryMode && (
        <div className="space-y-6 rounded-md border border-slate-200 bg-slate-50 p-4">
          {/* D16 — foster carer / legal guardian facet */}
          <YesNoToggle
            control={control}
            name="isGuardian"
            label="Are you applying as a foster carer or legal guardian?"
            description="If you are the child's guardian rather than a natural parent, we will ask for evidence of guardianship."
          />

          {/* Separated / divorced — school-fees court order (H7 discriminator)
              and the finances-in-flux (H9) facet. */}
          <ConditionalField show={isSeparatedOrDivorced}>
            <YesNoToggle
              control={control}
              name="financesNotDisentangled"
              label="Are your finances still being separated (for example, mid-divorce)?"
              description="This helps the assessor understand whether the household income is settled."
            />
          </ConditionalField>

          {/* H7 — divorced + school-fees court order question */}
          <ConditionalField show={relationshipStatus === "DIVORCED"}>
            <YesNoToggle
              control={control}
              name="hasSchoolFeesCourtOrder"
              label="Is there a court order specifically for the payment of school fees?"
              description="A court order that already covers the school fees affects whether a bursary can be considered."
            />
          </ConditionalField>

          {/* H7 cannot-support notice — inline, NON-blocking. The applicant may
              still submit; it explains the likely outcome (mirrors the FAQ). */}
          {handling.gate === "CANNOT_SUPPORT" && (
            <div
              className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
              role="status"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  This may preclude support for a bursary
                </p>
                <p className="mt-1 leading-relaxed">
                  Because the school fees are already covered by a court order,
                  they are an existing legal liability. The Foundation will still
                  review your application, but a discretionary bursary cannot
                  usually be awarded where a court order for school fees is in
                  place. You may continue and submit if you wish.
                </p>
              </div>
            </div>
          )}

          {/* D17 — remarried sole parent (three incomes via two-earner +
              maintenance). Offered when the parent is in a couple (not sole). */}
          <ConditionalField show={isSoleParent === false}>
            <YesNoToggle
              control={control}
              name="isRemarriedSoleParent"
              label="Have you remarried or formed a new partnership since the child's other natural parent?"
              description="If so, we assess your current household together and capture the absent natural parent's contribution as maintenance."
            />
          </ConditionalField>

          {/* D15 — shared custody split. Offered when there is a non-resident
              natural parent (separated/divorced, not sole). */}
          <ConditionalField show={isSeparatedOrDivorced && isSoleParent === false}>
            <FormField
              control={control}
              name="custodyArrangement"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>How is the child&apos;s custody arranged?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? "SOLE"}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="SOLE" id="custody-sole" />
                        <Label htmlFor="custody-sole" className="font-normal">
                          The child lives mainly with one parent
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="SHARED_MAIN_LIMITED" id="custody-main" />
                        <Label htmlFor="custody-main" className="font-normal">
                          Shared — one parent has the main day-to-day care
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="SHARED_5050" id="custody-5050" />
                        <Label htmlFor="custody-5050" className="font-normal">
                          Shared equally (50/50)
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </ConditionalField>

          {/* H3 — death certificate (widowed) */}
          <ConditionalField show={relationshipStatus === "WIDOWED"}>
            <HouseholdEvidenceUpload
              field="deathCertificateDocumentId"
              slot="DEATH_CERTIFICATE"
              label="Death certificate of the child's other parent (required)"
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>

          {/* H4 — guardianship / foster evidence (D16) */}
          <ConditionalField show={isGuardian === true}>
            <HouseholdEvidenceUpload
              field="guardianshipDocumentId"
              slot="GUARDIANSHIP_EVIDENCE"
              label="Evidence of guardianship / foster status (required)"
              applicationId={applicationId}
              documentMap={documentMap}
            />
          </ConditionalField>

          {/* Evidence prompt — surfaces the scenario's expected evidence so the
              applicant knows what to gather (the actual uploads live on the
              relevant sections, wired into the rule engine). */}
          {handling.requiredEvidence.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-info-200 bg-info-50 px-3 py-2 text-xs text-info-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">For your situation we will ask for:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {handling.requiredEvidence
                    .filter((e) => e !== "SECOND_PARENT_INCOME")
                    .map((e) => (
                      <li key={e}>{EVIDENCE_LABELS[e]}</li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <hr className="border-slate-200" />

      {/* Parent 1 */}
      <ParentContactFields prefix="parent1Contact" parentLabel="Parent / Guardian 1" />
      <ParentEmploymentFields
        prefix="parent1Employment"
        parentLabel="Parent / Guardian 1"
        slotSuffix="_PARENT_1"
        applicationId={applicationId}
        documentMap={documentMap}
      />

      {/* Parent 2 — conditional on not sole parent */}
      <ConditionalField show={isSoleParent === false}>
        <hr className="border-slate-200" />
        <ParentContactFields prefix="parent2Contact" parentLabel="Parent / Guardian 2" />
        <ParentEmploymentFields
          prefix="parent2Employment"
          parentLabel="Parent / Guardian 2"
          slotSuffix="_PARENT_2"
          applicationId={applicationId}
          documentMap={documentMap}
        />
      </ConditionalField>
    </div>
  );
}
