import { describe, it, expect } from "vitest";
import { rollingOverWindowFor, scheduleRowDates } from "../schedule-dates";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("rollingOverWindowFor (Epic 21 R2)", () => {
  it("is the placeholder (15 Apr / 22 May of that year) with no stored window", () => {
    const w = rollingOverWindowFor(2027, null);
    expect([iso(w.opensOn), iso(w.submitBy), w.source]).toEqual(["2027-04-15", "2027-05-22", "placeholder"]);
  });

  it("takes the round's stored RA window, date by date", () => {
    expect(rollingOverWindowFor(2027, { opensOn: day("2027-04-12"), submitBy: day("2027-05-22") })).toMatchObject({
      source: "roundWindow",
    });
    const partial = rollingOverWindowFor(2027, { opensOn: null, submitBy: day("2027-05-22") });
    expect([iso(partial.opensOn), iso(partial.submitBy), partial.source]).toEqual([
      "2027-04-15",
      "2027-05-22",
      "roundWindow",
    ]);
  });

  it("an empty stored row is the placeholder", () => {
    expect(rollingOverWindowFor(2027, { opensOn: null, submitBy: null }).source).toBe("placeholder");
  });
});

describe("scheduleRowDates — the dates a schedule row shows (Epic 22 P5 reads this)", () => {
  const window = { availableOn: day("2027-04-15"), requiredBy: day("2027-05-22") };

  it("before the year's application exists: the window, for everyone", () => {
    expect(scheduleRowDates({ ...window, application: null })).toEqual({
      opensOn: day("2027-04-15"),
      closesOn: day("2027-05-22"),
      submitBy: day("2027-05-22"),
      hasOwnDeadline: false,
    });
  });

  it("an application without an override keeps the window close", () => {
    const d = scheduleRowDates({ ...window, application: { submissionDeadlineAt: null } });
    expect([iso(d.submitBy), d.hasOwnDeadline]).toEqual(["2027-05-22", false]);
  });

  it("an extension is the family's own deadline; the closing date stays the window's", () => {
    const ext = new Date("2027-06-05T16:00:00.000Z");
    const d = scheduleRowDates({ ...window, application: { submissionDeadlineAt: ext } });
    expect(d.closesOn).toEqual(day("2027-05-22"));
    expect(d.submitBy).toEqual(ext);
    expect(d.hasOwnDeadline).toBe(true);
  });

  it("an override on the same London day is not flagged (BST evening instant)", () => {
    // 22 May 2027 23:00 London = 22:00 UTC, the same calendar day.
    const sameDay = new Date("2027-05-22T22:00:00.000Z");
    expect(scheduleRowDates({ ...window, application: { submissionDeadlineAt: sameDay } }).hasOwnDeadline).toBe(false);
    // 23 May 00:30 London (23:30 UTC on the 22nd) is the next day.
    const nextDay = new Date("2027-05-22T23:30:00.000Z");
    expect(scheduleRowDates({ ...window, application: { submissionDeadlineAt: nextDay } }).hasOwnDeadline).toBe(true);
  });

  it("an override with no stored close is still the family's deadline", () => {
    const ext = new Date("2027-06-05T16:00:00.000Z");
    const d = scheduleRowDates({ availableOn: null, requiredBy: null, application: { submissionDeadlineAt: ext } });
    expect([d.submitBy, d.hasOwnDeadline]).toEqual([ext, true]);
  });
});
