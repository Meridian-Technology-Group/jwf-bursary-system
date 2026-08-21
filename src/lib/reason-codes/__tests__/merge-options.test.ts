import { describe, it, expect } from "vitest";
import { mergeHistoricReasonCodeOptions } from "../merge-options";

describe("mergeHistoricReasonCodeOptions (CALC-09)", () => {
  const active = [
    { id: "a-101", code: 101, label: "1 - No year on year comparison, first assessment" },
    { id: "a-102", code: 102, label: "2 - No real change" },
  ];

  it("returns just the active list when nothing historic is linked", () => {
    expect(mergeHistoricReasonCodeOptions(active, [])).toEqual(active);
  });

  it("appends a deprecated code the recommendation still links to", () => {
    const linked = [
      active[0],
      { id: "deprecated-1", code: 1, label: "No real change in circumstances" },
    ];
    const result = mergeHistoricReasonCodeOptions(active, linked);
    expect(result).toEqual([
      ...active,
      { id: "deprecated-1", code: 1, label: "No real change in circumstances" },
    ]);
  });

  it("does not duplicate a linked code that is still active", () => {
    const result = mergeHistoricReasonCodeOptions(active, [active[1]]);
    expect(result).toEqual(active);
  });

  it("handles multiple historic-only codes", () => {
    const linked = [
      { id: "deprecated-1", code: 1, label: "One" },
      { id: "deprecated-2", code: 2, label: "Two" },
    ];
    const result = mergeHistoricReasonCodeOptions(active, linked);
    expect(result).toHaveLength(4);
    expect(result.slice(2)).toEqual(linked);
  });
});
