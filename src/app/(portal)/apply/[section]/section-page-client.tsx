"use client";

/**
 * SectionPageClient — client-side shell for a section page.
 *
 * Selects the correct schema, default values, and form component
 * based on the sectionType prop, then renders SectionForm.
 *
 * Re-assessment support:
 *   - isReassessment: passed to form components so they can show the
 *     pre-populated field indicator on personal-detail fields.
 *   - isPrepopulated: true when the section data was copied from the
 *     previous year; shows the re-assessment info banner.
 */

import * as React from "react";
import type { ApplicationSectionType } from "@prisma/client";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import { SectionForm } from "@/components/portal/section-form";
// ProgressBar removed — progress is shown in the sidebar
import { PrepopulatedSectionBanner } from "@/components/portal/form-fields/prepopulated-field";
import {
  isLegacyIncomeRecord,
  normaliseLegacyIncomeRecord,
} from "@/lib/portal/income-model";
import { saveSection, submitApplication } from "../actions";
import type { SaveSectionResult } from "../actions";

// Section form components
import {
  ChildDetailsForm,
  type StoredParentAddress,
} from "@/components/portal/sections/child-details-form";
import { FamilyIdForm } from "@/components/portal/sections/family-id-form";
import { ParentDetailsForm } from "@/components/portal/sections/parent-details-form";
import { DependentChildrenForm } from "@/components/portal/sections/dependent-children-form";
import { DependentElderlyForm } from "@/components/portal/sections/dependent-elderly-form";
import { OtherInfoForm } from "@/components/portal/sections/other-info-form";
import { ParentsIncomeForm } from "@/components/portal/sections/parents-income-form";
import { AssetsLiabilitiesForm } from "@/components/portal/sections/assets-liabilities-form";
import { AdditionalInfoForm } from "@/components/portal/sections/additional-info-form";
import { DeclarationForm } from "@/components/portal/sections/declaration-form";

// Schemas
import { childDetailsSchema, splitChildFullName } from "@/lib/schemas/child-details";
import { familyIdSchema, makeFamilyIdSchema } from "@/lib/schemas/family-id";
import {
  parentDetailsSchema,
  isTwoParentHousehold,
} from "@/lib/schemas/parent-details";
import { dependentChildrenSchema } from "@/lib/schemas/dependent-children";
import { dependentElderlySchema } from "@/lib/schemas/dependent-elderly";
import { otherInfoSchema } from "@/lib/schemas/other-info";
import { parentsIncomeSchema } from "@/lib/schemas/parents-income";
import { assetsLiabilitiesSchema } from "@/lib/schemas/assets-liabilities";
import { additionalInfoSchema } from "@/lib/schemas/additional-info";
import { declarationSchema } from "@/lib/schemas/declaration";

interface SectionPageClientProps {
  sectionType: ApplicationSectionType;
  sectionTitle: string;
  applicationId: string;
  existingData: unknown;
  /** Seed for Section 1 defaults — the school captured on the Application. */
  applicationSchool?: "TRINITY" | "WHITGIFT";
  /** The school LOCKED at the admin invite (D1) — shown read-only as Q1. */
  lockedSchool?: "TRINITY" | "WHITGIFT" | null;
  /** Seed for Section 1 defaults — the child's name captured on the Application. */
  applicationChildName?: string;
  /** The applicant's own name — seeds the locked "guardian" row on FAMILY_ID (Q1). */
  applicationGuardianName?: string;
  /** Stored Parent 1 address — shown read-only when child shares it (D1, §3 Q7). */
  parent1Address?: StoredParentAddress | null;
  /**
   * The round's academic-year string (e.g. "2026/27"). Drives the dynamic
   * tax-year wording on the income section (D5). Null when unavailable.
   */
  academicYear?: string | null;
  /** Map of document ID → metadata for showing previously uploaded files. */
  documentMap?: Record<string, DocumentMeta>;
  /** Child's full name from CHILD_DETAILS (for DEPENDENT_CHILDREN section). */
  childFullName?: string;
  /** isSoleParent flag from PARENT_DETAILS (for PARENTS_INCOME section). */
  isSoleParent?: boolean;
  /** Declared employment statuses from PARENT_DETAILS — drive the income sub-tables. */
  parent1EmploymentStatus?: string;
  parent2EmploymentStatus?: string;
  /** Relationship status from PARENT_DETAILS — drives the divorced/separated sub-table. */
  relationshipStatus?: string;
  /** Declared dependent-children count (for FAMILY_ID cross-section consistency). */
  dependentChildrenCount?: number;
  backHref: string;
  nextHref: string;
  /** Optional override for the primary button label (e.g. "Review and Submit"). */
  nextLabel?: string;
  stepNumber: number;
  totalSteps: number;
  /** True when this application is a re-assessment (not a first-year application). */
  isReassessment?: boolean;
  /**
   * True when the section data was pre-populated from the previous year.
   * Triggers the "Pre-filled from last year" banner.
   */
  isPrepopulated?: boolean;
  /**
   * Optional replacement for the portal `saveSection` server action (CR-001).
   * The assessor edit-on-behalf shell passes its own role-guarded, audited
   * action; the portal passes nothing and keeps the static import.
   */
  saveOverride?: (
    applicationId: string,
    section: ApplicationSectionType,
    data: unknown
  ) => Promise<SaveSectionResult>;
  /**
   * True when an assessor is editing on behalf of the applicant (CR-001).
   * Suppresses the auto-submit after a DECLARATION save — on-behalf
   * submission is an explicit, separate action.
   */
  onBehalf?: boolean;
}

interface DefaultValuesSeed {
  applicationSchool?: "TRINITY" | "WHITGIFT";
  applicationChildName?: string;
  applicationGuardianName?: string;
  isSoleParent?: boolean;
}

/**
 * FAMILY_ID (Q1): guarantee two locked, always-required rows — the child named
 * on the application (role CHILD) and the applicant / named guardian (role
 * GUARDIAN) — followed by any additional members. Their names are locked to the
 * application source (refreshed on every load); uploaded doc ids are preserved.
 * Legacy rows with no role are treated as OTHER additional members.
 */
function normaliseFamilyId(
  existing: unknown,
  childName: string,
  guardianName: string
) {
  const raw =
    existing &&
    typeof existing === "object" &&
    Array.isArray((existing as { familyMembers?: unknown }).familyMembers)
      ? ((existing as { familyMembers: unknown[] })
          .familyMembers as Array<Record<string, unknown>>)
      : [];

  const find = (role: string) =>
    raw.find((m) => m && typeof m === "object" && m.role === role);
  const others = raw
    .filter(
      (m) =>
        m && typeof m === "object" && m.role !== "CHILD" && m.role !== "GUARDIAN"
    )
    .map((m) => ({ ...m, role: "OTHER" }));

  const fixedRow = (
    existingRow: Record<string, unknown> | undefined,
    role: "CHILD" | "GUARDIAN",
    name: string,
    fallbackId: string
  ) => ({
    id: (existingRow?.id as string) ?? fallbackId,
    role,
    familyMemberName: name, // locked to the application source
    isBritishCitizen: (existingRow?.isBritishCitizen as boolean) ?? true,
    ukPassportDocumentId: existingRow?.ukPassportDocumentId as string | undefined,
    passportDocumentId: existingRow?.passportDocumentId as string | undefined,
    ilrDocumentId: existingRow?.ilrDocumentId as string | undefined,
  });

  return {
    familyMembers: [
      fixedRow(find("CHILD"), "CHILD", childName, "family-role-child"),
      fixedRow(find("GUARDIAN"), "GUARDIAN", guardianName, "family-role-guardian"),
      ...others,
    ],
  };
}

function getDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown,
  seed: DefaultValuesSeed = {}
) {
  // FAMILY_ID is normalised the same way whether or not a draft exists (Q1).
  if (sectionType === "FAMILY_ID") {
    return normaliseFamilyId(
      existingData,
      seed.applicationChildName ?? "",
      seed.applicationGuardianName ?? ""
    );
  }

  if (existingData && typeof existingData === "object") {
    // Back-compat: a CHILD_DETAILS draft saved before the name was split into
    // title/first/surname holds only `childFullName`. Seed the split fields from
    // it so the rebuilt form renders and re-validates the legacy value.
    if (sectionType === "CHILD_DETAILS") {
      const d = existingData as {
        childFirstName?: string;
        childSurname?: string;
        childFullName?: string;
        placeOfBirthCity?: string;
      };
      if (
        d.childFirstName === undefined &&
        d.childSurname === undefined &&
        d.childFullName
      ) {
        const { firstName, surname } = splitChildFullName(d.childFullName);
        return {
          ...existingData,
          childFirstName: firstName,
          childSurname: surname,
          placeOfBirthCity: d.placeOfBirthCity ?? "",
        };
      }
      return existingData;
    }
    // Back-compat: an in-flight PARENTS_INCOME draft may hold the LEGACY flat
    // shape. Normalise each parent record into the new status-driven shape so
    // the rebuilt form can render and re-validate it (Epic 02 §5.1).
    if (sectionType === "PARENTS_INCOME") {
      const d = existingData as {
        parent1Income?: unknown;
        parent2Income?: unknown;
      };
      return {
        parent1Income: isLegacyIncomeRecord(d.parent1Income)
          ? normaliseLegacyIncomeRecord(d.parent1Income)
          : (d.parent1Income ?? { total: 0, documentsConfirmed: false }),
        ...(d.parent2Income !== undefined
          ? {
              parent2Income: isLegacyIncomeRecord(d.parent2Income)
                ? normaliseLegacyIncomeRecord(d.parent2Income)
                : d.parent2Income,
            }
          : {}),
      };
    }
    // Back-compat: a legacy DECLARATION draft holds {accepted, signedOnBehalfOf}.
    // Map it onto the new per-parent P1 fields so the rebuilt form renders it.
    if (sectionType === "DECLARATION") {
      const d = existingData as {
        acceptedParent1?: boolean;
        signedOnBehalfOfParent1?: string;
        acceptedParent2?: boolean;
        signedOnBehalfOfParent2?: string;
        accepted?: boolean;
        signedOnBehalfOf?: string;
      };
      const hasNew = d.acceptedParent1 !== undefined || d.signedOnBehalfOfParent1 !== undefined;
      if (hasNew) return existingData;
      const base = {
        acceptedParent1: d.accepted ?? false,
        signedOnBehalfOfParent1: d.signedOnBehalfOf ?? "",
      };
      return seed.isSoleParent
        ? base
        : { ...base, acceptedParent2: false, signedOnBehalfOfParent2: "" };
    }
    return existingData;
  }

  switch (sectionType) {
    case "CHILD_DETAILS": {
      const seededName = splitChildFullName(seed.applicationChildName);
      return {
        school: seed.applicationSchool,
        childTitle: "",
        childFirstName: seededName.firstName,
        childSurname: seededName.surname,
        childFullName: seed.applicationChildName ?? "",
        gender: "",
        dateOfBirth: "",
        placeOfBirthCity: "",
        placeOfBirth: "",
        sameAddressAsParent1: true,
        currentSchool: "",
        currentSchoolStartDate: "",
      };
    }
    case "PARENT_DETAILS":
      return {
        isSoleParent: undefined,
        relationshipStatus: undefined,
        parent1Contact: { title: undefined, firstName: "", lastName: "", addressLine1: "", city: "", postcode: "", country: "" },
        parent1Employment: { status: undefined },
      };
    case "DEPENDENT_CHILDREN":
      return { numberOfDependentChildren: 0, children: [] };
    case "DEPENDENT_ELDERLY":
      return { hasElderlyAtHome: undefined, elderlyAtHome: [], hasElderlyInCare: undefined, elderlyInCare: [] };
    case "OTHER_INFO":
      return { hasCOurtOrder: undefined, hasInsurancePolicy: undefined, hasOutstandingFees: undefined };
    case "PARENTS_INCOME":
      // Status-driven sub-tables (D3). The form seeds the relevant sub-blocks
      // from the declared employment status and normalises any legacy draft on
      // load (see parents-income-form.tsx). A minimal record here is enough.
      return {
        parent1Income: { total: 0, documentsConfirmed: false },
      };
    case "ASSETS_LIABILITIES":
      return {
        propertyOwnership: undefined, residenceValue: 0, hasMortgage: undefined,
        hasOtherProperties: undefined, otherProperties: [], hasChargingOrder: undefined,
        carOwnership: undefined, usesPublicTransport: undefined,
        otherPossessionsValue: 0,
        totalCashBalance: 0, investmentsValue: 0,
        parent1CurrentAccountDocumentIds: [], parent1SavingsAccountDocumentIds: [],
        parent1InvestmentDocumentIds: [], hasPersonalDebt: undefined,
        creditCardStatementDocumentIds: [], loanStatementDocumentIds: [],
        otherDebtDocumentIds: [], documentsConfirmed: false,
      };
    case "ADDITIONAL_INFO":
      return { additionalNarrative: "", additionalDocumentIds: [] };
    case "DECLARATION":
      // Per-parent ticks (Epic 02 PR-5). Seed the P2 fields only for a
      // dual-parent application so a sole parent's declaration is not blocked by
      // the P2 superRefine.
      return seed.isSoleParent
        ? { acceptedParent1: false, signedOnBehalfOfParent1: "" }
        : {
            acceptedParent1: false,
            signedOnBehalfOfParent1: "",
            acceptedParent2: false,
            signedOnBehalfOfParent2: "",
          };
    default:
      return {};
  }
}

function SectionFormContent({
  sectionType,
  applicationId,
  documentMap,
  childFullName,
  isSoleParent,
  academicYear,
  parent1EmploymentStatus,
  parent2EmploymentStatus,
  relationshipStatus,
  lockedSchool,
  parent1Address,
}: {
  sectionType: ApplicationSectionType;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  childFullName?: string;
  isSoleParent?: boolean;
  academicYear?: string | null;
  parent1EmploymentStatus?: string;
  parent2EmploymentStatus?: string;
  relationshipStatus?: string;
  lockedSchool?: "TRINITY" | "WHITGIFT" | null;
  parent1Address?: StoredParentAddress | null;
}) {
  switch (sectionType) {
    case "CHILD_DETAILS": return <ChildDetailsForm applicationId={applicationId} documentMap={documentMap} lockedSchool={lockedSchool} parent1Address={parent1Address} />;
    case "FAMILY_ID": return <FamilyIdForm applicationId={applicationId} documentMap={documentMap} />;
    case "PARENT_DETAILS": return <ParentDetailsForm applicationId={applicationId} documentMap={documentMap} />;
    case "DEPENDENT_CHILDREN": return <DependentChildrenForm childFullName={childFullName} />;
    case "DEPENDENT_ELDERLY": return <DependentElderlyForm applicationId={applicationId} documentMap={documentMap} />;
    case "OTHER_INFO": return <OtherInfoForm applicationId={applicationId} documentMap={documentMap} />;
    case "PARENTS_INCOME": return <ParentsIncomeForm isSoleParent={isTwoParentHousehold({ isSoleParent, relationshipStatus }) ? false : isSoleParent} applicationId={applicationId} documentMap={documentMap} academicYear={academicYear} parent1EmploymentStatus={parent1EmploymentStatus} parent2EmploymentStatus={parent2EmploymentStatus} relationshipStatus={relationshipStatus} />;
    case "ASSETS_LIABILITIES": return <AssetsLiabilitiesForm isSoleParent={isTwoParentHousehold({ isSoleParent, relationshipStatus }) ? false : isSoleParent} applicationId={applicationId} documentMap={documentMap} />;
    case "ADDITIONAL_INFO": return <AdditionalInfoForm applicationId={applicationId} documentMap={documentMap} />;
    case "DECLARATION": return <DeclarationForm isSoleParent={isTwoParentHousehold({ isSoleParent, relationshipStatus }) ? false : isSoleParent} />;
    default: return null;
  }
}

function getSectionSchema(sectionType: ApplicationSectionType) {
  switch (sectionType) {
    case "CHILD_DETAILS": return childDetailsSchema;
    case "FAMILY_ID": return familyIdSchema;
    case "PARENT_DETAILS": return parentDetailsSchema;
    case "DEPENDENT_CHILDREN": return dependentChildrenSchema;
    case "DEPENDENT_ELDERLY": return dependentElderlySchema;
    case "OTHER_INFO": return otherInfoSchema;
    case "PARENTS_INCOME": return parentsIncomeSchema;
    case "ASSETS_LIABILITIES": return assetsLiabilitiesSchema;
    case "ADDITIONAL_INFO": return additionalInfoSchema;
    case "DECLARATION": return declarationSchema;
    default: return declarationSchema;
  }
}

export function SectionPageClient({
  sectionType,
  sectionTitle,
  applicationId,
  existingData,
  applicationSchool,
  lockedSchool,
  applicationChildName,
  applicationGuardianName,
  academicYear,
  documentMap,
  childFullName,
  parent1Address,
  isSoleParent,
  parent1EmploymentStatus,
  parent2EmploymentStatus,
  relationshipStatus,
  dependentChildrenCount,
  backHref,
  nextHref,
  nextLabel,
  stepNumber,
  totalSteps,
  isReassessment = false,
  isPrepopulated = false,
  saveOverride,
  onBehalf = false,
}: SectionPageClientProps) {
  // FAMILY_ID validates against sibling sections (dependent-children count and
  // the household relationship), so its schema is built with that context;
  // every other section uses its static schema.
  const schema =
    sectionType === "FAMILY_ID"
      ? makeFamilyIdSchema({
          dependentChildrenCount,
          requiresPartnerAdult: isTwoParentHousehold({
            isSoleParent,
            relationshipStatus,
          }),
        })
      : getSectionSchema(sectionType);
  const defaultValues = getDefaultValues(sectionType, existingData, {
    applicationSchool,
    applicationChildName,
    applicationGuardianName,
    isSoleParent,
  });

  async function handleSave(data: unknown) {
    const save = saveOverride ?? saveSection;
    const result = await save(applicationId, sectionType, data);
    // On-behalf editing never auto-submits — submission is an explicit,
    // separate action taken by the assessor (CR-001).
    if (!result.success || sectionType !== "DECLARATION" || onBehalf) return result;

    // Declaration is the terminal step: after a successful save, submit the
    // application. submitApplication throws Next's NEXT_REDIRECT on success
    // (it calls redirect("/submitted")) — that must propagate so the router
    // can navigate. Any other thrown error is surfaced as a section-form
    // error so the user sees what went wrong.
    try {
      await submitApplication(applicationId);
    } catch (err) {
      const digest = (err as { digest?: string } | null)?.digest;
      if (
        typeof digest === "string" &&
        digest.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : "Submission failed. Please try again.";
      return { success: false, errors: [message] };
    }
    return result;
  }

  // Deep-link target: when the URL has a hash (e.g. #parent1Income.p60DocumentId
  // from the Review page's "Issues to resolve" panel), focus the matching field
  // by its `name` attribute. Form fields use react-hook-form `name` rather than
  // DOM `id`, so the browser's native hash-scroll never fires — this fills the gap.
  React.useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) return;

    const tryFocus = () => {
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(hash)
          : hash.replace(/(["\\\]\[#.:>+~*^$|()=])/g, "\\$1");
      const target =
        document.querySelector<HTMLElement>(`[name="${escaped}"]`) ??
        document.querySelector<HTMLElement>(`[name^="${escaped}"]`) ??
        document.getElementById(hash);
      if (!target) return false;
      // PR-10: the Income section collapses empty sub-tables into <details>
      // disclosures. A deep-link may target a field inside a closed one, which
      // is display:none and cannot be scrolled-to/focused — open every ancestor
      // <details> first so the target becomes visible and focusable.
      let node: HTMLElement | null = target;
      while (node) {
        if (node instanceof HTMLDetailsElement) node.open = true;
        node = node.parentElement;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tabIndex >= 0;
      if (focusable) {
        (target as HTMLElement).focus({ preventScroll: true });
      }
      return true;
    };

    // Fields may not be rendered on the first paint (FormField wraps render
    // them lazily); retry briefly so the deep-link still lands.
    if (tryFocus()) return;
    const interval = window.setInterval(() => {
      if (tryFocus()) window.clearInterval(interval);
    }, 100);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 2000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [sectionType]);

  return (
    // Per-section width cap. The portal root no longer hard-caps content at
    // max-w-3xl, so each apply section sets its own readable width HERE, on the
    // wrapper that holds BOTH the section header and the card — so the heading
    // stays aligned with the card it labels at every breakpoint. The grid-heavy
    // PARENTS_INCOME section opens to the full max-w-4xl (56rem); every other
    // section stays at the historical max-w-3xl (48rem). The cap is
    // `mx-auto w-full max-w-Nxl` inside the layout's padded <main>, so the
    // rendered width is min(cap, viewport − 280px rail − padding): bounded by
    // the available width (never a fixed +rem), so no horizontal scroll at any
    // breakpoint, and a single column on mobile.
    <div
      className={`mx-auto w-full space-y-6 ${
        sectionType === "PARENTS_INCOME" ? "max-w-4xl" : "max-w-3xl"
      }`}
    >
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Section {stepNumber} of {totalSteps}
          {isReassessment && (
            <span className="ml-2 rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-info-700">
              Re-assessment
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">{sectionTitle}</h1>
      </div>

      {/* Pre-populated banner — shown for personal sections copied from last year */}
      {isPrepopulated && <PrepopulatedSectionBanner />}

      {/* The card fills the (already width-capped) wrapper, so its border is the
          section's visible width boundary and the form content lives inside its
          padding — content can never spill past the border. */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SectionForm
          schema={schema as never}
          defaultValues={defaultValues as never}
          onSave={handleSave as never}
          backHref={backHref}
          nextHref={nextHref}
          nextLabel={nextLabel}
          hideInlineNav
        >
          <SectionFormContent
            sectionType={sectionType}
            applicationId={applicationId}
            documentMap={documentMap}
            childFullName={childFullName}
            isSoleParent={isSoleParent}
            academicYear={academicYear}
            parent1EmploymentStatus={parent1EmploymentStatus}
            parent2EmploymentStatus={parent2EmploymentStatus}
            relationshipStatus={relationshipStatus}
            lockedSchool={lockedSchool}
            parent1Address={parent1Address}
          />
        </SectionForm>
      </div>
    </div>
  );
}
