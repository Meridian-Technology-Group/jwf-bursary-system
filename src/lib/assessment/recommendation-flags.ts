/**
 * The recommendation flags (Charlotte, 17 Oct 2026): her six, in her order,
 * and a seventh, High Frugality (21 Oct 2026).
 *
 * Six are ticked by the assessor and stored on the Recommendation. "Large
 * family" is a fact, not a judgement: it reads the family type, where category
 * 5 is "Parents, 4 children" and 6 "Parents, 5+ children" ("4 or higher").
 */

export interface StoredRecommendationFlags {
  dishonestyFlag: boolean;
  creditRiskFlag: boolean;
  inconsistencyFlag: boolean;
  pastoralFlag: boolean;
  acuteCrisisFlag: boolean;
  highFrugalityFlag: boolean;
}

export type StoredFlagKey = keyof StoredRecommendationFlags;

export const NO_FLAGS: StoredRecommendationFlags = {
  dishonestyFlag: false,
  creditRiskFlag: false,
  inconsistencyFlag: false,
  pastoralFlag: false,
  acuteCrisisFlag: false,
  highFrugalityFlag: false,
};

/** Family type category from which the household counts as a large family. */
export const LARGE_FAMILY_MIN_CATEGORY = 5;

export function isLargeFamily(familyTypeCategory: number | null | undefined): boolean {
  return familyTypeCategory != null && familyTypeCategory >= LARGE_FAMILY_MIN_CATEGORY;
}

type FlagEntry =
  | { key: StoredFlagKey; label: string; derived?: false }
  | { key: "largeFamily"; label: string; derived: true };

/**
 * Her order: 1 Dishonesty, 2 Credit Risk, 3 Large family, 4 Inconsistency,
 * 5 Pastoral, 6 Acute Crisis, 7 High Frugality.
 */
export const RECOMMENDATION_FLAGS: readonly FlagEntry[] = [
  { key: "dishonestyFlag", label: "Dishonesty" },
  { key: "creditRiskFlag", label: "Credit Risk" },
  { key: "largeFamily", label: "Large family", derived: true },
  { key: "inconsistencyFlag", label: "Inconsistency" },
  { key: "pastoralFlag", label: "Pastoral" },
  { key: "acuteCrisisFlag", label: "Acute Crisis" },
  { key: "highFrugalityFlag", label: "High Frugality" },
];

/** The raised flags' labels, in her order (export "Flags" column). */
export function raisedFlagLabels(
  flags: Partial<StoredRecommendationFlags> | null | undefined,
  familyTypeCategory: number | null | undefined
): string[] {
  return RECOMMENDATION_FLAGS.filter((f) =>
    f.key === "largeFamily" ? isLargeFamily(familyTypeCategory) : Boolean(flags?.[f.key])
  ).map((f) => f.label);
}
