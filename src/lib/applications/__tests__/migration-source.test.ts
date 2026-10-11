import { describe, expect, it } from "vitest";
import {
  MIGRATION_SOURCES,
  PORTAL_APPLICATION,
  isMigrated,
} from "../migration-source";

describe("migration source (GT migration, E5)", () => {
  it("an application created in this system is not migrated", () => {
    expect(isMigrated({ migrationSource: null })).toBe(false);
  });

  it.each(Object.values(MIGRATION_SOURCES))("%s is migrated", (source) => {
    expect(isMigrated({ migrationSource: source })).toBe(true);
  });

  it("the portal filter keeps only applications created in this system", () => {
    expect(PORTAL_APPLICATION).toEqual({ migrationSource: null });
  });
});
