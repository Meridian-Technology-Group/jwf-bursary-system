import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAppUrl } from "../app-url";

const KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
] as const;

describe("getAppUrl", () => {
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

  it("returns localhost when no env vars are set", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("prefers NEXT_PUBLIC_APP_URL over every fallback", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    process.env.VERCEL_URL = "deploy.vercel.app";
    expect(getAppUrl()).toBe("https://custom.example");
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL only when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    expect(getAppUrl()).toBe("https://prod.vercel.app");
  });

  it("falls through to VERCEL_BRANCH_URL on preview deploys even if production URL is set", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    expect(getAppUrl()).toBe("https://branch.vercel.app");
  });

  it("falls through to VERCEL_URL when branch URL is missing", () => {
    process.env.VERCEL_URL = "deploy.vercel.app";
    expect(getAppUrl()).toBe("https://deploy.vercel.app");
  });
});
