// Epic 14 E2 (CG-04) — the active-application preference in the portal's
// application resolvers. The isolation contract: the preferred id is folded
// into the SAME ownership/status WHERE, so a stale/foreign id can never
// resolve another family's (or a submitted) application — it just falls
// back to the legacy most-recent resolution.

import { describe, expect, it, vi } from "vitest";
import type { Tx } from "@/lib/db/prisma";
import {
  getApplicationForUser,
  getCurrentApplicationForUser,
  getPortalNavState,
} from "../applications";

type FindFirstCall = { where: Record<string, unknown> };

function fakeTx(resultsByCall: (unknown | null)[]) {
  const calls: FindFirstCall[] = [];
  let i = 0;
  const findFirst = vi.fn(async (args: FindFirstCall) => {
    calls.push(args);
    return resultsByCall[i++] ?? null;
  });
  return { tx: { application: { findFirst } } as unknown as Tx, calls };
}

describe("getApplicationForUser (draft resolver)", () => {
  it("uses the preferred id WITH ownership + draft filters intact", async () => {
    const { tx, calls } = fakeTx([{ id: "app-b" }]);
    const result = await getApplicationForUser(tx, "user-1", "app-b");
    expect(result).toEqual({ id: "app-b" });
    expect(calls).toHaveLength(1);
    expect(calls[0].where).toMatchObject({
      id: "app-b",
      leadApplicantId: "user-1",
      formStatus: { not: "SUBMITTED" },
    });
  });

  it("falls back to most-recent when the preferred id misses the WHERE", async () => {
    const { tx, calls } = fakeTx([null, { id: "app-a" }]);
    const result = await getApplicationForUser(tx, "user-1", "foreign-app");
    expect(result).toEqual({ id: "app-a" });
    expect(calls).toHaveLength(2);
    // The fallback is the pre-E2 query: ownership + draft filter, no id.
    expect(calls[1].where).toEqual({
      leadApplicantId: "user-1",
      formStatus: { not: "SUBMITTED" },
    });
  });

  it("no preference → single legacy query (pre-E2 behaviour)", async () => {
    const { tx, calls } = fakeTx([{ id: "app-a" }]);
    await getApplicationForUser(tx, "user-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].where).toEqual({
      leadApplicantId: "user-1",
      formStatus: { not: "SUBMITTED" },
    });
  });
});

describe("getCurrentApplicationForUser (any-status resolver)", () => {
  it("prefers the active application with ownership intact", async () => {
    const { tx, calls } = fakeTx([{ id: "app-b" }]);
    const result = await getCurrentApplicationForUser(tx, "user-1", "app-b");
    expect(result).toEqual({ id: "app-b" });
    expect(calls[0].where).toMatchObject({
      id: "app-b",
      leadApplicantId: "user-1",
    });
  });

  it("stale preference falls back to most-recent", async () => {
    const { tx, calls } = fakeTx([null, { id: "app-a" }]);
    const result = await getCurrentApplicationForUser(tx, "user-1", "gone");
    expect(result).toEqual({ id: "app-a" });
    expect(calls).toHaveLength(2);
  });
});

describe("getPortalNavState", () => {
  it("describes the preferred application when it matches", async () => {
    const { tx, calls } = fakeTx([{ formStatus: "SUBMITTED" }]);
    const nav = await getPortalNavState(tx, "user-1", "app-b");
    expect(nav).toEqual({ formStatus: "SUBMITTED" });
    expect(calls[0].where).toMatchObject({
      id: "app-b",
      leadApplicantId: "user-1",
    });
  });

  it("falls back and still returns null with no applications", async () => {
    const { tx } = fakeTx([null, null]);
    expect(await getPortalNavState(tx, "user-1", "gone")).toBeNull();
  });
});
