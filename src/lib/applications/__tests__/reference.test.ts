import { describe, it, expect } from "vitest";
import {
  generateApplicationReference,
  resolveRolloverReference,
  validateReferenceInput,
} from "../reference";

describe("generateApplicationReference (Epic 13, D13-1a default format)", () => {
  it("builds the documented format: {Child} – {School} – {Year group} – {Academic year}", () => {
    expect(
      generateApplicationReference({
        childName: "Bob Smith",
        school: "TRINITY",
        entryYearGroup: "Y6",
        academicYear: "2027/28",
      })
    ).toBe("Bob Smith – Trinity School – Year 6 – 2027-28");
  });

  it("uses the full school name, not the old TS/WS prefix", () => {
    expect(
      generateApplicationReference({
        childName: "Ada Lovelace",
        school: "WHITGIFT",
        entryYearGroup: "Y12",
        academicYear: "2025-2026",
      })
    ).toBe("Ada Lovelace – Whitgift School – Year 12 – 2025-26");
  });

  it("accepts every stored academic-year form and normalises to YYYY-YY", () => {
    for (const stored of ["2027/28", "2027-28", "2027/2028", "2027"]) {
      expect(
        generateApplicationReference({
          childName: "Bob Smith",
          school: "TRINITY",
          entryYearGroup: "Y6",
          academicYear: stored,
        })
      ).toBe("Bob Smith – Trinity School – Year 6 – 2027-28");
    }
  });

  it("omits the year-group segment when none is recorded", () => {
    expect(
      generateApplicationReference({
        childName: "Bob Smith",
        school: "TRINITY",
        entryYearGroup: null,
        academicYear: "2027/28",
      })
    ).toBe("Bob Smith – Trinity School – 2027-28");
  });

  it("omits the year-group segment for OTHER — the label carries no information", () => {
    expect(
      generateApplicationReference({
        childName: "Bob Smith",
        school: "TRINITY",
        entryYearGroup: "OTHER",
        academicYear: "2027/28",
      })
    ).toBe("Bob Smith – Trinity School – 2027-28");
  });

  it("omits the academic-year segment when the round year is missing or unparseable", () => {
    expect(
      generateApplicationReference({
        childName: "Bob Smith",
        school: "TRINITY",
        entryYearGroup: "Y6",
        academicYear: "",
      })
    ).toBe("Bob Smith – Trinity School – Year 6");
  });

  it("trims the child name but never rewrites it otherwise", () => {
    expect(
      generateApplicationReference({
        childName: "  Bob  Smith-Jones  ",
        school: "TRINITY",
        entryYearGroup: "Y6",
        academicYear: "2027/28",
      })
    ).toBe("Bob  Smith-Jones – Trinity School – Year 6 – 2027-28");
  });

  it("never returns a blank label, even with nothing resolvable", () => {
    const result = generateApplicationReference({
      childName: null,
      school: null,
      entryYearGroup: null,
      academicYear: null,
    });
    expect(result).toBe("Application");
    expect(validateReferenceInput(result)).toEqual({ valid: true });
  });

  it("is deterministic — the same inputs always give byte-identical output", () => {
    const input = {
      childName: "Bob Smith",
      school: "TRINITY" as const,
      entryYearGroup: "Y6" as const,
      academicYear: "2027/28",
    };
    expect(generateApplicationReference(input)).toBe(
      generateApplicationReference(input)
    );
  });

  it("produces the same label for two children with the same details — it is not an identity", () => {
    const twin = {
      childName: "Bob Smith",
      school: "TRINITY" as const,
      entryYearGroup: "Y6" as const,
      academicYear: "2027/28",
    };
    expect(generateApplicationReference(twin)).toBe(
      generateApplicationReference({ ...twin })
    );
  });
});

describe("resolveRolloverReference (D13-1a / Q5)", () => {
  const priorFacts = {
    childName: "Bob Smith",
    school: "TRINITY" as const,
    entryYearGroup: "Y6" as const,
    academicYear: "2027/28",
  };
  const nextFacts = {
    childName: "Bob Smith",
    school: "TRINITY" as const,
    entryYearGroup: "Y6" as const,
    academicYear: "2028/29",
  };

  it("INHERITS a human-edited reference so the fees-system code survives the year", () => {
    expect(
      resolveRolloverReference(
        { ...priorFacts, reference: "TS-SMITH05-Smith, Bob" },
        nextFacts
      )
    ).toBe("TS-SMITH05-Smith, Bob");
  });

  it("REGENERATES when the prior reference is still the untouched default — no stale academic year", () => {
    const untouched = generateApplicationReference(priorFacts);
    expect(untouched).toBe("Bob Smith – Trinity School – Year 6 – 2027-28");

    expect(
      resolveRolloverReference({ ...priorFacts, reference: untouched }, nextFacts)
    ).toBe("Bob Smith – Trinity School – Year 6 – 2028-29");
  });

  it("treats a one-character edit of the default as human-entered and inherits it", () => {
    const nudged = `${generateApplicationReference(priorFacts)} `;
    expect(
      resolveRolloverReference({ ...priorFacts, reference: nudged }, nextFacts)
    ).toBe(nudged);
  });

  it("regenerates a pre-Epic-13 machine-generated reference rather than dragging it forward", () => {
    for (const legacy of [
      "TS-20252026-0001",
      "WS-20252026-0042",
      "INT-2025-26-0003",
    ]) {
      expect(
        resolveRolloverReference({ ...priorFacts, reference: legacy }, nextFacts)
      ).toBe("Bob Smith – Trinity School – Year 6 – 2028-29");
    }
  });

  it("never mistakes a fees-system code for a legacy generated reference", () => {
    for (const human of [
      "TS-SMITH05-Smith, Bob",
      "WS-2025-ABCD",
      "TS-20252026-0001a",
      "INT-2025-26-0003 (rev 2)",
    ]) {
      expect(
        resolveRolloverReference({ ...priorFacts, reference: human }, nextFacts)
      ).toBe(human);
    }
  });

  it("generates a fresh default when there is no prior application", () => {
    expect(resolveRolloverReference(null, nextFacts)).toBe(
      "Bob Smith – Trinity School – Year 6 – 2028-29"
    );
  });

  it("compares against the PRIOR application's own facts, not the new year's", () => {
    // The child's recorded year-group changed between years. The prior
    // reference is still the prior year's default, so it must regenerate —
    // recomputing against the NEW facts would wrongly read as "edited".
    const prior = {
      ...priorFacts,
      reference: generateApplicationReference(priorFacts),
    };
    expect(
      resolveRolloverReference(prior, { ...nextFacts, entryYearGroup: "Y7" })
    ).toBe("Bob Smith – Trinity School – Year 7 – 2028-29");
  });
});

describe("validateReferenceInput (item 11, Story 11.1/11.2)", () => {
  it("rejects an empty string", () => {
    expect(validateReferenceInput("")).toEqual({
      valid: false,
      error: "Bursary reference cannot be blank.",
    });
  });

  it("rejects a whitespace-only string", () => {
    expect(validateReferenceInput("   ")).toEqual({
      valid: false,
      error: "Bursary reference cannot be blank.",
    });
  });

  it("accepts a normal reference", () => {
    expect(validateReferenceInput("WS-20252026-0001")).toEqual({
      valid: true,
    });
  });

  it("accepts whitespace and special characters verbatim — no format restriction", () => {
    expect(validateReferenceInput("  ABC #1 / v2  ")).toEqual({ valid: true });
  });

  it("accepts the external fees-system code shape (D13-1a's hard requirement)", () => {
    expect(validateReferenceInput("TS-SMITH05-Smith, Bob")).toEqual({
      valid: true,
    });
  });

  it("does not trim or otherwise transform the value — validation only", () => {
    // The helper's contract is validate-only; the caller persists the raw
    // input unchanged (verbatim preservation, Story 11.2, decided).
    const input = "  spaced-ref  ";
    const result = validateReferenceInput(input);
    expect(result.valid).toBe(true);
    expect(input).toBe("  spaced-ref  ");
  });
});
