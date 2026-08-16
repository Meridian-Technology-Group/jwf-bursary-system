import { describe, expect, it } from "vitest";

import {
  DEFAULT_IDLE_MINUTES,
  DEFAULT_WARN_SECONDS,
  PORTAL_IDLE_MINUTES,
  resolveIdleTimeoutConfig,
} from "../idle-timeout";

/**
 * Epic 11 (D20) — idle-logout config resolver.
 *
 * Drives every branch of `resolveIdleTimeoutConfig` from a plain env record, so
 * the timing/parsing logic is verified without a DOM or global-env mutation.
 */
describe("resolveIdleTimeoutConfig", () => {
  const MIN = 60_000;

  it("defaults to enabled, 30 min idle, 60 s warning when nothing is set", () => {
    const cfg = resolveIdleTimeoutConfig({});
    expect(cfg.enabled).toBe(true);
    expect(cfg.idleMs).toBe(DEFAULT_IDLE_MINUTES * MIN);
    expect(cfg.warnMs).toBe(DEFAULT_WARN_SECONDS * 1000);
  });

  describe("enable/disable flag (default ON)", () => {
    it.each(["false", "0", "off", "no", "FALSE", "  Off  "])(
      'is disabled by "%s"',
      (val) => {
        expect(
          resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_ENABLED: val })
            .enabled
        ).toBe(false);
      }
    );

    it.each(["true", "1", "", "yes", "anything"])(
      'stays enabled for "%s" (only explicit off-values disable)',
      (val) => {
        expect(
          resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_ENABLED: val })
            .enabled
        ).toBe(true);
      }
    );
  });

  describe("idle window (minutes)", () => {
    it("honours a valid override", () => {
      expect(
        resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: "15" })
          .idleMs
      ).toBe(15 * MIN);
    });

    it("clamps below 1 minute up to 1", () => {
      expect(
        resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: "0" })
          .idleMs
      ).toBe(1 * MIN);
    });

    it("clamps above the 720-minute ceiling", () => {
      expect(
        resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: "5000" })
          .idleMs
      ).toBe(720 * MIN);
    });

    it.each(["", "abc", "12.5", "30m", "-5"])(
      'falls back to the default for malformed value "%s"',
      (val) => {
        expect(
          resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: val })
            .idleMs
        ).toBe(DEFAULT_IDLE_MINUTES * MIN);
      }
    );
  });

  describe("caller default window (CG-12 — the portal's 60 minutes)", () => {
    it("uses the caller's default when the env var is unset", () => {
      expect(
        resolveIdleTimeoutConfig({}, { idleMinutes: PORTAL_IDLE_MINUTES })
          .idleMs
      ).toBe(60 * MIN);
    });

    it("lets the env override beat the caller's default", () => {
      expect(
        resolveIdleTimeoutConfig(
          { NEXT_PUBLIC_SESSION_IDLE_MINUTES: "15" },
          { idleMinutes: PORTAL_IDLE_MINUTES }
        ).idleMs
      ).toBe(15 * MIN);
    });

    it("uses the caller's default when the env value is malformed", () => {
      expect(
        resolveIdleTimeoutConfig(
          { NEXT_PUBLIC_SESSION_IDLE_MINUTES: "60m" },
          { idleMinutes: PORTAL_IDLE_MINUTES }
        ).idleMs
      ).toBe(60 * MIN);
    });

    it("still falls back to the global default with no caller default", () => {
      expect(resolveIdleTimeoutConfig({}).idleMs).toBe(
        DEFAULT_IDLE_MINUTES * MIN
      );
    });
  });

  describe("warning countdown (seconds)", () => {
    it("honours a valid override", () => {
      expect(
        resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS: "90" })
          .warnMs
      ).toBe(90 * 1000);
    });

    it("clamps below the 5-second floor", () => {
      expect(
        resolveIdleTimeoutConfig({ NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS: "1" })
          .warnMs
      ).toBe(5 * 1000);
    });

    it("never exceeds the idle window minus one second", () => {
      // 1-min idle window → warning capped at 59 s, even if asked for 120 s.
      const cfg = resolveIdleTimeoutConfig({
        NEXT_PUBLIC_SESSION_IDLE_MINUTES: "1",
        NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS: "120",
      });
      expect(cfg.idleMs).toBe(1 * MIN);
      expect(cfg.warnMs).toBe(59 * 1000);
      expect(cfg.warnMs).toBeLessThan(cfg.idleMs);
    });

    it("always keeps warnMs strictly less than idleMs at the default", () => {
      const cfg = resolveIdleTimeoutConfig({});
      expect(cfg.warnMs).toBeLessThan(cfg.idleMs);
    });
  });
});
