/**
 * "Accommodation" in the recommendations export (Charlotte, 17 Oct 2026):
 * "fill it in from own/rent form question or derived from the assessment page".
 *
 * The family's own answer wins (Assets & liabilities: own or rent, and the rent
 * arrangement). With no form — a migrated Grant Tracker record — it falls back
 * to the assessment's property structure, and its rent-free add-back.
 */

const RENT_ARRANGEMENT_LABELS: Record<string, string> = {
  PRIVATE: "Rents (private)",
  COUNCIL: "Rents (council)",
  COUNCIL_NO_RENT: "Council, no rent",
  RELATIVES: "Lives with relatives",
};

export interface AccommodationSource {
  /** ASSETS_LIABILITIES `propertyOwnership`: "OWN" | "RENT". */
  formOwnership?: unknown;
  /** ASSETS_LIABILITIES `rentAgreementType`. */
  formRentAgreement?: unknown;
  /** Assessment property structure (`propertyAssets.portfolioType`). */
  portfolioType?: unknown;
  /** `Assessment.rentAddBackType`. */
  rentAddBackType?: string | null;
}

export function accommodationLabel(src: AccommodationSource): string {
  if (src.formOwnership === "OWN") return "Owns home";
  if (src.formOwnership === "RENT") {
    return (typeof src.formRentAgreement === "string" && RENT_ARRANGEMENT_LABELS[src.formRentAgreement]) || "Rents";
  }
  // The assessor's rent add-back says how the family actually lives, so it
  // wins over the property structure (a family can own a property and live
  // rent-free elsewhere).
  if (src.rentAddBackType === "FULL_RENT_FREE") return "Rent-free";
  if (src.portfolioType === "RENTING") return "Rents";
  if (src.portfolioType === "SINGLE" || src.portfolioType === "DOUBLE" || src.portfolioType === "MULTIPLE") {
    return src.rentAddBackType === "FULL_MORTGAGE_FREE" ? "Owns home (mortgage-free)" : "Owns home";
  }
  return "";
}
