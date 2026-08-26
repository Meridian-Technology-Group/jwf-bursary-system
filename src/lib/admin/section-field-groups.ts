/**
 * Subject grouping for the read-only application-section cards — CH-62.
 *
 * > *"Can we have all the property related answers on the APPLICATION FORM
 * > reported within the same section and for each property according to the
 * > same logical display to mirror the order on the form? (currently the data
 * > looks all piled up in an un-orderly way, irrespective of whether it is
 * > car-related, transport-related, accommodation-related, savings-related or
 * > debt-related, so it is confusing)"*
 *
 * Assets & Liabilities is one flat JSONB blob of 46 keys covering five
 * unrelated subjects. This module splits it into her five groups, in her order,
 * with the portal form's own field order inside each — and carries the
 * slot→group map beside it so the field grouping and the per-group document
 * titles cannot drift. `src/lib/documents/slots.ts:40-59` already carried this
 * grouping as comments; this is those comments turned into data.
 *
 * Two rules, both load-bearing:
 *
 *  1. **Nothing is dropped.** A key in no group lands in the trailing
 *     "Other details" bucket. A key silently missing from every group is the
 *     failure mode this whole module exists to prevent, and
 *     `__tests__/section-field-groups.test.ts` fails on it.
 *  2. **Suppression is the dangerous direction.** A field hidden by a wrong
 *     guard is data the assessor never sees. The branch guard fires ONLY on the
 *     two explicit `propertyOwnership` values — an unanswered ownership
 *     question shows everything present.
 *
 * Display-only. Nothing here reads or writes a computed value.
 */

import type { ApplicationSectionType } from "@prisma/client";
import { orderEntries } from "@/lib/admin/section-field-order";

// ─── Group specs ──────────────────────────────────────────────────────────────

export interface SectionFieldGroup {
  /** Stable key — used to attach the group's document titles. */
  key: string;
  /** Heading shown above the group. */
  label: string;
  /** The group's fields, in portal-form order. */
  fields: readonly string[];
  /** Document slots whose titles list under this group. */
  slotPattern: RegExp;
}

/** The trailing bucket for anything no group claims. */
export const UNGROUPED_GROUP_KEY = "other";
export const UNGROUPED_GROUP_LABEL = "Other details";

/**
 * Her group order: property → car & public transport → council tax →
 * financial assets → debt. Field order within each group mirrors the portal
 * form (`src/components/portal/sections/assets-liabilities-form.tsx`).
 *
 * Note the group order is HERS, not the form's — the form asks about council
 * tax between the charging order and the car; she reads it after the car.
 */
const ASSETS_LIABILITIES_GROUPS: readonly SectionFieldGroup[] = [
  {
    key: "property",
    label: "Property",
    fields: [
      "propertyOwnership",
      // OWN branch
      "residenceValue",
      "hasMortgage",
      "mortgageBalance",
      "monthlyMortgageRepayment",
      "mortgageStatementDocumentId",
      // RENT branch
      "rentAgreementType",
      "monthlyRent",
      "tenancyAgreementDocumentId",
      "housingBenefitLetterDocumentId",
      "relativeLetterDocumentId",
      // Q2 — additional properties (each ordered by the `otherProperties` spec)
      "hasOtherProperties",
      "otherProperties",
      // Q3 — charging order
      "hasChargingOrder",
      "chargingOrderAddress",
      "chargingOrderPostcode",
      "chargingOrderValue",
    ],
    // OTHER_PROPERTY_MORTGAGE_{index} is the per-property mortgage statement
    // uploaded from the `otherProperties` repeater. It is not in
    // ALL_DOCUMENT_SLOTS, so it used to fall through to "Other documents" at
    // the very bottom of the page — the opposite of "all the property related
    // answers within the same section".
    slotPattern:
      /^(MAIN_MORTGAGE_STATEMENT|TENANCY_AGREEMENT|HOUSING_BENEFIT_LETTER|RELATIVE_LETTER|OTHER_PROPERTY_MORTGAGE)/,
  },
  {
    key: "car",
    label: "Car & public transport",
    fields: [
      "carOwnership",
      "carValue",
      "carMonthlyLease",
      "carLeaseAgreementDocumentId",
      "usesPublicTransport",
      "publicTransportMonthly",
      // Q7 — home contents / other possessions. The schema groups this with
      // the car ("CAR & HOME CONTENTS") and so does she.
      "otherPossessionsValue",
    ],
    slotPattern: /^CAR_LEASE_AGREEMENT/,
  },
  {
    key: "councilTax",
    label: "Council tax",
    fields: ["councilTaxDocumentId"],
    slotPattern: /^COUNCIL_TAX/,
  },
  {
    key: "financial",
    label: "Financial assets",
    fields: [
      "totalCashBalance",
      "investmentsValue",
      "parent1CurrentAccountDocumentIds",
      "parent1SavingsAccountDocumentIds",
      "parent1OwnsInvestments",
      "parent1InvestmentDocumentIds",
      "parent2CurrentAccountDocumentIds",
      "parent2SavingsAccountDocumentIds",
      "parent2OwnsInvestments",
      "parent2InvestmentDocumentIds",
    ],
    // Household-level, not per-parent: *"No this is not parent specific (only
    // the income section is), the property assets and financial assets are
    // household-related as a whole."* The parent1/parent2 keys are the form's
    // own upload slots, not a household split — do not invent one.
    slotPattern: /^(BANK_STATEMENT_|INVESTMENT_)/,
  },
  {
    key: "debt",
    label: "Debt",
    fields: [
      "hasPersonalDebt",
      "creditCardBalance",
      "creditCardStatementDocumentIds",
      "bankOverdraft",
      "loansToAgencies",
      "loanStatementDocumentIds",
      "loanAgreementDocumentIds",
      "loansToFriendsFamily",
      "schoolFeesOwed",
      "otherDebtDocumentIds",
    ],
    slotPattern:
      /^(CREDIT_CARD_STATEMENT|LOAN_STATEMENT|LOAN_AGREEMENT|OTHER_DEBT_DOCUMENT)/,
  },
];

/** Sections with a subject grouping. Everything else renders as one flat list. */
export const SECTION_FIELD_GROUPS: Partial<
  Record<ApplicationSectionType, readonly SectionFieldGroup[]>
> = {
  ASSETS_LIABILITIES: ASSETS_LIABILITIES_GROUPS,
};

// ─── Branch awareness ─────────────────────────────────────────────────────────

/**
 * *"If the applicant selects renting, he should have no mortgage field,
 * instead the monthly rent field."*
 *
 * The blob can carry stale values from a branch the applicant later switched
 * away from — the same stale-branch class D3/F7 fixed for the document rules.
 * These lists hide the off-branch fields.
 */
const RENT_SUPPRESSES: readonly string[] = [
  "hasMortgage",
  "mortgageBalance",
  "monthlyMortgageRepayment",
];
const OWN_SUPPRESSES: readonly string[] = ["rentAgreementType", "monthlyRent"];

/**
 * Fields to hide for this section's data, given its branch answers.
 *
 * ⚠️ Only ever fires on `"OWN"` or `"RENT"` — never on `undefined`, never on
 * an unrecognised value. An unanswered ownership question must show everything
 * present, because a hidden field is data the assessor never sees.
 */
export function suppressedFields(
  section: ApplicationSectionType,
  data: Record<string, unknown>
): readonly string[] {
  if (section !== "ASSETS_LIABILITIES") return [];
  const ownership = data.propertyOwnership;
  if (ownership === "RENT") return RENT_SUPPRESSES;
  if (ownership === "OWN") return OWN_SUPPRESSES;
  return [];
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export interface SectionFieldGroupResult {
  key: string;
  /**
   * The heading to render, or null when the section has no grouping spec — in
   * which case there is exactly one result and it renders headingless, exactly
   * as before this module existed.
   */
  label: string | null;
  entries: [string, unknown][];
}

/** Key of the single result returned for an ungrouped section. */
export const ALL_FIELDS_KEY = "all";

/**
 * Splits a section's JSONB into its subject groups, in group order, with each
 * group's fields in form order. Empty groups are omitted.
 *
 * A section with no grouping spec comes back as one `label: null` result
 * holding every entry — so callers have a single code path.
 */
export function groupSectionFields(
  section: ApplicationSectionType,
  data: Record<string, unknown>
): SectionFieldGroupResult[] {
  // `data` is TYPED as a record but arrives from JSONB, so guard as DataBlock
  // does (CH-57: `typeof null === "object"`).
  const safeData =
    typeof data === "object" && data !== null
      ? data
      : ({} as Record<string, unknown>);
  const entries = Object.entries(safeData);

  const groups = SECTION_FIELD_GROUPS[section];
  if (!groups) {
    return [{ key: ALL_FIELDS_KEY, label: null, entries }];
  }

  const hidden = suppressedFields(section, safeData);
  const visible = entries.filter(([key]) => hidden.indexOf(key) === -1);

  const results: SectionFieldGroupResult[] = [];
  const claimed: Record<string, true> = {};

  for (const group of groups) {
    const groupEntries = visible.filter(
      ([key]) => group.fields.indexOf(key) !== -1
    );
    for (const [key] of groupEntries) claimed[key] = true;
    if (groupEntries.length === 0) continue;
    results.push({
      key: group.key,
      label: group.label,
      entries: orderEntries(groupEntries, group.fields),
    });
  }

  // Rule 1 — nothing is dropped. Anything no group claimed trails behind, in
  // its original order.
  const leftovers = visible.filter(([key]) => !claimed[key]);
  if (leftovers.length > 0) {
    results.push({
      key: UNGROUPED_GROUP_KEY,
      label: UNGROUPED_GROUP_LABEL,
      entries: leftovers,
    });
  }

  return results;
}

/**
 * The group a document slot's title lists under, or `UNGROUPED_GROUP_KEY` when
 * the section groups its fields but claims no slot of this shape.
 *
 * Returns null when the section has no grouping at all, so the caller keeps
 * listing that section's documents once at the bottom as before.
 */
export function groupForDocumentSlot(
  section: ApplicationSectionType,
  slot: string
): string | null {
  const groups = SECTION_FIELD_GROUPS[section];
  if (!groups) return null;
  for (const group of groups) {
    if (group.slotPattern.test(slot)) return group.key;
  }
  return UNGROUPED_GROUP_KEY;
}

/** Every group key a section renders, in order, including the trailing bucket. */
export function sectionGroupKeys(section: ApplicationSectionType): string[] {
  const groups = SECTION_FIELD_GROUPS[section];
  if (!groups) return [];
  return groups.map((g) => g.key).concat([UNGROUPED_GROUP_KEY]);
}
