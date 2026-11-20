import { describe, it, expect } from "vitest";
import { safeNext } from "../safe-next";

/**
 * Audit 20 Nov 2026 (finding 14): `/login?next=/%09/evil.com` arrives as
 * "/\t/evil.com"; the old prefix check let it through and
 * `new URL("/\t/evil.com", origin)` lands on https://evil.com/.
 */
describe("safeNext", () => {
  it.each([
    ["/\t/evil.com", "tab after the slash (decoded %09)"],
    ["/\n/evil.com", "newline after the slash (decoded %0A)"],
    ["//evil.com", "protocol-relative"],
    ["/\\evil.com", "backslash"],
    ["https://evil.com", "absolute URL"],
    ["javascript:alert(1)", "javascript: URL"],
  ])("refuses %j (%s)", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("never yields a target that leaves the site", () => {
    for (const raw of ["/\t/evil.com", "/\r\n/evil.com", "/\\/evil.com", "//evil.com"]) {
      const target = new URL(safeNext(raw), "https://bursary.example");
      expect(target.origin).toBe("https://bursary.example");
    }
  });

  it("keeps an internal path with its query and hash", () => {
    expect(safeNext("/apply?x=1#y")).toBe("/apply?x=1#y");
    expect(safeNext("/admin")).toBe("/admin");
  });

  it("falls back for empty or missing values", () => {
    expect(safeNext("")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });

  it("uses the caller's fallback", () => {
    expect(safeNext(null, "/admin")).toBe("/admin");
    expect(safeNext("/\t/evil.com", "/admin")).toBe("/admin");
  });
});
