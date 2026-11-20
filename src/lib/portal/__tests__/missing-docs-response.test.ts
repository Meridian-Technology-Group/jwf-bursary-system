import { describe, it, expect } from "vitest";
import {
  slotsStillNeeded,
  slotDisplayName,
  stillNeededMessage,
} from "../missing-docs-response";

// Audit 20 Nov 2026, finding 6: a requested slot is only answered by a file
// uploaded AFTER the request; the earlier file stays but does not count.

const REQUESTED_AT = new Date("2026-11-20T10:00:00Z");

describe("slotsStillNeeded", () => {
  it("an old file in the slot does not answer the request", () => {
    expect(
      slotsStillNeeded(
        ["BANK_STATEMENT_PARENT_1"],
        [{ slot: "BANK_STATEMENT_PARENT_1", uploadedAt: new Date("2026-11-01T09:00:00Z") }],
        REQUESTED_AT
      )
    ).toEqual(["BANK_STATEMENT_PARENT_1"]);
  });

  it("a file uploaded after the request answers it, alongside the old one", () => {
    expect(
      slotsStillNeeded(
        ["BANK_STATEMENT_PARENT_1"],
        [
          { slot: "BANK_STATEMENT_PARENT_1", uploadedAt: new Date("2026-11-01T09:00:00Z") },
          { slot: "BANK_STATEMENT_PARENT_1", uploadedAt: new Date("2026-11-20T10:05:00Z") },
        ],
        REQUESTED_AT
      )
    ).toEqual([]);
  });

  it("lists only the slots still waiting, in request order", () => {
    expect(
      slotsStillNeeded(
        ["P60_PARENT_1", "BANK_STATEMENT_PARENT_1", "COUNCIL_TAX_BILL"],
        [{ slot: "BANK_STATEMENT_PARENT_1", uploadedAt: new Date("2026-11-20T11:00:00Z") }],
        REQUESTED_AT
      )
    ).toEqual(["P60_PARENT_1", "COUNCIL_TAX_BILL"]);
  });

  it("a file uploaded at the very moment of the request does not count", () => {
    expect(
      slotsStillNeeded(
        ["P60_PARENT_1"],
        [{ slot: "P60_PARENT_1", uploadedAt: REQUESTED_AT }],
        REQUESTED_AT
      )
    ).toEqual(["P60_PARENT_1"]);
  });
});

describe("messages", () => {
  it("names each slot the way the page does", () => {
    expect(slotDisplayName("BANK_STATEMENT_PARENT_2")).toBe("Bank Statement — Parent 2");
    expect(stillNeededMessage(["P60_PARENT_1", "COUNCIL_TAX_BILL"])).toBe(
      "Please upload a new copy of: P60 — Parent 1, Council Tax Bill. The documents you sent earlier are still on file, but the assessor has asked for new ones."
    );
  });
});
