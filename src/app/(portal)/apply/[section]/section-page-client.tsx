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
  /** Map of document ID → metadata for showing previously uploaded files. */
  documentMap?: Record<string, DocumentMeta>;
  /** Child's full name from CHILD_DETAILS (for DEPENDENT_CHILDREN section). */
  childFullName?: string;
  /** isSoleParent flag from PARENT_DETAILS (for PARENTS_INCOME section). */
  isSoleParent?: boolean;
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
}

function getDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown,
  seed: DefaultValuesSeed = {}
) {
  if (existingData && typeof existingData === "object") return existingData;

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
      return {
        parent1Income: {
          salaryWagesPension: 0, supplementsAndBonus: 0, otherBenefitsAndCommissions: 0,
          amountFromPartner: 0, workingTaxCredits: 0, grossInterestReceived: 0,
          allDividendIncome: 0, grossRentsReceived: 0, allIncomeBonds: 0,
          otherGrossIncomes: 0, maintenanceOrEquivalents: 0, bursariesOrSponsorships: 0,
          otherIncomeNotIncluded: 0, otherIncome: 0,
          hasCapitalRepayments: false, documentsConfirmed: false,
        },
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
      return { accepted: false, signedOnBehalfOf: "" };
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
}: {
  sectionType: ApplicationSectionType;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  childFullName?: string;
  isSoleParent?: boolean;
}) {
  switch (sectionType) {
    case "CHILD_DETAILS": return <ChildDetailsForm applicationId={applicationId} documentMap={documentMap} />;
    case "FAMILY_ID": return <FamilyIdForm applicationId={applicationId} documentMap={documentMap} />;
    case "PARENT_DETAILS": return <ParentDetailsForm applicationId={applicationId} documentMap={documentMap} />;
    case "DEPENDENT_CHILDREN": return <DependentChildrenForm childFullName={childFullName} />;
    case "DEPENDENT_ELDERLY": return <DependentElderlyForm />;
    case "OTHER_INFO": return <OtherInfoForm />;
    case "PARENTS_INCOME": return <ParentsIncomeForm isSoleParent={isSoleParent} applicationId={applicationId} documentMap={documentMap} />;
    case "ASSETS_LIABILITIES": return <AssetsLiabilitiesForm isSoleParent={isSoleParent} applicationId={applicationId} documentMap={documentMap} />;
    case "ADDITIONAL_INFO": return <AdditionalInfoForm />;
    case "DECLARATION": return <DeclarationForm />;
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
  documentMap,
  childFullName,
  isSoleParent,
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
          />
        </SectionForm>
      </div>
    </div>
  );
}
