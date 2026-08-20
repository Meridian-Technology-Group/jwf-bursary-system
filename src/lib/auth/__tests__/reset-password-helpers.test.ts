import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  mapAuthCallbackError,
  postUpdateDestination,
  validateNewPassword,
} from "../reset-password-helpers";

// HIBP is network-bound; stub fetch so strength checks are deterministic.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, text: async () => "" }) as Response)
  );
});

describe("validateNewPassword", () => {
  it("rejects a mismatched confirmation before anything else", async () => {
    const result = await validateNewPassword("a-long-enough-password", "different");
    expect(result).toEqual({ ok: false, reason: "The passwords do not match." });
  });

  it("rejects passwords under 12 characters", async () => {
    const result = await validateNewPassword("short", "short");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("12 characters");
    }
  });

  it("accepts a matching 12+ character password", async () => {
    const result = await validateNewPassword(
      "a-long-enough-password",
      "a-long-enough-password"
    );
    expect(result).toEqual({ ok: true });
  });
});

describe("mapAuthCallbackError", () => {
  it("maps both callback failure codes to the same human message", () => {
    const missing = mapAuthCallbackError("missing_code");
    const failed = mapAuthCallbackError("session_exchange_failed");
    expect(missing).toBeTruthy();
    expect(failed).toBe(missing);
    expect(missing).toContain("expired");
  });

  it("returns null for unknown or absent codes (nothing leaks to the UI)", () => {
    expect(mapAuthCallbackError(null)).toBeNull();
    expect(mapAuthCallbackError("")).toBeNull();
    expect(mapAuthCallbackError("some_internal_thing")).toBeNull();
  });
});

describe("postUpdateDestination", () => {
  it("sends staff roles to /admin", () => {
    expect(postUpdateDestination("ADMIN")).toBe("/admin");
    expect(postUpdateDestination("ASSESSOR")).toBe("/admin");
    expect(postUpdateDestination("VIEWER")).toBe("/admin");
  });

  it("sends applicants and unknown roles to the portal home", () => {
    expect(postUpdateDestination("APPLICANT")).toBe("/");
    expect(postUpdateDestination(undefined)).toBe("/");
  });
});
