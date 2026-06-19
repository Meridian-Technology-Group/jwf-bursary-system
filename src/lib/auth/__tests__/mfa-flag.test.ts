import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isStaffMfaEnforced } from "../mfa-flag";

/**
 * Epic 11 (D20 sibling task) — MFA env-gating *verification*.
 *
 * `isStaffMfaEnforced()` is the single switch that decides whether staff
 * (ADMIN / ASSESSOR / VIEWER) are forced through the aal2 (TOTP) gate in the
 * middleware. The client demo asked for "MFA off in staging/test, on in prod";
 * these tests pin that the existing flag already delivers exactly that, so a
 * future refactor cannot silently re-enable it on staging or disable it in prod.
 *
 * Contract (mfa-flag.ts):
 *   - `STAFF_MFA_ENFORCED` set       → authoritative ("true"/"1" → on, else off).
 *   - `STAFF_MFA_ENFORCED` unset/""  → on iff `VERCEL_ENV === "production"`.
 */
const KEYS = ["STAFF_MFA_ENFORCED", "VERCEL_ENV"] as const;

describe("isStaffMfaEnforced", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("default (STAFF_MFA_ENFORCED unset) — the intended posture", () => {
    it("is ON in Vercel production", () => {
      process.env.VERCEL_ENV = "production";
      expect(isStaffMfaEnforced()).toBe(true);
    });

    it("is OFF on a Vercel preview (staging) deployment", () => {
      process.env.VERCEL_ENV = "preview";
      expect(isStaffMfaEnforced()).toBe(false);
    });

    it("is OFF in Vercel development", () => {
      process.env.VERCEL_ENV = "development";
      expect(isStaffMfaEnforced()).toBe(false);
    });

    it("is OFF when VERCEL_ENV is absent (local dev / test / CI)", () => {
      expect(isStaffMfaEnforced()).toBe(false);
    });
  });

  describe("explicit override — STAFF_MFA_ENFORCED is authoritative", () => {
    it('forces ON with "true" even on a preview deployment (the pre-prod smoke-test path)', () => {
      process.env.VERCEL_ENV = "preview";
      process.env.STAFF_MFA_ENFORCED = "true";
      expect(isStaffMfaEnforced()).toBe(true);
    });

    it('forces ON with "1"', () => {
      process.env.STAFF_MFA_ENFORCED = "1";
      expect(isStaffMfaEnforced()).toBe(true);
    });

    it('forces OFF with "false" even in production (the prod kill-switch)', () => {
      process.env.VERCEL_ENV = "production";
      process.env.STAFF_MFA_ENFORCED = "false";
      expect(isStaffMfaEnforced()).toBe(false);
    });

    it('forces OFF with "0" in production', () => {
      process.env.VERCEL_ENV = "production";
      process.env.STAFF_MFA_ENFORCED = "0";
      expect(isStaffMfaEnforced()).toBe(false);
    });

    it("treats any non-truthy string as OFF (fail-safe to not-enforced)", () => {
      process.env.VERCEL_ENV = "production";
      process.env.STAFF_MFA_ENFORCED = "yes";
      expect(isStaffMfaEnforced()).toBe(false);
    });

    it("is case-insensitive and trims surrounding whitespace", () => {
      process.env.STAFF_MFA_ENFORCED = "  TRUE  ";
      expect(isStaffMfaEnforced()).toBe(true);
    });

    it('treats an empty string as unset (falls back to the VERCEL_ENV default)', () => {
      process.env.VERCEL_ENV = "production";
      process.env.STAFF_MFA_ENFORCED = "";
      expect(isStaffMfaEnforced()).toBe(true);
    });
  });
});
