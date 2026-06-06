import { describe, it, expect } from "vitest";
import {
  deriveHouseholdScenario,
  isGatedScenario,
  EVIDENCE_LABELS,
  type HouseholdInput,
  type HouseholdEvidence,
} from "@/lib/household/rules";

/** Build a minimal input, overriding only what a test cares about. */
function input(over: Partial<HouseholdInput> = {}): HouseholdInput {
  return {
    relationshipStatus: "SINGLE",
    isSoleParent: true,
    ...over,
  };
}

describe("deriveHouseholdScenario — §3.1 matrix (H1–H11)", () => {
  it("H1 — single / sole parent → SOLE, resident lead, no second parent", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "SINGLE", isSoleParent: true })
    );
    expect(h.scenario).toBe("H1");
    expect(h.assessees).toBe("SOLE");
    expect(h.leadRule).toBe("RESIDENT");
    expect(h.needsSecondParent).toBe(false);
    expect(h.gate).toBe("NONE");
    expect(h.requiredEvidence).toEqual([]);
  });

  it("H1 (two-parent variant) — married, NOT sole → TWO_PARENT household", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "MARRIED", isSoleParent: false })
    );
    expect(h.scenario).toBe("H1");
    expect(h.assessees).toBe("TWO_PARENT");
    expect(h.needsSecondParent).toBe(true);
    expect(h.gate).toBe("NONE");
  });

  it("cohabiting / civil partnership, not sole → two-earner household", () => {
    for (const rs of ["COHABITING", "CIVIL_PARTNERSHIP"] as const) {
      const h = deriveHouseholdScenario(
        input({ relationshipStatus: rs, isSoleParent: false })
      );
      expect(h.assessees).toBe("TWO_PARENT");
      expect(h.needsSecondParent).toBe(true);
    }
  });

  it("H2 — long-separated + sole → SOLE with estrangement note", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "SEPARATED", isSoleParent: true })
    );
    expect(h.scenario).toBe("H2");
    expect(h.assessees).toBe("SOLE");
    expect(h.needsSecondParent).toBe(false);
    expect(h.requiredEvidence).toContain<HouseholdEvidence>("ESTRANGEMENT_NOTE");
    expect(h.gate).toBe("NONE");
  });

  it("H3 — widowed → SOLE, death certificate required", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "WIDOWED", isSoleParent: true })
    );
    expect(h.scenario).toBe("H3");
    expect(h.assessees).toBe("SOLE");
    expect(h.needsSecondParent).toBe(false);
    expect(h.requiredEvidence).toEqual(["DEATH_CERTIFICATE"]);
  });

  it("H4 — guardian facet overrides relationship → SOLE + guardianship evidence", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "SINGLE", isSoleParent: true, isGuardian: true })
    );
    expect(h.scenario).toBe("H4");
    expect(h.assessees).toBe("SOLE");
    expect(h.requiredEvidence).toEqual(["GUARDIANSHIP_EVIDENCE"]);
    expect(h.needsSecondParent).toBe(false);
  });

  it("H4 — guardian wins even when widowed", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "WIDOWED", isGuardian: true })
    );
    expect(h.scenario).toBe("H4");
    expect(h.requiredEvidence).toEqual(["GUARDIANSHIP_EVIDENCE"]);
  });

  it("H5 — separated (not sole) → TWO_PARENT, mutual agreement + NR income", () => {
    const h = deriveHouseholdScenario(
      input({ relationshipStatus: "SEPARATED", isSoleParent: false })
    );
    expect(h.scenario).toBe("H5");
    expect(h.assessees).toBe("TWO_PARENT");
    expect(h.leadRule).toBe("RESIDENT");
    expect(h.needsSecondParent).toBe(true);
    expect(h.requiredEvidence).toContain<HouseholdEvidence>("SECOND_PARENT_INCOME");
    expect(h.requiredEvidence).toContain<HouseholdEvidence>(
      "MUTUAL_MAINTENANCE_AGREEMENT"
    );
    expect(h.gate).toBe("NONE");
  });

  it("H6 — divorced, NO school-fees court order → TWO_PARENT + decree absolute", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        hasSchoolFeesCourtOrder: false,
      })
    );
    expect(h.scenario).toBe("H6");
    expect(h.assessees).toBe("TWO_PARENT");
    expect(h.requiredEvidence).toContain<HouseholdEvidence>("DECREE_ABSOLUTE");
    expect(h.requiredEvidence).toContain<HouseholdEvidence>("SECOND_PARENT_INCOME");
    expect(h.gate).toBe("NONE");
  });

  it("H7 — divorced WITH school-fees court order → CANNOT_SUPPORT flag (not auto-decline)", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        hasSchoolFeesCourtOrder: true,
      })
    );
    expect(h.scenario).toBe("H7");
    expect(h.gate).toBe("CANNOT_SUPPORT");
    expect(isGatedScenario(h)).toBe(true);
    // It surfaces as a flag — the handling still describes assessment, it does
    // not encode an automatic outcome.
    expect(h.assessees).toBe("TWO_PARENT");
  });

  it("H7 requires the order to be SCHOOL-FEES-specific — a divorced case without one is H6", () => {
    const withOrder = deriveHouseholdScenario(
      input({ relationshipStatus: "DIVORCED", hasSchoolFeesCourtOrder: true })
    );
    const withoutOrder = deriveHouseholdScenario(
      input({ relationshipStatus: "DIVORCED", hasSchoolFeesCourtOrder: false })
    );
    expect(withOrder.scenario).toBe("H7");
    expect(withoutOrder.scenario).toBe("H6");
  });

  it("a school-fees court order on a NON-divorced case does NOT trigger H7", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "SEPARATED",
        isSoleParent: false,
        hasSchoolFeesCourtOrder: true,
      })
    );
    expect(h.scenario).toBe("H5");
    expect(h.gate).toBe("NONE");
  });

  it("H8 — remarried sole parent → HOUSEHOLD_PLUS_ABSENT (two-earner + maintenance, D17)", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "MARRIED",
        isSoleParent: false,
        isRemarriedSoleParent: true,
      })
    );
    expect(h.scenario).toBe("H8");
    expect(h.assessees).toBe("HOUSEHOLD_PLUS_ABSENT");
    expect(h.needsSecondParent).toBe(true);
    expect(h.requiredEvidence).toContain<HouseholdEvidence>("MAINTENANCE_EVIDENCE");
    expect(h.gate).toBe("NONE");
  });

  it("H9 — mid-divorce, finances not disentangled → MAY_DEFER flag (not auto-decline)", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        financesNotDisentangled: true,
      })
    );
    expect(h.scenario).toBe("H9");
    expect(h.gate).toBe("MAY_DEFER");
    expect(isGatedScenario(h)).toBe(true);
  });

  it("H9 also applies to a separated case with unstable finances", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "SEPARATED",
        isSoleParent: false,
        financesNotDisentangled: true,
      })
    );
    expect(h.scenario).toBe("H9");
    expect(h.gate).toBe("MAY_DEFER");
  });

  it("H7 takes precedence over H9 (court order is the hard disqualifier)", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        hasSchoolFeesCourtOrder: true,
        financesNotDisentangled: true,
      })
    );
    expect(h.scenario).toBe("H7");
    expect(h.gate).toBe("CANNOT_SUPPORT");
  });

  it("H10 — 50/50 shared custody → both lead, two incomes", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        custodyArrangement: "SHARED_5050",
      })
    );
    expect(h.scenario).toBe("H10");
    expect(h.leadRule).toBe("BOTH");
    expect(h.assessees).toBe("TWO_PARENT");
    expect(h.requiredEvidence).toContain<HouseholdEvidence>(
      "CUSTODY_SPLIT_STATEMENT"
    );
  });

  it("H11 — main + limited shared custody → main-custody lead, two incomes", () => {
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "SEPARATED",
        isSoleParent: false,
        custodyArrangement: "SHARED_MAIN_LIMITED",
      })
    );
    expect(h.scenario).toBe("H11");
    expect(h.leadRule).toBe("MAIN_CUSTODY");
    expect(h.assessees).toBe("TWO_PARENT");
  });

  it("shared custody overrides H7 court order? — court order still cannot-support? (precedence check)", () => {
    // Custody is checked before H7 by design (a 50/50 split is a defined
    // handling shape); the court-order flag would then be carried by the
    // assessor aid through the other-info data, not by re-routing the scenario.
    const h = deriveHouseholdScenario(
      input({
        relationshipStatus: "DIVORCED",
        custodyArrangement: "SHARED_5050",
        hasSchoolFeesCourtOrder: true,
      })
    );
    expect(h.scenario).toBe("H10");
  });
});

describe("deriveHouseholdScenario — totality & determinism", () => {
  const RELATIONSHIPS = [
    "SINGLE",
    "MARRIED",
    "WIDOWED",
    "SEPARATED",
    "DIVORCED",
    "CIVIL_PARTNERSHIP",
    "COHABITING",
  ] as const;

  it("returns exactly one handling for every relationship × toggle combo", () => {
    for (const rs of RELATIONSHIPS) {
      for (const sole of [true, false]) {
        const h = deriveHouseholdScenario(
          input({ relationshipStatus: rs, isSoleParent: sole })
        );
        expect(h.scenario).toMatch(/^H(1|2|3|4|5|6|7|8|9|10|11)$/);
        expect(h.label.length).toBeGreaterThan(0);
        expect(h.assessorNote.length).toBeGreaterThan(0);
        // needsSecondParent must agree with the assessee shape
        expect(h.needsSecondParent).toBe(h.assessees !== "SOLE");
      }
    }
  });

  it("is deterministic — same input, same output", () => {
    const a = deriveHouseholdScenario(input({ relationshipStatus: "SEPARATED", isSoleParent: false }));
    const b = deriveHouseholdScenario(input({ relationshipStatus: "SEPARATED", isSoleParent: false }));
    expect(a).toEqual(b);
  });

  it("never returns an auto-decline — gate is only NONE / CANNOT_SUPPORT / MAY_DEFER", () => {
    for (const rs of RELATIONSHIPS) {
      const h = deriveHouseholdScenario(
        input({ relationshipStatus: rs, isSoleParent: false, hasSchoolFeesCourtOrder: true, financesNotDisentangled: true })
      );
      expect(["NONE", "CANNOT_SUPPORT", "MAY_DEFER"]).toContain(h.gate);
    }
  });
});

describe("EVIDENCE_LABELS", () => {
  it("has a label for every evidence value a scenario can emit", () => {
    const RELATIONSHIPS = [
      "SINGLE",
      "MARRIED",
      "WIDOWED",
      "SEPARATED",
      "DIVORCED",
      "CIVIL_PARTNERSHIP",
      "COHABITING",
    ] as const;
    const emitted = new Set<HouseholdEvidence>();
    for (const rs of RELATIONSHIPS) {
      for (const sole of [true, false]) {
        for (const guardian of [true, false]) {
          for (const order of [true, false]) {
            for (const custody of ["SOLE", "SHARED_5050", "SHARED_MAIN_LIMITED"] as const) {
              for (const remarried of [true, false]) {
                for (const flux of [true, false]) {
                  const h = deriveHouseholdScenario({
                    relationshipStatus: rs,
                    isSoleParent: sole,
                    isGuardian: guardian,
                    hasSchoolFeesCourtOrder: order,
                    custodyArrangement: custody,
                    isRemarriedSoleParent: remarried,
                    financesNotDisentangled: flux,
                  });
                  h.requiredEvidence.forEach((e) => emitted.add(e));
                }
              }
            }
          }
        }
      }
    }
    for (const e of Array.from(emitted)) {
      expect(EVIDENCE_LABELS[e]).toBeTruthy();
    }
  });
});
