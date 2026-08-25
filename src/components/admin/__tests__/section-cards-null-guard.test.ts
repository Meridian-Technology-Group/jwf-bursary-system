import { describe, it, expect } from "vitest";
import {
  isRenderableObject,
  asProvenanceMap,
} from "@/components/admin/application-section-cards";

/**
 * CH-57 — the null-array crash on the Applicant Data tab.
 *
 * Charlotte hit "Something went wrong" on WS-202627-0010. The server log gave
 * `TypeError: Cannot convert undefined or null to object at Object.entries`.
 *
 * Cause: `typeof null === "object"` in JavaScript, so the recursion's
 * `typeof item === "object"` check admitted a null array element, which then
 * reached `Object.entries(null)` and threw — taking the whole page down, not
 * just the one row.
 *
 * The data that triggered it was ordinary: that application's
 * `ucMonthlyDocumentIds` held `[null, null, null]`, which is simply what an
 * unfilled three-slot document upload stores. Any application with an unfilled
 * multi-document slot would have crashed the same way.
 */
describe("isRenderableObject — CH-57", () => {
  it("rejects null, which is the whole point", () => {
    // `typeof null === "object"` is the trap this predicate exists to close.
    expect(typeof null).toBe("object");
    expect(isRenderableObject(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isRenderableObject(undefined)).toBe(false);
  });

  it("accepts a plain object", () => {
    expect(isRenderableObject({})).toBe(true);
    expect(isRenderableObject({ a: 1 })).toBe(true);
  });

  it("accepts an array, which DataBlock handles before recursing", () => {
    expect(isRenderableObject([])).toBe(true);
  });

  it("rejects primitives", () => {
    for (const v of [0, 1, "", "x", true, false]) {
      expect(isRenderableObject(v)).toBe(false);
    }
  });

  it("holds for every element of the array that actually crashed the page", () => {
    const ucMonthlyDocumentIds = [null, null, null];
    for (const item of ucMonthlyDocumentIds) {
      expect(isRenderableObject(item)).toBe(false);
    }
  });

  it("still admits a populated document array", () => {
    const populated = [{ id: "a" }, { id: "b" }];
    for (const item of populated) {
      expect(isRenderableObject(item)).toBe(true);
    }
  });
});

describe("asProvenanceMap — unchanged, and already defensive", () => {
  it("returns an empty map for null rather than throwing", () => {
    expect(asProvenanceMap(null)).toEqual({});
  });

  it("drops malformed entries instead of failing the render", () => {
    expect(asProvenanceMap({ "a.b": null, "c.d": 5 })).toEqual({});
  });

  it("keeps a well-formed entry", () => {
    expect(
      asProvenanceMap({ "a.b": { editedByName: "Charlotte", editedAt: "x" } })
    ).toEqual({ "a.b": { editedByName: "Charlotte", editedAt: "x" } });
  });
});
