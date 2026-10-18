import { describe, it, expect } from "vitest";
import { dueAt, isOverdue } from "../overdue";

describe("Overdue (17 Oct 2026)", () => {
  const requiredBy = new Date("2027-05-22T00:00:00Z");

  it("falls due at the end of the Required By day", () => {
    const due = dueAt(null, requiredBy);
    expect(isOverdue(due, new Date("2027-05-22T20:00:00Z"))).toBe(false);
    expect(isOverdue(due, new Date("2027-05-23T00:30:00Z"))).toBe(true);
  });

  it("the family's own deadline wins over Required By", () => {
    const due = dueAt(new Date("2027-05-29T22:59:59.999Z"), requiredBy);
    expect(isOverdue(due, new Date("2027-05-25T12:00:00Z"))).toBe(false);
    expect(isOverdue(due, new Date("2027-05-30T09:00:00Z"))).toBe(true);
  });

  it("no date, never overdue", () => {
    expect(isOverdue(dueAt(null, null), new Date())).toBe(false);
  });
});
