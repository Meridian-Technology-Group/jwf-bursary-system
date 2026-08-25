import { describe, it, expect } from "vitest";
import {
  normalisePostcodeDistrict,
  resolvePostcodeArea,
  formatPostcodeAreaLabel,
  POSTCODE_AREA_FALLBACK,
} from "../postcode-area";
import { postcodeAreas } from "../../../../prisma/seed-data/postcode-areas";

/**
 * CH-43 — the postcode district → area lookup.
 *
 * Driven from the real seed-data module so the resolver and the seeded table
 * cannot silently drift apart: asserting against re-typed literals here would
 * not catch a bad transcription of her spreadsheet.
 */

describe("CH-43 — her spreadsheet, transcribed", () => {
  it("seeds 94 districts (95 rows less the *** catch-all)", () => {
    expect(postcodeAreas).toHaveLength(94);
  });

  it("carries her own worked example", () => {
    // The one she wrote out: "the assessor types : SM4, and the field ...
    // reports : SM4-MORDEN".
    expect(formatPostcodeAreaLabel("SM4", postcodeAreas)).toBe("SM4-MORDEN");
  });

  it("strips the footnote asterisks from CR0", () => {
    // Her sheet has "CR0***"; the asterisks are a footnote marker, not part of
    // the district.
    expect(resolvePostcodeArea("CR0", postcodeAreas)).toBe("CROYDON");
    expect(postcodeAreas.some((r) => r.district.includes("*"))).toBe(false);
  });

  it("has no duplicate districts — a district maps to exactly one area", () => {
    const districts = postcodeAreas.map((r) => r.district);
    expect(new Set(districts).size).toBe(districts.length);
  });

  it("keeps her area names verbatim, including the compound ones", () => {
    expect(resolvePostcodeArea("CR3", postcodeAreas)).toBe("CATERHAM / WHYTELEAFE");
    expect(resolvePostcodeArea("KT8", postcodeAreas)).toBe("EAST MOLESEY; WEST MOLESEY");
    expect(resolvePostcodeArea("CR8", postcodeAreas)).toBe("PURLEY / KENLEY");
  });

  it("maps several districts onto one area where she does", () => {
    // KT17/18/19 are all Epsom in her sheet — not a transcription error.
    for (const d of ["KT17", "KT18", "KT19"]) {
      expect(resolvePostcodeArea(d, postcodeAreas)).toBe("EPSOM");
    }
  });
});

describe("normalisePostcodeDistrict — tolerant of how an assessor types", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalisePostcodeDistrict(" sm4 ")).toBe("SM4");
    expect(normalisePostcodeDistrict("Sm4")).toBe("SM4");
  });

  it("accepts a full postcode and keeps only the outward code", () => {
    // Typing the whole postcode is the obvious mistake; refusing it would be
    // pedantry.
    expect(normalisePostcodeDistrict("SM4 5AB")).toBe("SM4");
    expect(normalisePostcodeDistrict("sm45ab")).toBe("SM4");
    expect(normalisePostcodeDistrict("CR0 2RH")).toBe("CR0");
  });

  it("handles a single-letter area and a two-digit district", () => {
    expect(normalisePostcodeDistrict("N1")).toBe("N1");
    expect(normalisePostcodeDistrict("SE26")).toBe("SE26");
    expect(normalisePostcodeDistrict("KT24")).toBe("KT24");
  });

  it("keeps the trailing letter of a London outward code like SW1A", () => {
    expect(normalisePostcodeDistrict("SW1A 1AA")).toBe("SW1A");
  });

  it("returns empty for empty input rather than throwing", () => {
    expect(normalisePostcodeDistrict("")).toBe("");
    expect(normalisePostcodeDistrict(null)).toBe("");
    expect(normalisePostcodeDistrict(undefined)).toBe("");
  });
});

describe("the OTHER fallback — her *** row", () => {
  it("resolves an unlisted district to OTHER rather than failing", () => {
    // Her list is Croydon and its surrounds; an applicant from Manchester is
    // expected, not an error.
    expect(resolvePostcodeArea("M1", postcodeAreas)).toBe(POSTCODE_AREA_FALLBACK);
    expect(formatPostcodeAreaLabel("M1", postcodeAreas)).toBe("M1-OTHER");
  });

  it("never rejects nonsense — it still yields a label", () => {
    expect(formatPostcodeAreaLabel("ZZ99", postcodeAreas)).toBe("ZZ99-OTHER");
  });

  it("returns null for an unfilled field, so the UI shows a dash not '-OTHER'", () => {
    expect(formatPostcodeAreaLabel("", postcodeAreas)).toBeNull();
    expect(formatPostcodeAreaLabel(null, postcodeAreas)).toBeNull();
    expect(formatPostcodeAreaLabel("   ", postcodeAreas)).toBeNull();
  });

  it("falls back to OTHER against an empty lookup table", () => {
    // Defensive: an unseeded environment must not blank the summary row.
    expect(resolvePostcodeArea("SM4", [])).toBe(POSTCODE_AREA_FALLBACK);
  });
});
