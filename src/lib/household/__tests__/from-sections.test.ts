import { describe, it, expect } from "vitest";
import {
  householdInputFromSources,
  deriveHouseholdFromSources,
} from "@/lib/household/from-sections";

describe("householdInputFromSources — defensive mapping + back-compat", () => {
  it("maps a full Epic-09 source set", () => {
    const i = householdInputFromSources({
      parentDetails: {
        relationshipStatus: "DIVORCED",
        isSoleParent: false,
        isGuardian: false,
        custodyArrangement: "SHARED_5050",
        isRemarriedSoleParent: false,
        financesNotDisentangled: false,
      },
      otherInfo: { hasCOurtOrder: true },
    });
    expect(i.relationshipStatus).toBe("DIVORCED");
    expect(i.isSoleParent).toBe(false);
    expect(i.custodyArrangement).toBe("SHARED_5050");
    expect(i.hasSchoolFeesCourtOrder).toBe(true);
  });

  it("legacy draft with no Epic-09 facets → safe defaults (sole, no order)", () => {
    const i = householdInputFromSources({
      parentDetails: { relationshipStatus: "WIDOWED", isSoleParent: true },
      otherInfo: null,
    });
    expect(i.isGuardian).toBe(false);
    expect(i.custodyArrangement).toBe("SOLE");
    expect(i.hasSchoolFeesCourtOrder).toBe(false);
    expect(i.isRemarriedSoleParent).toBe(false);
    expect(i.financesNotDisentangled).toBe(false);
  });

  it("missing / null sources → single sole parent default", () => {
    const i = householdInputFromSources({});
    expect(i.relationshipStatus).toBe("SINGLE");
    expect(i.isSoleParent).toBe(false);
    expect(i.custodyArrangement).toBe("SOLE");
  });

  it("the Application custody column overrides the form blob", () => {
    const i = householdInputFromSources({
      parentDetails: { custodyArrangement: "SOLE" },
      applicationCustodyArrangement: "SHARED_MAIN_LIMITED",
    });
    expect(i.custodyArrangement).toBe("SHARED_MAIN_LIMITED");
  });

  it("unknown enum strings coerce to defaults (never throw)", () => {
    const i = householdInputFromSources({
      parentDetails: { relationshipStatus: "GIBBERISH", custodyArrangement: "??" },
    });
    expect(i.relationshipStatus).toBe("SINGLE");
    expect(i.custodyArrangement).toBe("SOLE");
  });
});

describe("deriveHouseholdFromSources — end-to-end", () => {
  it("divorced + school-fees order → H7 cannot-support", () => {
    const h = deriveHouseholdFromSources({
      parentDetails: { relationshipStatus: "DIVORCED", isSoleParent: false },
      otherInfo: { hasCOurtOrder: true },
    });
    expect(h.scenario).toBe("H7");
    expect(h.gate).toBe("CANNOT_SUPPORT");
  });

  it("widowed legacy draft → H3 death certificate", () => {
    const h = deriveHouseholdFromSources({
      parentDetails: { relationshipStatus: "WIDOWED", isSoleParent: true },
    });
    expect(h.scenario).toBe("H3");
  });
});
