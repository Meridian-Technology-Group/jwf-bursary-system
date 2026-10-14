import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ withAdminContext: vi.fn() }));

import { recordSignIn } from "../sign-in-times";

const at = (iso: string) => new Date(iso);

describe("recordSignIn (Epic 22 P1, D-5)", () => {
  it("records the first sign-in with no previous one", () => {
    expect(
      recordSignIn(
        { lastSignInAt: null, previousSignInAt: null },
        at("2026-10-14T08:00:00Z")
      )
    ).toEqual({
      lastSignInAt: at("2026-10-14T08:00:00Z"),
      previousSignInAt: null,
    });
  });

  it("shifts last → previous on a newer sign-in", () => {
    expect(
      recordSignIn(
        {
          lastSignInAt: at("2026-10-11T21:26:00Z"),
          previousSignInAt: at("2026-10-01T09:00:00Z"),
        },
        at("2026-10-14T08:00:00Z")
      )
    ).toEqual({
      lastSignInAt: at("2026-10-14T08:00:00Z"),
      previousSignInAt: at("2026-10-11T21:26:00Z"),
    });
  });

  it("changes nothing for the same sign-in (every later page load)", () => {
    const t = at("2026-10-14T08:00:00Z");
    expect(recordSignIn({ lastSignInAt: t, previousSignInAt: null }, t)).toBeNull();
  });

  it("ignores an older or missing auth time", () => {
    expect(
      recordSignIn(
        { lastSignInAt: at("2026-10-14T08:00:00Z"), previousSignInAt: null },
        at("2026-10-13T08:00:00Z")
      )
    ).toBeNull();
    expect(
      recordSignIn({ lastSignInAt: null, previousSignInAt: null }, null)
    ).toBeNull();
    expect(
      recordSignIn({ lastSignInAt: null, previousSignInAt: null }, new Date("x"))
    ).toBeNull();
  });
});
