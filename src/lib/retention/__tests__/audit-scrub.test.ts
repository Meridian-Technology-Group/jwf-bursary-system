import { describe, expect, it } from "vitest";
import { auditNeedles, scrubJson, scrubText } from "../audit-scrub";

describe("auditNeedles", () => {
  it("longest first, so a reference holding the name goes whole", () => {
    expect(auditNeedles(["Charlie Test", "Charlie Test – Trinity School – Year 7 – 2026-27"])).toEqual([
      "Charlie Test – Trinity School – Year 7 – 2026-27",
      "Charlie Test",
    ]);
  });
  it("drops blanks, duplicates, short strings and what is already XXXX", () => {
    expect(auditNeedles([null, undefined, "", "  ", "Al", "XXXX", "Pat Parent", "Pat Parent"])).toEqual(["Pat Parent"]);
  });
});

describe("scrubText / scrubJson", () => {
  const needles = auditNeedles(["Charlie Test – Trinity School", "Charlie Test", "p@example.test"]);
  it("replaces every occurrence", () => {
    expect(scrubText("Charlie Test and Charlie Test", needles)).toBe("XXXX and XXXX");
  });
  it("walks nested values and leaves keys and non-strings alone", () => {
    expect(
      scrubJson({ reference: "Charlie Test – Trinity School", n: 3, list: ["p@example.test", null], nested: { "Charlie Test": true } }, needles),
    ).toEqual({ reference: "XXXX", n: 3, list: ["XXXX", null], nested: { "Charlie Test": true } });
  });
});
