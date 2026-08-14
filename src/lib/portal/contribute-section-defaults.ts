/**
 * Default (empty) form values for the SECONDARY-parent contribute flow.
 *
 * F5. The contribute flow renders the SAME section forms as the applicant wizard
 * (in `secondaryMode`) against the SAME `parentDetailsObject` shape, but it has
 * its own defaults path — so it can carry, and did carry, its own copy of the
 * defect class documented in `section-defaults.ts`:
 *
 *   - `parent1Contact.email` was missing here. `parentContactSchema` makes email
 *     mandatory, so the secondary parent saw the raw
 *     "Invalid input: expected string, received undefined" with no field named —
 *     the same sentence that blocked Charlotte on the applicant side (CF-17).
 *
 * The secondary NEVER supplies a partner, so no Parent 2 block is seeded: the
 * flow forces `isSoleParent: true` and validates with
 * `secondaryParentDetailsSchema`, which keys Parent 2 off the sole-parent flag
 * alone and therefore never requires it.
 */

import type { ApplicationSectionType } from "@prisma/client";

import {
  isLegacyIncomeRecord,
  normaliseLegacyIncomeRecord,
} from "@/lib/portal/income-model";
import { emptyIncomeRecord } from "@/lib/portal/section-defaults";

/** The secondary's own contact block, with every required string seeded. */
function emptySecondaryContact() {
  return {
    title: undefined,
    firstName: "",
    lastName: "",
    // Mandatory on `parentContactSchema` — omitting it is what produced the raw
    // Zod type error on this path.
    email: "",
    addressLine1: "",
    city: "",
    postcode: "",
    country: "",
  };
}

export function getContributeSectionDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown
) {
  if (existingData && typeof existingData === "object") {
    // Defensive: ensure a previously-saved PARENT_DETAILS row keeps sole-parent
    // semantics even if it was somehow persisted as false.
    if (sectionType === "PARENT_DETAILS") {
      return { ...(existingData as object), isSoleParent: true };
    }
    // Back-compat: normalise a legacy flat income draft into the new shape.
    if (sectionType === "PARENTS_INCOME") {
      const d = existingData as { parent1Income?: unknown };
      return {
        parent1Income: isLegacyIncomeRecord(d.parent1Income)
          ? normaliseLegacyIncomeRecord(d.parent1Income)
          : (d.parent1Income ?? emptyIncomeRecord()),
      };
    }
    return existingData;
  }

  switch (sectionType) {
    case "PARENT_DETAILS":
      return {
        isSoleParent: true,
        relationshipStatus: undefined,
        parent1Contact: emptySecondaryContact(),
        parent1Employment: { status: undefined },
      };
    case "PARENTS_INCOME":
      return { parent1Income: emptyIncomeRecord() };
    case "ASSETS_LIABILITIES":
      return {
        propertyOwnership: undefined,
        residenceValue: 0,
        hasMortgage: undefined,
        hasOtherProperties: undefined,
        otherProperties: [],
        hasChargingOrder: undefined,
        carOwnership: undefined,
        usesPublicTransport: undefined,
        otherPossessionsValue: 0,
        totalCashBalance: 0,
        investmentsValue: 0,
        parent1CurrentAccountDocumentIds: [],
        parent1SavingsAccountDocumentIds: [],
        parent1InvestmentDocumentIds: [],
        hasPersonalDebt: undefined,
        creditCardStatementDocumentIds: [],
        loanStatementDocumentIds: [],
        // D3 (CF-30): the compulsory loan agreement's upload slot.
        loanAgreementDocumentIds: [],
        otherDebtDocumentIds: [],
        documentsConfirmed: false,
      };
    default:
      return {};
  }
}

/** The sections the contribute flow actually renders. */
export const CONTRIBUTE_SECTIONS = [
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
] as const satisfies readonly ApplicationSectionType[];
