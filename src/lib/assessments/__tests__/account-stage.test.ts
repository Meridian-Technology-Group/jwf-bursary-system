import { describe, expect, it } from "vitest";
import { ACCOUNT_STAGE_LABELS, deriveAccountStage, type AccountStageInput } from "../account-stage";

const base: AccountStageInput = {
  accountStatus: null,
  closedAt: null,
  archivedAt: null,
  assessmentStatus: "COMPLETED",
  retentionStage: null,
};

// Charlotte, 22 Oct 2026: "Pre-bursary Open & Pre-Bursary Closed and then Active and Closed."
describe("deriveAccountStage", () => {
  it("an account's own status wins", () => {
    expect(deriveAccountStage({ ...base, accountStatus: "ACTIVE", closedAt: new Date() })).toBe("ACTIVE");
    expect(deriveAccountStage({ ...base, accountStatus: "CLOSED" })).toBe("CLOSED");
  });
  it("no account, still being worked: pre-bursary open", () => {
    expect(deriveAccountStage(base)).toBe("PRE_OPEN");
  });
  it("no account and closed, archived or erased: pre-bursary closed", () => {
    expect(deriveAccountStage({ ...base, closedAt: new Date() })).toBe("PRE_CLOSED");
    expect(deriveAccountStage({ ...base, archivedAt: new Date() })).toBe("PRE_CLOSED");
    expect(deriveAccountStage({ ...base, assessmentStatus: "CLOSED_ARCHIVED" })).toBe("PRE_CLOSED");
    expect(deriveAccountStage({ ...base, retentionStage: "ANONYMISED" })).toBe("PRE_CLOSED");
  });
  it("her wording", () => {
    expect(ACCOUNT_STAGE_LABELS).toEqual({
      ACTIVE: "Active",
      CLOSED: "Closed",
      PRE_OPEN: "Pre-bursary open",
      PRE_CLOSED: "Pre-bursary closed",
    });
  });
});
