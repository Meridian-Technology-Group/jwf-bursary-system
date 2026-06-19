/**
 * Household rules engine — Epic 09.
 *
 * The SINGLE SOURCE OF TRUTH for the "How to Apply" FAQ household scenarios.
 * Given the relationship status + a handful of discriminators captured on the
 * form, `deriveHouseholdScenario` returns the encoded *handling* from the
 * scenario matrix in plan 09 §3.1 (rows H1–H11):
 *
 *   - who is assessed         (assessees)
 *   - who is the lead         (leadRule)
 *   - what evidence to ask    (requiredEvidence)
 *   - any policy gate         (gate: cannot-support / may-defer)
 *
 * This module is PURE — no DB, no side-effects, no React. Both the parent form
 * (branch logic / reveal control / H7 notice) and the assessor decision-aid
 * panel import it, so the rules can never drift between the two surfaces.
 *
 * **Build-to-default policy (D15–D17 + the standing rule).** The §3.1 rows are
 * FAQ prose not yet codified anywhere; they are encoded here to the workbook
 * defaults and confirmed against the workbook FAQ. Per the standing rule, the
 * two policy gates — **H7 (divorced WITH a school-fees court order → cannot
 * support)** and **H9 (mid-divorce, finances not disentangled → may defer)** —
 * are surfaced to the assessor as FLAGS only. This module NEVER auto-declines:
 * `gate` is advisory; the assessor remains the decision-maker (final outcome
 * terminology is Epic 08).
 */

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Relationship statuses captured on the parent-details form
 * (`relationshipStatusSchema`). FOSTER_GUARDIAN is NOT a relationship value —
 * guardianship is captured via the `isGuardian` facet (D16) so it composes with
 * any relationship status.
 */
export type RelationshipStatus =
  | "SINGLE"
  | "MARRIED"
  | "WIDOWED"
  | "SEPARATED"
  | "DIVORCED"
  | "CIVIL_PARTNERSHIP"
  | "COHABITING";

/**
 * Shared-custody split (D15). SOLE is the default; the two SHARED_* values are
 * only meaningful when the child's care is split across two natural parents.
 * Mirrors the Prisma `CustodyArrangement` enum.
 */
export type CustodyArrangement = "SOLE" | "SHARED_5050" | "SHARED_MAIN_LIMITED";

export interface HouseholdInput {
  /** Parent-details relationship status. */
  relationshipStatus: RelationshipStatus;
  /** The sole-parent toggle ("Are you applying as a sole parent / guardian?"). */
  isSoleParent: boolean;
  /**
   * "Is there a court order specifically for school fees?" (other-info
   * `hasCOurtOrder`). The H7 cannot-support disqualifier hinges on this being
   * true AND the applicant being divorced — NOT any court order.
   */
  hasSchoolFeesCourtOrder?: boolean;
  /** Custody split (D15). Defaults to SOLE when not captured. */
  custodyArrangement?: CustodyArrangement;
  /**
   * Guardianship facet (D16) — "applying as a foster carer / legal guardian?".
   * Composes with the relationship status; triggers the guardianship-evidence
   * ask and forces the sole-parent (guardian-only) handling.
   */
  isGuardian?: boolean;
  /**
   * Remarried sole parent (H8). When a previously-sole parent has remarried,
   * the resident household is R + new spouse and the absent natural parent's
   * contribution is captured via maintenance. Captured as a facet so it
   * composes with the MARRIED/CIVIL_PARTNERSHIP/COHABITING status without
   * needing a third contributor (D17). Optional — defaults false.
   */
  isRemarriedSoleParent?: boolean;
  /**
   * Mid-divorce, finances not yet disentangled (H9). A self-declared facet on
   * the SEPARATED/DIVORCED branch; surfaces the may-defer flag. Optional.
   */
  financesNotDisentangled?: boolean;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

/** The scenario row identifier (matches plan 09 §3.1). */
export type HouseholdScenarioCode =
  | "H1" // Single
  | "H2" // Long-separated
  | "H3" // Widowed
  | "H4" // Foster / guardian
  | "H5" // Separated (not divorced)
  | "H6" // Divorced, NO school-fees court order
  | "H7" // Divorced, WITH school-fees court order (cannot support)
  | "H8" // Remarried sole parent (three incomes)
  | "H9" // Mid-divorce, finances not disentangled (may defer)
  | "H10" // Shared custody 50/50 (dual lead)
  | "H11"; // Shared custody main + limited

/**
 * The four handling *shapes* §3.1 collapses to.
 *   SOLE                  — one resident parent/guardian; no P/G2 income.
 *   TWO_PARENT            — both natural parents assessed; resident leads.
 *   HOUSEHOLD_PLUS_ABSENT — resident household (R + spouse) + absent natural
 *                           parent via maintenance (H8, D17 — reuses two-earner).
 */
export type AssesseeShape = "SOLE" | "TWO_PARENT" | "HOUSEHOLD_PLUS_ABSENT";

/** Who is the lead/account-holding applicant. */
export type LeadRule =
  | "RESIDENT" // the single resident parent/guardian
  | "MAIN_CUSTODY" // the main-custody parent (shared, main+limited)
  | "BOTH"; // 50/50 — both are lead applicants (either may hold the account)

/**
 * Policy gate. NONE = ordinary handling. The two non-NONE values are
 * ASSESSOR-SURFACED FLAGS, never auto-outcomes (standing rule).
 */
export type HouseholdGate = "NONE" | "CANNOT_SUPPORT" | "MAY_DEFER";

/**
 * The discrete evidence asks a scenario triggers (beyond the standard set).
 * These map onto existing Document slots / Epic 02 form fields — this module
 * names *which* are required; the form/rule-engine wires the uploads.
 */
export type HouseholdEvidence =
  | "DEATH_CERTIFICATE" // H3 widowed
  | "GUARDIANSHIP_EVIDENCE" // H4 foster / guardian (D16)
  | "DECREE_ABSOLUTE" // H6 divorced
  | "MUTUAL_MAINTENANCE_AGREEMENT" // H5 separated
  | "MAINTENANCE_EVIDENCE" // H5/H6/H8 maintenance received
  | "SECOND_PARENT_INCOME" // H5/H6/H10/H11 NR supplies own income
  | "ESTRANGEMENT_NOTE" // H2 long-separated
  | "CUSTODY_SPLIT_STATEMENT"; // H10/H11 custody split stated

export interface HouseholdHandling {
  scenario: HouseholdScenarioCode;
  /** Short human label for the scenario (assessor aid + form copy). */
  label: string;
  assessees: AssesseeShape;
  leadRule: LeadRule;
  requiredEvidence: HouseholdEvidence[];
  gate: HouseholdGate;
  /**
   * Whether the resident household has a second contributing party (P/G2 in the
   * form, Parent 2 in the assessment). TWO_PARENT and HOUSEHOLD_PLUS_ABSENT are
   * true; SOLE is false. Drives the form's "open the P/G2 block" decision.
   */
  needsSecondParent: boolean;
  /** One-line assessor-facing summary of the expected handling (§3.3). */
  assessorNote: string;
}

// ─── Derivation ────────────────────────────────────────────────────────────────

const LABELS: Record<HouseholdScenarioCode, string> = {
  H1: "Single parent",
  H2: "Long-separated parent",
  H3: "Widowed parent",
  H4: "Foster carer / legal guardian",
  H5: "Separated (not divorced)",
  H6: "Divorced — no school-fees court order",
  H7: "Divorced — school-fees court order present",
  H8: "Remarried sole parent",
  H9: "Mid-divorce — finances not disentangled",
  H10: "Shared custody — 50/50",
  H11: "Shared custody — main + limited",
};

/**
 * Derive the household scenario + its encoded handling from the captured
 * inputs. Deterministic and total — every input combination resolves to exactly
 * one row. Precedence is deliberate (see inline notes); the order encodes the
 * FAQ's own priority (e.g. a school-fees court order on a divorced case is the
 * disqualifier regardless of any other facet).
 */
export function deriveHouseholdScenario(
  input: HouseholdInput
): HouseholdHandling {
  const {
    relationshipStatus,
    isSoleParent,
    hasSchoolFeesCourtOrder = false,
    custodyArrangement = "SOLE",
    isGuardian = false,
    isRemarriedSoleParent = false,
    financesNotDisentangled = false,
  } = input;

  const build = (
    scenario: HouseholdScenarioCode,
    handling: Omit<HouseholdHandling, "scenario" | "label">
  ): HouseholdHandling => ({
    scenario,
    label: LABELS[scenario],
    ...handling,
  });

  // ── H4 — Foster / guardian (D16) ──────────────────────────────────────────
  // Highest precedence: a guardian relationship overrides the relationship
  // status entirely (a guardian may also be widowed/single — guardianship is
  // the controlling fact). Sole-parent (guardian-only) handling + mandatory
  // guardianship evidence.
  if (isGuardian) {
    return build("H4", {
      assessees: "SOLE",
      leadRule: "RESIDENT",
      requiredEvidence: ["GUARDIANSHIP_EVIDENCE"],
      gate: "NONE",
      needsSecondParent: false,
      assessorNote:
        "Foster carer / legal guardian — assess the guardian(s) only; require evidence of guardianship / foster status.",
    });
  }

  // ── H10 / H11 — Shared custody (D15) ──────────────────────────────────────
  // A shared-custody split implies BOTH natural parents are assessed regardless
  // of the marital label. Checked before the marital branches so the custody
  // arrangement, when set, is authoritative for the lead designation.
  if (custodyArrangement === "SHARED_5050") {
    return build("H10", {
      assessees: "TWO_PARENT",
      leadRule: "BOTH",
      requiredEvidence: ["SECOND_PARENT_INCOME", "CUSTODY_SPLIT_STATEMENT"],
      gate: "NONE",
      needsSecondParent: true,
      assessorNote:
        "50/50 shared custody — both natural parents are lead applicants (either may hold the account); assess both incomes.",
    });
  }
  if (custodyArrangement === "SHARED_MAIN_LIMITED") {
    return build("H11", {
      assessees: "TWO_PARENT",
      leadRule: "MAIN_CUSTODY",
      requiredEvidence: ["SECOND_PARENT_INCOME", "CUSTODY_SPLIT_STATEMENT"],
      gate: "NONE",
      needsSecondParent: true,
      assessorNote:
        "Shared custody (main + limited) — the main-custody parent is the lead; assess both natural parents' incomes.",
    });
  }

  // ── H7 — Divorced WITH a school-fees court order (CANNOT SUPPORT) ──────────
  // Hinges strictly on DIVORCED + a court order SPECIFICALLY for school fees.
  // Checked before H6/H8 because the order is the disqualifier irrespective of
  // remarriage or other facts. Surfaced as a flag — NEVER auto-declined.
  if (relationshipStatus === "DIVORCED" && hasSchoolFeesCourtOrder) {
    return build("H7", {
      assessees: "TWO_PARENT",
      leadRule: "RESIDENT",
      requiredEvidence: ["DECREE_ABSOLUTE", "SECOND_PARENT_INCOME"],
      gate: "CANNOT_SUPPORT",
      needsSecondParent: true,
      assessorNote:
        "A school-fees court order is present — the fees are already a legal liability, so a discretionary bursary likely cannot be supported. Assessor decision (not automatic).",
    });
  }

  // ── H9 — Mid-divorce, finances not disentangled (MAY DEFER) ───────────────
  // Applies to SEPARATED/DIVORCED where the family flags finances are still in
  // flux. As-separated handling, but flagged unstable. Surfaced as a flag.
  if (
    (relationshipStatus === "SEPARATED" || relationshipStatus === "DIVORCED") &&
    financesNotDisentangled
  ) {
    return build("H9", {
      assessees: "TWO_PARENT",
      leadRule: "RESIDENT",
      requiredEvidence: ["SECOND_PARENT_INCOME", "MAINTENANCE_EVIDENCE"],
      gate: "MAY_DEFER",
      needsSecondParent: true,
      assessorNote:
        "Finances not yet disentangled — the household's income/assets are in flux. The Foundation may decline or defer pending stable figures. Assessor decision.",
    });
  }

  // ── H8 — Remarried sole parent (three incomes → two-earner + maintenance) ──
  // D17: key R + new spouse as the two-earner household; capture the absent
  // natural parent via maintenance fields. No third contributor role.
  if (isRemarriedSoleParent) {
    return build("H8", {
      assessees: "HOUSEHOLD_PLUS_ABSENT",
      leadRule: "RESIDENT",
      requiredEvidence: ["MAINTENANCE_EVIDENCE"],
      gate: "NONE",
      needsSecondParent: true,
      assessorNote:
        "Remarried sole parent — assess the resident household (parent + new spouse) as the two earners, and capture the absent natural parent's contribution via the maintenance fields. No third income column (D17).",
    });
  }

  // ── H2 — Long-separated (sole-parent path) ────────────────────────────────
  // A separated parent who ticks the sole-parent toggle has no reachable second
  // parent to invite (no contact, no maintenance). Checked BEFORE H5 so the
  // sole-parent toggle wins: H5 is the *not-sole* separated case where the
  // non-resident parent is reachable and supplies their own income.
  if (relationshipStatus === "SEPARATED" && isSoleParent) {
    return build("H2", {
      assessees: "SOLE",
      leadRule: "RESIDENT",
      requiredEvidence: ["ESTRANGEMENT_NOTE"],
      gate: "NONE",
      needsSecondParent: false,
      assessorNote:
        "Long-separated, no contact — assess the one resident parent; a brief note of estrangement may be requested. Confirm there is genuinely no reachable second parent.",
    });
  }

  // ── H5 — Separated (not divorced) ─────────────────────────────────────────
  if (relationshipStatus === "SEPARATED") {
    return build("H5", {
      assessees: "TWO_PARENT",
      leadRule: "RESIDENT",
      requiredEvidence: [
        "SECOND_PARENT_INCOME",
        "MUTUAL_MAINTENANCE_AGREEMENT",
        "MAINTENANCE_EVIDENCE",
      ],
      gate: "NONE",
      needsSecondParent: true,
      assessorNote:
        "Separated (not divorced) — assess both natural parents; the resident parent leads and the non-resident parent supplies their own income. Confirm the mutual maintenance agreement.",
    });
  }

  // ── H6 — Divorced WITHOUT a school-fees court order (treat as separated) ───
  if (relationshipStatus === "DIVORCED") {
    return build("H6", {
      assessees: "TWO_PARENT",
      leadRule: "RESIDENT",
      requiredEvidence: [
        "SECOND_PARENT_INCOME",
        "DECREE_ABSOLUTE",
        "MAINTENANCE_EVIDENCE",
      ],
      gate: "NONE",
      needsSecondParent: true,
      assessorNote:
        "Divorced, no school-fees court order — assess as separated: both parents' income, resident parent leads. Require the decree absolute.",
    });
  }

  // ── H3 — Widowed ──────────────────────────────────────────────────────────
  if (relationshipStatus === "WIDOWED") {
    return build("H3", {
      assessees: "SOLE",
      leadRule: "RESIDENT",
      requiredEvidence: ["DEATH_CERTIFICATE"],
      gate: "NONE",
      needsSecondParent: false,
      assessorNote:
        "Widowed — assess the surviving parent only; require the death certificate of the deceased parent.",
    });
  }

  // ── H1 — Single / never-partnered (default sole-parent path) ──────────────
  if (isSoleParent) {
    return build("H1", {
      assessees: "SOLE",
      leadRule: "RESIDENT",
      requiredEvidence: [],
      gate: "NONE",
      needsSecondParent: false,
      assessorNote:
        "Single / sole parent — assess the one resident parent; no second-parent income.",
    });
  }

  // ── Two-resident-parent households (MARRIED / CIVIL_PARTNERSHIP /
  //    COHABITING / SINGLE-but-not-sole) → standard two-earner household.
  // Both partners live in the household and contribute; the resident leads.
  return build("H1", {
    assessees: "TWO_PARENT",
    leadRule: "RESIDENT",
    requiredEvidence: [],
    gate: "NONE",
    needsSecondParent: true,
    assessorNote:
      "Two-parent resident household — assess both partners' income as the household; the lead applicant holds the account.",
  });
}

/**
 * Human-readable label for an evidence ask (assessor aid + form copy).
 */
export const EVIDENCE_LABELS: Record<HouseholdEvidence, string> = {
  DEATH_CERTIFICATE: "Death certificate of the deceased parent",
  GUARDIANSHIP_EVIDENCE: "Evidence of guardianship / foster status",
  DECREE_ABSOLUTE: "Decree absolute",
  MUTUAL_MAINTENANCE_AGREEMENT: "Confirmation of the mutual maintenance agreement",
  MAINTENANCE_EVIDENCE: "Evidence of maintenance received",
  SECOND_PARENT_INCOME: "The non-resident parent's own income",
  ESTRANGEMENT_NOTE: "Brief note of estrangement",
  CUSTODY_SPLIT_STATEMENT: "Statement of the custody split",
};

/** Convenience: is this scenario a policy gate the assessor must see? */
export function isGatedScenario(handling: HouseholdHandling): boolean {
  return handling.gate !== "NONE";
}
