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

// Section form components
import { ChildDetailsForm } from "@/components/portal/sections/child-details-form";
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
import { childDetailsSchema } from "@/lib/schemas/child-details";
import { familyIdSchema } from "@/lib/schemas/family-id";
import { parentDetailsSchema } from "@/lib/schemas/parent-details";
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
  /** Seed for Section 1 defaults — the child's name captured on the Application. */
  applicationChildName?: string;
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
}

interface DefaultValuesSeed {
  applicationSchool?: "TRINITY" | "WHITGIFT";
  applicationChildName?: string;
  isSoleParent?: boolean;
}

function getDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown,
  seed: DefaultValuesSeed = {}
) {
  if (existingData && typeof existingData === "object") {
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
    case "CHILD_DETAILS":
      return {
        school: seed.applicationSchool,
        entryYearGroup: undefined,
        childFullName: seed.applicationChildName ?? "",
        gender: "",
        dateOfBirth: "",
        placeOfBirth: "",
        sameAddressAsParent1: true,
        currentSchool: "",
        currentSchoolStartDate: "",
      };
    case "FAMILY_ID":
      return { familyMembers: [] };
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
        propertyOwnership: undefined, residenceValue: 0, carValue: 0,
        otherPossessionsValue: 0, stocksAndSharesValue: 0, investmentsValue: 0,
        otherAssetsValue: 0, hasOtherProperties: undefined, otherMortgageBalance: 0,
        parent1BankStatementDocumentIds: [], otherProperties: [],
        outstandingMainMortgage: 0, totalOtherMortgages: 0, currentOverdraft: 0,
        hasHirePurchase: undefined, hasLiabilityChanges: undefined, documentsConfirmed: false,
      };
    case "ADDITIONAL_INFO":
      return {
        divorced: { applies: false }, separated: { applies: false },
        sickUnableToWork: { applies: false }, rent: { applies: false },
        madeRedundant: { applies: false }, receivingBenefits: { applies: false },
        additionalNarrative: "", additionalDocumentIds: [],
      };
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
}) {
  switch (sectionType) {
    case "CHILD_DETAILS": return <ChildDetailsForm applicationId={applicationId} documentMap={documentMap} />;
    case "FAMILY_ID": return <FamilyIdForm applicationId={applicationId} documentMap={documentMap} />;
    case "PARENT_DETAILS": return <ParentDetailsForm applicationId={applicationId} documentMap={documentMap} />;
    case "DEPENDENT_CHILDREN": return <DependentChildrenForm childFullName={childFullName} />;
    case "DEPENDENT_ELDERLY": return <DependentElderlyForm applicationId={applicationId} documentMap={documentMap} />;
    case "OTHER_INFO": return <OtherInfoForm applicationId={applicationId} documentMap={documentMap} />;
    case "PARENTS_INCOME": return <ParentsIncomeForm isSoleParent={isSoleParent} applicationId={applicationId} documentMap={documentMap} academicYear={academicYear} parent1EmploymentStatus={parent1EmploymentStatus} parent2EmploymentStatus={parent2EmploymentStatus} relationshipStatus={relationshipStatus} />;
    case "ASSETS_LIABILITIES": return <AssetsLiabilitiesForm isSoleParent={isSoleParent} applicationId={applicationId} documentMap={documentMap} />;
    case "ADDITIONAL_INFO": return <AdditionalInfoForm applicationId={applicationId} documentMap={documentMap} />;
    case "DECLARATION": return <DeclarationForm isSoleParent={isSoleParent} />;
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
  applicationChildName,
  academicYear,
  documentMap,
  childFullName,
  isSoleParent,
  parent1EmploymentStatus,
  parent2EmploymentStatus,
  relationshipStatus,
  backHref,
  nextHref,
  nextLabel,
  stepNumber,
  totalSteps,
  isReassessment = false,
  isPrepopulated = false,
}: SectionPageClientProps) {
  const schema = getSectionSchema(sectionType);
  const defaultValues = getDefaultValues(sectionType, existingData, {
    applicationSchool,
    applicationChildName,
    isSoleParent,
  });

  async function handleSave(data: unknown) {
    const result = await saveSection(applicationId, sectionType, data);
    if (!result.success || sectionType !== "DECLARATION") return result;

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
    <div className="space-y-6">
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SectionForm
          schema={schema as never}
          defaultValues={defaultValues as never}
          onSave={handleSave as never}
          backHref={backHref}
          nextHref={nextHref}
          nextLabel={nextLabel}
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
          />
        </SectionForm>
      </div>
    </div>
  );
}
