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
import { ConditionalField } from "@/components/portal/form-fields/conditional-field";
import { CountryCombobox } from "@/components/portal/form-fields/country-combobox";
import { FileUpload, type UploadedDocument } from "@/components/portal/file-upload";
import {
  isTwoParentHousehold,
  shouldAskRemarriedQuestion,
  type ParentDetailsFormValues,
} from "@/lib/schemas/parent-details";
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

/**
 * Resolve the newest document with the given slot to the FileUpload
 * `existingDocument` shape. Used for this page's P45 / redundancy uploads, which
 * use their own dedicated slots (EMPLOYMENT_P45 / EMPLOYMENT_REDUNDANCY) —
 * separate from the Income section's P45 / redundancy uploads, so the applicant
 * uploads in each place independently. Newest wins (compares `uploadedAt`).
 */
function resolveDocBySlot(
  slot: string,
  documentMap: Record<string, DocumentMeta> | undefined
): { id: string; filename: string; fileSize: number; uploadedAt: string } | undefined {
  if (!documentMap) return undefined;
  let newest: DocumentMeta | undefined;
  for (const doc of Object.values(documentMap)) {
    if (doc.slot !== slot) continue;
    if (!newest || doc.uploadedAt > newest.uploadedAt) newest = doc;
  }
  if (!newest) return undefined;
  return {
    id: newest.id,
    filename: newest.filename,
    fileSize: newest.fileSize,
    uploadedAt: newest.uploadedAt,
  };
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

// Parent-facing 3-way employment classifier. The granular income breakdown is
// captured in the Income section; the assessor sets earner status independently.
const EMPLOYMENT_STATUSES = [
  { value: "UNEMPLOYED_OR_RETIRED", label: "Unemployed or Retired" },
  { value: "EMPLOYED", label: "Employed" },
  { value: "SELF_EMPLOYED", label: "Self-employed" },
];

const SELF_EMPLOYMENT_POSITIONS = [
  { value: "DIRECTOR", label: "Director" },
  { value: "PARTNER", label: "Partner" },
  { value: "SOLE_TRADER", label: "Sole Trader" },
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
  const { control, setValue } = useFormContext<ParentDetailsFormValues>();

  // P45 + redundancy uploads use this page's OWN dedicated slots
  // (EMPLOYMENT_P45 / EMPLOYMENT_REDUNDANCY), kept separate from the Income
  // section's P45 / redundancy uploads — the applicant uploads in each place
  // independently. Resolve `existingDocument` by this page's slot.
  const existingP45 = React.useMemo(
    () => resolveDocBySlot(`EMPLOYMENT_P45${slotSuffix}`, documentMap),
    [slotSuffix, documentMap]
  );
  const existingRedundancy = React.useMemo(
    () => resolveDocBySlot(`EMPLOYMENT_REDUNDANCY${slotSuffix}`, documentMap),
    [slotSuffix, documentMap]
  );

  const status = useWatch({
    control,
    name: `${prefix}.status` as "parent1Employment.status",
  });

  const isDirector = useWatch({
    control,
    name: `${prefix}.isDirector` as "parent1Employment.isDirector",
  });

  const leftEmployment = useWatch({
    control,
    name: `${prefix}.leftEmployment` as "parent1Employment.leftEmployment",
  });

  const receivedRedundancy = useWatch({
    control,
    name: `${prefix}.receivedRedundancy` as "parent1Employment.receivedRedundancy",
  });

  // Shared "left employment" sub-branch — rendered identically across all three
  // status paths; only the toggle label differs (passed in).
  const leftEmploymentBranch = (leftEmploymentLabel: string) => (
    <>
      <YesNoToggle
        control={control}
        name={`${prefix}.leftEmployment` as "parent1Employment.leftEmployment"}
        label={leftEmploymentLabel}
      />

      <ConditionalField show={leftEmployment === true}>
        <FileUpload
          slot={`EMPLOYMENT_P45${slotSuffix}`}
          label="Upload P45"
          hint="You can upload this now, or any time before you submit the application."
          applicationId={applicationId}
          existingDocument={existingP45}
          onUploadComplete={(doc: UploadedDocument) => {
            setValue(`${prefix}.p45DocumentId`, doc.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onRemove={() => {
            setValue(`${prefix}.p45DocumentId`, undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
        <FormField
          control={control}
          name={`${prefix}.p45DocumentId` as "parent1Employment.p45DocumentId"}
          render={() => (
            <FormItem className="hidden" aria-hidden="true">
              <FormControl><input type="hidden" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <YesNoToggle
          control={control}
          name={`${prefix}.receivedRedundancy` as "parent1Employment.receivedRedundancy"}
          label="Did you receive a redundancy / severance package?"
        />

        <ConditionalField show={receivedRedundancy === true}>
          <FileUpload
            slot={`EMPLOYMENT_REDUNDANCY${slotSuffix}`}
            label="Upload evidence of your redundancy / severance package"
            hint="You can upload this now, or any time before you submit the application."
            applicationId={applicationId}
            existingDocument={existingRedundancy}
            onUploadComplete={(doc: UploadedDocument) => {
              setValue(`${prefix}.redundancyDocumentId`, doc.id, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onRemove={() => {
              setValue(`${prefix}.redundancyDocumentId`, undefined, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          <FormField
            control={control}
            name={`${prefix}.redundancyDocumentId` as "parent1Employment.redundancyDocumentId"}
            render={() => (
              <FormItem className="hidden" aria-hidden="true">
                <FormControl><input type="hidden" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ConditionalField>
      </ConditionalField>
    </>
  );

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

      {/* EMPLOYED */}
      <ConditionalField show={status === "EMPLOYED"}>
        <FormField
          control={control}
          name={`${prefix}.profession` as "parent1Employment.profession"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Your profession, business or trade <span className="text-error-600">*</span>
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
              <FormDescription>Maximum 1000 words.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
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
                  Please state the proportion of each class of shares you hold (%){" "}
                  <span className="text-error-600">*</span>
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
        </ConditionalField>
      </ConditionalField>

      {/* SELF_EMPLOYED */}
      <ConditionalField show={status === "SELF_EMPLOYED"}>
        <FormField
          control={control}
          name={`${prefix}.profession` as "parent1Employment.profession"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Your profession, business or trade <span className="text-error-600">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Self-employment details sub-panel (spec: "opens new window" — inline). */}
        <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <FormField
            control={control}
            name={`${prefix}.selfEmploymentCompanyName` as "parent1Employment.selfEmploymentCompanyName"}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Company Name <span className="text-error-600">*</span>
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
            name={`${prefix}.selfEmploymentPosition` as "parent1Employment.selfEmploymentPosition"}
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>
                  Position <span className="text-error-600">*</span>
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-2"
                  >
                    {SELF_EMPLOYMENT_POSITIONS.map((sp) => (
                      <div key={sp.value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={sp.value}
                          id={`${prefix}-pos-${sp.value}`}
                        />
                        <Label
                          htmlFor={`${prefix}-pos-${sp.value}`}
                          className="font-normal"
                        >
                          {sp.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

      </ConditionalField>

      {/* Shared "left employment in the last 12 months" branch — appears for all
          three statuses (self-employed gets the longer wording). Rendered ONCE
          (not per-path) so the single shared P45/redundancy slot is mounted once. */}
      <ConditionalField show={!!status}>
        {leftEmploymentBranch(
          status === "SELF_EMPLOYED"
            ? "Have you left employment in the last 12 months and set up a new business (or became a director) in the last 12 months?"
            : "Have you left employment in the last 12 months?"
        )}
      </ConditionalField>

      {/* Confirmation (income declaration lives on the final Declaration step). */}
      <Separator />
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
                I can confirm that the information entered above is accurate.{" "}
                <span className="text-error-600" aria-hidden="true">*</span>
              </FormLabel>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}

// ─── Household evidence upload (Epic 09: death cert) ─────────────────────────

interface HouseholdEvidenceUploadProps {
  field: "deathCertificateDocumentId";
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
  const { control, setValue } = useFormContext<ParentDetailsFormValues>();

  const isSoleParent = useWatch({ control, name: "isSoleParent" });
  const relationshipStatus = useWatch({ control, name: "relationshipStatus" });
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

  // CF-13 — the remarried/new-partnership question follows the client's matrix.
  // Never asked of the second parent (they answer only their own subset).
  const askRemarried =
    !secondaryMode &&
    shouldAskRemarriedQuestion({ isSoleParent, relationshipStatus });

  // A previously-given answer must not keep steering the household rules once
  // the question stops being asked (e.g. the applicant answers YES, then
  // switches to Married + not-a-sole-parent). Drop it from the form state so the
  // next save persists the absence; `householdInputFromSources` applies the same
  // matrix to data already sitting in the database.
  React.useEffect(() => {
    if (!askRemarried && isRemarriedSoleParent !== undefined) {
      setValue("isRemarriedSoleParent", undefined, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [askRemarried, isRemarriedSoleParent, setValue]);

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
        // Guardianship facet (D16) removed from the parent form — never enters
        // guardian-only handling from this flow. Engine support retained for
        // back-compat with any historical data.
        isGuardian: false,
        custodyArrangement: custodyArrangement ?? "SOLE",
        hasSchoolFeesCourtOrder: hasSchoolFeesCourtOrder === true,
        isRemarriedSoleParent: askRemarried && isRemarriedSoleParent === true,
        financesNotDisentangled: financesNotDisentangled === true,
      }),
    [
      relationshipStatus,
      isSoleParent,
      custodyArrangement,
      hasSchoolFeesCourtOrder,
      askRemarried,
      isRemarriedSoleParent,
      financesNotDisentangled,
    ]
  );

  const isSeparatedOrDivorced =
    relationshipStatus === "SEPARATED" || relationshipStatus === "DIVORCED";

  // Two-parent household: show Parent/Guardian 2 when the applicant is not a
  // sole parent OR has a coupled relationship status (married / civil
  // partnership / cohabiting), regardless of the sole-parent answer. Always
  // suppressed for the second parent's own contribute flow.
  const showSecondParent =
    !secondaryMode &&
    isTwoParentHousehold({ isSoleParent, relationshipStatus });

  // Whether the household-questions box has anything to show for the current
  // relationship status / facets. When false the box is not rendered at all, so
  // it collapses to nothing rather than leaving an empty grey panel.
  const hasHouseholdContent =
    isSeparatedOrDivorced ||
    relationshipStatus === "WIDOWED" ||
    askRemarried ||
    isSoleParent === false ||
    handling.gate === "CANNOT_SUPPORT" ||
    handling.requiredEvidence.length > 0;

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
              showSecondParent
                ? "Both sections will appear for you and your partner to fill in."
                : "Only sections relevant to you will be displayed."
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
              Current relationship status with the child on the application&apos;s
              other parent <span className="text-error-600">*</span>
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
      {!secondaryMode && hasHouseholdContent && (
        <div className="space-y-6 rounded-md border border-slate-200 bg-slate-50 p-4">
          {/* Separated / divorced — school-fees court order (H7 discriminator)
              and the finances-in-flux (H9) facet. */}
          {isSeparatedOrDivorced && (
            <YesNoToggle
              control={control}
              name="financesNotDisentangled"
              label="Are your finances still being separated (for example, mid-divorce)?"
              description="This helps the assessor understand whether the household income is settled."
            />
          )}

          {/* H7 — divorced + school-fees court order question */}
          {relationshipStatus === "DIVORCED" && (
            <YesNoToggle
              control={control}
              name="hasSchoolFeesCourtOrder"
              label="Is there a court order specifically for the payment of school fees?"
              description="A court order that already covers the school fees affects whether a bursary can be considered."
            />
          )}

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

          {/* D17 / CF-13 — remarried or new partnership. Asked per the client's
              matrix (see shouldAskRemarriedQuestion): always for single /
              widowed / separated / divorced, and for a coupled status only when
              the applicant says they are a sole parent. */}
          {askRemarried && (
            <YesNoToggle
              control={control}
              name="isRemarriedSoleParent"
              label="Have you remarried or formed a new partnership since the child's other natural parent?"
            />
          )}

          {/* D15 — shared custody split. Offered when there is a non-resident
              natural parent (separated/divorced, not sole). */}
          {isSeparatedOrDivorced && isSoleParent === false && (
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
          )}

          {/* H3 — death certificate (widowed) */}
          {relationshipStatus === "WIDOWED" && (
            <HouseholdEvidenceUpload
              field="deathCertificateDocumentId"
              slot="DEATH_CERTIFICATE"
              label="Death certificate of the child's other parent (required)"
              applicationId={applicationId}
              documentMap={documentMap}
            />
          )}

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

      {/* Parent 2 — shown for a two-parent household (sole=no OR coupled status) */}
      <ConditionalField show={showSecondParent}>
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
