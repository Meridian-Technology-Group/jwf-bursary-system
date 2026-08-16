// Epic 14 E1 (CG-04) — one applicant auth user per email.

import { beforeEach, describe, expect, it, vi } from "vitest";

const profileRow: { id: string; role: string } | null | "unset" = "unset";
let currentProfile: { id: string; role: string } | null = null;

vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (cb: (tx: unknown) => unknown) =>
    cb({
      profile: {
        findFirst: async () => currentProfile,
      },
    }),
}));

import { provisionApplicantAuthUser } from "../provision-applicant";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(overrides: {
  createUser?: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  listUsersPages?: { users: { id: string; email: string }[] }[];
}) {
  let page = 0;
  return {
    auth: {
      admin: {
        createUser:
          overrides.createUser ??
          (async () => ({ data: { user: { id: "new-user" } }, error: null })),
        listUsers: async () => {
          const data = overrides.listUsersPages?.[page] ?? { users: [] };
          page++;
          return { data, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  currentProfile = null;
});

describe("provisionApplicantAuthUser", () => {
  it("REUSES an existing APPLICANT profile — Charlotte's second-child case", async () => {
    currentProfile = { id: "parent-1", role: "APPLICANT" };
    const supabase = fakeSupabase({
      createUser: async () => {
        throw new Error("must not create when a profile exists");
      },
    });

    const result = await provisionApplicantAuthUser(supabase, "parent@example.com");
    expect(result).toEqual({ ok: true, authUserId: "parent-1", created: false });
  });

  it("refuses a staff email outright", async () => {
    currentProfile = { id: "staff-1", role: "ADMIN" };
    const result = await provisionApplicantAuthUser(
      fakeSupabase({}),
      "admin@example.com"
    );
    expect(result.ok).toBe(false);
  });

  it("creates a fresh auth user for a genuinely new email", async () => {
    const result = await provisionApplicantAuthUser(
      fakeSupabase({}),
      "new@example.com"
    );
    expect(result).toEqual({ ok: true, authUserId: "new-user", created: true });
  });

  it("recovers a half-provisioned auth user (exists in auth, no profile)", async () => {
    const supabase = fakeSupabase({
      createUser: async () => ({
        data: { user: null },
        error: { message: "A user with this email address has already been registered" },
      }),
      listUsersPages: [
        { users: [{ id: "orphan-1", email: "orphan@example.com" }] },
      ],
    });

    const result = await provisionApplicantAuthUser(supabase, "orphan@example.com");
    expect(result).toEqual({ ok: true, authUserId: "orphan-1", created: false });
  });

  it("surfaces other createUser failures", async () => {
    const supabase = fakeSupabase({
      createUser: async () => ({
        data: { user: null },
        error: { message: "rate limited" },
      }),
    });
    const result = await provisionApplicantAuthUser(supabase, "x@example.com");
    expect(result).toEqual({ ok: false, error: "rate limited" });
  });
});
