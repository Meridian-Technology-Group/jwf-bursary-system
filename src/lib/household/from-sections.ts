/**
 * Map the persisted form JSONB (PARENT_DETAILS + OTHER_INFO section data) plus
 * the application's custody arrangement into a HouseholdInput, then derive the
 * scenario. PURE — takes already-loaded blobs, no DB. Used by:
 *   - the assessor decision-aid panel (reads the PRIMARY's submitted data), and
 *   - the parent form's branch logic (reads the live draft).
 *
 * Back-compat: every field is read defensively. Old drafts (pre-Epic 09) carry
 * no `isGuardian` / `custodyArrangement` / `financesNotDisentangled` /
 * `isRemarriedSoleParent`, so they map to the SOLE / two-parent defaults exactly
 * as before — the engine degrades to the H1/H3/H5/H6 rows that were already
 * implied by relationship + sole-parent toggle.
 */

import {
  deriveHouseholdScenario,
  type CustodyArrangement,
  type HouseholdHandling,
  type HouseholdInput,
  type RelationshipStatus,
} from "./rules";

/** Loosely-typed view of the PARENT_DETAILS JSONB blob. */
export interface ParentDetailsBlob {
  relationshipStatus?: string;
  isSoleParent?: boolean;
  /** D16 guardianship facet (Epic 09). */
  isGuardian?: boolean;
  /** D15 custody split (Epic 09) — may also live on the Application column. */
  custodyArrangement?: string;
  /** D17 remarried-sole-parent facet (Epic 09). */
  isRemarriedSoleParent?: boolean;
  /** H9 finances-in-flux facet (Epic 09). */
  financesNotDisentangled?: boolean;
  /**
   * H7 discriminator mirrored onto parent-details so the in-form notice can
   * render on that step. The authoritative store is OTHER_INFO.hasCOurtOrder;
   * this is the fallback/mirror.
   */
  hasSchoolFeesCourtOrder?: boolean;
}

/** Loosely-typed view of the OTHER_INFO JSONB blob (Epic 02). */
export interface OtherInfoBlob {
  /** "Do you have a court order for the payment of school fees?" */
  hasCOurtOrder?: boolean;
}

const RELATIONSHIP_VALUES: RelationshipStatus[] = [
  "SINGLE",
  "MARRIED",
  "WIDOWED",
  "SEPARATED",
  "DIVORCED",
  "CIVIL_PARTNERSHIP",
  "COHABITING",
];

const CUSTODY_VALUES: CustodyArrangement[] = [
  "SOLE",
  "SHARED_5050",
  "SHARED_MAIN_LIMITED",
];

function asRelationship(v: unknown): RelationshipStatus {
  return RELATIONSHIP_VALUES.includes(v as RelationshipStatus)
    ? (v as RelationshipStatus)
    : "SINGLE";
}

function asCustody(v: unknown): CustodyArrangement {
  return CUSTODY_VALUES.includes(v as CustodyArrangement)
    ? (v as CustodyArrangement)
    : "SOLE";
}

export interface HouseholdSources {
  parentDetails?: ParentDetailsBlob | null;
  otherInfo?: OtherInfoBlob | null;
  /**
   * Custody arrangement persisted on the Application column (D15). Takes
   * precedence over the form blob when present (the column is the authoritative
   * store; the form value is the input that set it).
   */
  applicationCustodyArrangement?: string | null;
}

/** Build the rules-engine input from the persisted/draft sources. */
export function householdInputFromSources(
  sources: HouseholdSources
): HouseholdInput {
  const pd = sources.parentDetails ?? {};
  const oi = sources.otherInfo ?? {};

  const custody = asCustody(
    sources.applicationCustodyArrangement ?? pd.custodyArrangement
  );

  return {
    relationshipStatus: asRelationship(pd.relationshipStatus),
    isSoleParent: pd.isSoleParent === true,
    isGuardian: pd.isGuardian === true,
    // Either store satisfies the H7 discriminator: OTHER_INFO is authoritative,
    // the parent-details mirror lets the in-form notice render on that step.
    hasSchoolFeesCourtOrder:
      oi.hasCOurtOrder === true || pd.hasSchoolFeesCourtOrder === true,
    custodyArrangement: custody,
    isRemarriedSoleParent: pd.isRemarriedSoleParent === true,
    financesNotDisentangled: pd.financesNotDisentangled === true,
  };
}

/** Convenience: sources → handling, in one call. */
export function deriveHouseholdFromSources(
  sources: HouseholdSources
): HouseholdHandling {
  return deriveHouseholdScenario(householdInputFromSources(sources));
}
