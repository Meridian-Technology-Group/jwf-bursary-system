import { describe, expect, it } from "vitest";

import {
  MFA_TRUST_MAX_AGE_SECONDS,
  signMfaTrust,
  verifiedFactorIds,
  verifyMfaTrust,
} from "../mfa-trust";

const secret = "x".repeat(40);
const now = Date.UTC(2026, 10, 23);
const chrome130 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const chrome131 = chrome130.replace("130.0.0.0", "131.0.6778.86");
const firefox =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";

const issued = { userId: "user-1", factorId: "factor-1", userAgent: chrome130, country: "GB" };
const check = { userId: "user-1", verifiedFactorIds: ["factor-1"], userAgent: chrome130, country: "GB" };

async function token(opts = { secret, now }) {
  const t = await signMfaTrust(issued, opts);
  expect(t).toBeTruthy();
  return t!;
}

describe("mfa-trust", () => {
  it("accepts a fresh cookie on the same browser, user, factor and country", async () => {
    expect(await verifyMfaTrust(await token(), check, { secret, now })).toBe(true);
  });

  it("survives a browser version update", async () => {
    expect(
      await verifyMfaTrust(await token(), { ...check, userAgent: chrome131 }, { secret, now }),
    ).toBe(true);
  });

  it.each([
    ["another user", { ...check, userId: "user-2" }],
    ["a removed factor (Reset MFA)", { ...check, verifiedFactorIds: ["factor-2"] }],
    ["another browser", { ...check, userAgent: firefox }],
    ["another country", { ...check, country: "FR" }],
  ])("rejects %s", async (_label, ctx) => {
    expect(await verifyMfaTrust(await token(), ctx, { secret, now })).toBe(false);
  });

  it("expires after the trust window", async () => {
    const t = await token();
    const justBefore = now + (MFA_TRUST_MAX_AGE_SECONDS - 1) * 1000;
    const after = now + MFA_TRUST_MAX_AGE_SECONDS * 1000;
    expect(await verifyMfaTrust(t, check, { secret, now: justBefore })).toBe(true);
    expect(await verifyMfaTrust(t, check, { secret, now: after })).toBe(false);
  });

  it("rejects a tampered or foreign-signed cookie", async () => {
    const t = await token();
    const [body, sig] = t.split(".");
    const forged = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    forged.u = "user-2";
    const forgedBody = btoa(JSON.stringify(forged)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifyMfaTrust(`${forgedBody}.${sig}`, { ...check, userId: "user-2" }, { secret, now })).toBe(false);
    expect(await verifyMfaTrust(t, check, { secret: "y".repeat(40), now })).toBe(false);
    expect(await verifyMfaTrust("garbage", check, { secret, now })).toBe(false);
    expect(await verifyMfaTrust(undefined, check, { secret, now })).toBe(false);
  });

  it("is off (fail closed) without a secret of at least 32 chars", async () => {
    expect(await signMfaTrust(issued, { secret: "short", now })).toBeNull();
    expect(await verifyMfaTrust(await token(), check, { secret: "", now })).toBe(false);
  });

  it("verifiedFactorIds keeps only verified factors", () => {
    expect(
      verifiedFactorIds({
        factors: [
          { id: "a", status: "verified" },
          { id: "b", status: "unverified" },
        ],
      }),
    ).toEqual(["a"]);
    expect(verifiedFactorIds({})).toEqual([]);
  });
});
