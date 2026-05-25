"use client";

/**
 * ContributeSectionClient — client shell for a SECONDARY-parent section.
 *
 * Reuses the existing applicant section forms (ParentDetailsForm,
 * ParentsIncomeForm, AssetsLiabilitiesForm) and their Zod schemas, but:
 *   - Renders them with `isSoleParent` semantics so ONLY the single-earner
 *     ("Parent / Guardian 1") block is shown. The secondary supplies one
 *     earner's worth of data — their own — which lands in the parent1* fields
 *     of the same JSON shape the assessor reads. The assessor (PR 5) maps the
 *     primary's parent1 → PARENT_1 and the secondary's parent1 → PARENT_2.
 *   - Saves via the /contribute server actions (which resolve the SECONDARY
 *     contributor and write owner-scoped rows), NOT the /apply actions.
 *   - Shows the child READ-ONLY, name only.
 *
 * For PARENT_DETAILS the `isSoleParent` form field is force-set to true so the
 * parent-2 block stays hidden and the schema's parent-2 validation is skipped;
 * the secondary never enters a partner's details.
 */

import * as React from "react";
import type { ApplicationSectionType } from "@prisma/client";
import type { DocumentMeta } from "@/lib/db/queries/applications";
import { SectionForm } from "@/components/portal/section-form";

import { ParentDetailsForm } from "@/components/portal/sections/parent-details-form";
import { ParentsIncomeForm } from "@/components/portal/sections/parents-income-form";
import { AssetsLiabilitiesForm } from "@/components/portal/sections/assets-liabilities-form";

import { parentDetailsSchema } from "@/lib/schemas/parent-details";
import { parentsIncomeSchema } from "@/lib/schemas/parents-income";
import { assetsLiabilitiesSchema } from "@/lib/schemas/assets-liabilities";

import { saveSection } from "../actions";

interface ContributeSectionClientProps {
  sectionType: ApplicationSectionType;
  sectionTitle: string;
  applicationId: string;
  childName: string;
  existingData: unknown;
  documentMap?: Record<string, DocumentMeta>;
  backHref: string;
  nextHref: string;
  nextLabel?: string;
  stepNumber: number;
  totalSteps: number;
}

/**
 * Default values for a fresh secondary section. PARENT_DETAILS forces
 * isSoleParent=true so only the single-earner block shows; the income/assets
 * defaults mirror the applicant wizard's parent1-only seed.
 */
function getDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown
) {
  if (existingData && typeof existingData === "object") {
    // Defensive: ensure a previously-saved PARENT_DETAILS row keeps sole-parent
    // semantics even if it was somehow persisted as false.
    if (sectionType === "PARENT_DETAILS") {
      return { ...(existingData as object), isSoleParent: true };
    }
    return existingData;
  }

  switch (sectionType) {
    case "PARENT_DETAILS":
      return {
        isSoleParent: true,
        relationshipStatus: undefined,
        parent1Contact: {
          title: undefined,
          firstName: "",
          lastName: "",
          addressLine1: "",
          city: "",
          postcode: "",
          country: "",
        },
        parent1Employment: { status: undefined },
      };
    case "PARENTS_INCOME":
      return {
        parent1Income: {
          salaryWagesPension: 0,
          supplementsAndBonus: 0,
          otherBenefitsAndCommissions: 0,
          amountFromPartner: 0,
          workingTaxCredits: 0,
          grossInterestReceived: 0,
          allDividendIncome: 0,
          grossRentsReceived: 0,
          allIncomeBonds: 0,
          otherGrossIncomes: 0,
          maintenanceOrEquivalents: 0,
          bursariesOrSponsorships: 0,
          otherIncomeNotIncluded: 0,
          otherIncome: 0,
          hasCapitalRepayments: false,
          documentsConfirmed: false,
        },
      };
    case "ASSETS_LIABILITIES":
      return {
        propertyOwnership: undefined,
        residenceValue: 0,
        carValue: 0,
        otherPossessionsValue: 0,
        stocksAndSharesValue: 0,
        investmentsValue: 0,
        otherAssetsValue: 0,
        hasOtherProperties: undefined,
        otherMortgageBalance: 0,
        parent1BankStatementDocumentIds: [],
        otherProperties: [],
        outstandingMainMortgage: 0,
        totalOtherMortgages: 0,
        currentOverdraft: 0,
        hasHirePurchase: undefined,
        hasLiabilityChanges: undefined,
        documentsConfirmed: false,
      };
    default:
      return {};
  }
}

function getSchema(sectionType: ApplicationSectionType) {
  switch (sectionType) {
    case "PARENT_DETAILS":
      return parentDetailsSchema;
    case "PARENTS_INCOME":
      return parentsIncomeSchema;
    case "ASSETS_LIABILITIES":
      return assetsLiabilitiesSchema;
    default:
      return parentDetailsSchema;
  }
}

function SectionBody({
  sectionType,
  applicationId,
  documentMap,
}: {
  sectionType: ApplicationSectionType;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
}) {
  // isSoleParent forces the single-earner ("Parent / Guardian 1") layout so the
  // secondary only ever supplies their own figures.
  switch (sectionType) {
    case "PARENT_DETAILS":
      return (
        <ParentDetailsForm
          secondaryMode
          applicationId={applicationId}
          documentMap={documentMap}
        />
      );
    case "PARENTS_INCOME":
      return (
        <ParentsIncomeForm
          isSoleParent
          applicationId={applicationId}
          documentMap={documentMap}
        />
      );
    case "ASSETS_LIABILITIES":
      return (
        <AssetsLiabilitiesForm
          isSoleParent
          applicationId={applicationId}
          documentMap={documentMap}
        />
      );
    default:
      return null;
  }
}

export function ContributeSectionClient({
  sectionType,
  sectionTitle,
  applicationId,
  childName,
  existingData,
  documentMap,
  backHref,
  nextHref,
  nextLabel,
  stepNumber,
  totalSteps,
}: ContributeSectionClientProps) {
  const schema = getSchema(sectionType);
  const defaultValues = getDefaultValues(sectionType, existingData);

  async function handleSave(data: unknown) {
    return saveSection(applicationId, sectionType, data);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Step {stepNumber} of {totalSteps}
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          {sectionTitle}
        </h1>
        <p className="mt-2 rounded-md bg-info-50 px-3 py-2 text-sm text-info-700">
          You are providing your own financial details for the bursary
          application for{" "}
          <span className="font-semibold">{childName}</span>. Your information is
          confidential — the other parent cannot see what you enter here.
        </p>
      </div>

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
          <SectionBody
            sectionType={sectionType}
            applicationId={applicationId}
            documentMap={documentMap}
          />
        </SectionForm>
      </div>
    </div>
  );
}
