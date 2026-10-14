import { describe, expect, it } from "vitest";
import { decideSeed, supabaseProjectRef, type CandidateAccount } from "../backfill-main-synopsis-core";

function account(overrides: Partial<CandidateAccount> = {}): CandidateAccount {
  return {
    id: "acc-1",
    hasMain: false,
    applications: [
      {
        id: "app-1",
        reference: "TS-TEST01",
        migrationSource: null,
        academicYear: "2026/27",
        assessment: { id: "ass-1", status: "NEW_AWARD", synopsis: "  Award synopsis.  " },
      },
    ],
    ...overrides,
  };
}

describe("decideSeed", () => {
  it("seeds from the locked year's synopsis, trimmed", () => {
    const d = decideSeed(account());
    expect(d).toMatchObject({ action: "SEED", assessmentId: "ass-1", applicationId: "app-1", body: "Award synopsis." });
  });

  it("skips an account that already has a Main synopsis", () => {
    expect(decideSeed(account({ hasMain: true }))).toMatchObject({ action: "SKIP", reason: "HAS_MAIN" });
  });

  it("skips migrated accounts (the toolkit owns them)", () => {
    const a = account();
    a.applications[0].migrationSource = "GRANT_TRACKER";
    expect(decideSeed(a)).toMatchObject({ action: "SKIP", reason: "MIGRATED" });
  });

  it("skips accounts with no locked assessment (the lock path will seed them)", () => {
    const a = account();
    a.applications[0].assessment!.status = "COMPLETED";
    expect(decideSeed(a)).toMatchObject({ action: "SKIP", reason: "NO_LOCKED_ASSESSMENT" });
  });

  it("skips when every locked synopsis is blank", () => {
    const a = account();
    a.applications[0].assessment!.synopsis = "   ";
    expect(decideSeed(a)).toMatchObject({ action: "SKIP", reason: "BLANK_SYNOPSIS" });
  });

  it("uses the earliest locked year with text, as the first award lock would have", () => {
    const a = account({
      applications: [
        {
          id: "app-2",
          reference: "TS-TEST01",
          migrationSource: null,
          academicYear: "2027-28",
          assessment: { id: "ass-2", status: "ROLLED_OVER", synopsis: "Later year." },
        },
        {
          id: "app-0",
          reference: "TS-TEST01",
          migrationSource: null,
          academicYear: "2025/26",
          assessment: { id: "ass-0", status: "NEW_AWARD", synopsis: "" },
        },
        {
          id: "app-1",
          reference: "TS-TEST01",
          migrationSource: null,
          academicYear: "2026/27",
          assessment: { id: "ass-1", status: "ROLLED_OVER", synopsis: "First with text." },
        },
      ],
    });
    expect(decideSeed(a)).toMatchObject({ action: "SEED", assessmentId: "ass-1", academicYear: "2026/27" });
  });
});

describe("supabaseProjectRef", () => {
  const ref = "abcdefghijklmnopqrst";
  it("reads the pooler username", () => {
    expect(supabaseProjectRef(`postgresql://postgres.${ref}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`)).toBe(ref);
    expect(supabaseProjectRef(`postgresql://app_user.${ref}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`)).toBe(ref);
  });
  it("reads the direct host", () => {
    expect(supabaseProjectRef(`postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`)).toBe(ref);
  });
  it("returns null for anything else", () => {
    expect(supabaseProjectRef(undefined)).toBeNull();
    expect(supabaseProjectRef("postgresql://postgres:pw@localhost:5432/postgres")).toBeNull();
    expect(supabaseProjectRef("not a url")).toBeNull();
  });
});
