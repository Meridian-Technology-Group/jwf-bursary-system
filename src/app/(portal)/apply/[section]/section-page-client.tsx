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
import { SectionForm } from "@/components/portal/section-form";
import { ProgressBar } from "@/components/portal/progress-bar";
import { PrepopulatedSectionBanner } from "@/components/portal/form-fields/prepopulated-field";
import { saveSection } from "../actions";

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
  backHref: string;
  nextHref: string;
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

function getDefaultValues(sectionType: ApplicationSectionType, existingData: unknown) {
  if (existingData && typeof existingData === "object") return existingData;

  switch (sectionType) {
    case "CHILD_DETAILS":
      return {
        school: undefined,
        applyingToAnotherSchool: false,
        childFullName: "",
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
}: {
  sectionType: ApplicationSectionType;
  applicationId: string;
}) {
  switch (sectionType) {
    case "CHILD_DETAILS": return <ChildDetailsForm applicationId={applicationId} />;
    case "FAMILY_ID": return <FamilyIdForm />;
    case "PARENT_DETAILS": return <ParentDetailsForm />;
    case "DEPENDENT_CHILDREN": return <DependentChildrenForm />;
    case "DEPENDENT_ELDERLY": return <DependentElderlyForm />;
    case "OTHER_INFO": return <OtherInfoForm />;
    case "PARENTS_INCOME": return <ParentsIncomeForm />;
    case "ASSETS_LIABILITIES": return <AssetsLiabilitiesForm />;
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
  backHref,
  nextHref,
  stepNumber,
  totalSteps,
  isReassessment = false,
  isPrepopulated = false,
}: SectionPageClientProps) {
  const schema = getSectionSchema(sectionType);
  const defaultValues = getDefaultValues(sectionType, existingData);

  async function handleSave(data: unknown) {
    return saveSection(applicationId, sectionType, data);
  }

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

      <ProgressBar completedSections={stepNumber - 1} totalSections={totalSteps} />

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
        >
          <SectionFormContent sectionType={sectionType} applicationId={applicationId} />
        </SectionForm>
      </div>
    </div>
  );
}
