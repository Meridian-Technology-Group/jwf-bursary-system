import { describe, it, expect } from "vitest";
import {
  buildVersionDuplicationPayload,
  isDuplicateEffectiveFrom,
} from "../reference-versioning";

describe("buildVersionDuplicationPayload", () => {
  it("strips id/createdAt/effectiveFrom and re-stamps with the new date", () => {
    const current = [
      { id: "a", createdAt: new Date("2026-01-01"), effectiveFrom: new Date("2026-09-01"), category: 1, amount: 100 },
      { id: "b", createdAt: new Date("2026-01-02"), effectiveFrom: new Date("2026-09-01"), category: 2, amount: 200 },
    ];
    const newDate = new Date("2027-09-01");

    const result = buildVersionDuplicationPayload(current, newDate);

    expect(result).toEqual([
      { category: 1, amount: 100, effectiveFrom: newDate },
      { category: 2, amount: 200, effectiveFrom: newDate },
    ]);
    // No id/createdAt keys leak through.
    for (const row of result) {
      expect(row).not.toHaveProperty("id");
      expect(row).not.toHaveProperty("createdAt");
    }
  });

  it("does not mutate the input rows", () => {
    const current = [
      { id: "a", createdAt: new Date(), effectiveFrom: new Date("2026-09-01"), amount: 42 },
    ];
    const snapshot = JSON.parse(JSON.stringify(current));

    buildVersionDuplicationPayload(current, new Date("2027-01-01"));

    expect(JSON.parse(JSON.stringify(current))).toEqual(snapshot);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildVersionDuplicationPayload([], new Date())).toEqual([]);
  });

  it("preserves every non-identity field, including nulls", () => {
    const current = [
      {
        id: "a",
        createdAt: new Date(),
        effectiveFrom: new Date("2026-09-01"),
        bandFloor: null,
        bandCeiling: 27000,
        category: 1,
      },
    ];
    const result = buildVersionDuplicationPayload(current, new Date("2027-01-01"));
    expect(result[0]).toMatchObject({ bandFloor: null, bandCeiling: 27000, category: 1 });
  });
});

describe("isDuplicateEffectiveFrom", () => {
  it("detects a same-day match regardless of time-of-day", () => {
    const existing = [new Date("2026-09-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z")];
    expect(isDuplicateEffectiveFrom(new Date("2026-09-01T14:32:00Z"), existing)).toBe(true);
  });

  it("returns false when the date is not among the existing generations", () => {
    const existing = [new Date("2026-09-01")];
    expect(isDuplicateEffectiveFrom(new Date("2027-09-01"), existing)).toBe(false);
  });

  it("returns false for an empty existing list", () => {
    expect(isDuplicateEffectiveFrom(new Date("2026-09-01"), [])).toBe(false);
  });

  it("accepts string dates in the existing list", () => {
    const existing = ["2026-09-01T00:00:00.000Z"];
    expect(isDuplicateEffectiveFrom(new Date("2026-09-01T09:00:00Z"), existing)).toBe(true);
  });
});
