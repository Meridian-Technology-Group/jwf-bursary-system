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

import { secondaryParentDetailsSchema } from "@/lib/schemas/parent-details";
import { parentsIncomeSchema } from "@/lib/schemas/parents-income";
import { assetsLiabilitiesSchema } from "@/lib/schemas/assets-liabilities";
import { getContributeSectionDefaultValues } from "@/lib/portal/contribute-section-defaults";

import { saveSection, saveSectionDraft } from "../actions";

interface ContributeSectionClientProps {
  sectionType: ApplicationSectionType;
  sectionTitle: string;
  applicationId: string;
  childName: string;
  existingData: unknown;
  documentMap?: Record<string, DocumentMeta>;
  /** Round academic year — drives the dynamic tax-year wording (D5). */
  academicYear?: string | null;
  /** The secondary's own declared employment status — drives the income sub-tables. */
  employmentStatus?: string;
  /** Household relationship status — drives the divorced/separated sub-table. */
  relationshipStatus?: string;
  backHref: string;
  nextHref: string;
  nextLabel?: string;
  stepNumber: number;
  totalSteps: number;
}

function getSchema(sectionType: ApplicationSectionType) {
  switch (sectionType) {
    case "PARENT_DETAILS":
      return secondaryParentDetailsSchema;
    case "PARENTS_INCOME":
      return parentsIncomeSchema;
    case "ASSETS_LIABILITIES":
      return assetsLiabilitiesSchema;
    default:
      return secondaryParentDetailsSchema;
  }
}

function SectionBody({
  sectionType,
  applicationId,
  documentMap,
  academicYear,
  employmentStatus,
  relationshipStatus,
}: {
  sectionType: ApplicationSectionType;
  applicationId: string;
  documentMap?: Record<string, DocumentMeta>;
  academicYear?: string | null;
  employmentStatus?: string;
  relationshipStatus?: string;
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
          academicYear={academicYear}
          parent1EmploymentStatus={employmentStatus}
          relationshipStatus={relationshipStatus}
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
  academicYear,
  employmentStatus,
  relationshipStatus,
  backHref,
  nextHref,
  nextLabel,
  stepNumber,
  totalSteps,
}: ContributeSectionClientProps) {
  const schema = getSchema(sectionType);
  const defaultValues = getContributeSectionDefaultValues(sectionType, existingData);

  async function handleSave(data: unknown) {
    return saveSection(applicationId, sectionType, data);
  }

  /**
   * The in-place save path (WP B1's guard, and WP B2's autosave). The second
   * parent hits the same data loss as the lead applicant — the same three
   * sections, the same long income tables — so the contribute flow gets the
   * same treatment: a section that validates saves complete, one that does not
   * is written as a draft rather than discarded.
   *
   * This also enrols /contribute in the WP B2 autosave: `SectionForm` debounces
   * against whatever `onSaveWithoutAdvancing` it is given, and the contribute
   * `saveSectionDraft` (contribute/actions.ts) is the secondary-scoped twin of
   * the portal one. No CR-001 provenance is involved on this side — the
   * assessor edit-on-behalf flow only writes the primary's rows.
   */
  async function handleGuardedSave(data: unknown, complete: boolean) {
    return complete
      ? saveSection(applicationId, sectionType, data)
      : saveSectionDraft(applicationId, sectionType, data);
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
          onSaveWithoutAdvancing={handleGuardedSave as never}
          backHref={backHref}
          nextHref={nextHref}
          nextLabel={nextLabel}
        >
          <SectionBody
            sectionType={sectionType}
            applicationId={applicationId}
            documentMap={documentMap}
            academicYear={academicYear}
            employmentStatus={employmentStatus}
            relationshipStatus={relationshipStatus}
          />
        </SectionForm>
      </div>
    </div>
  );
}
