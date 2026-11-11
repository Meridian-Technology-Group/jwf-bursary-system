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

import { ensureApplicantLogin, provisionApplicantAuthUser } from "../provision-applicant";
import type { SupabaseClient } from "@supabase/supabase-js";

type GetUserById = (id: string) => Promise<{
  data: { user: { id: string } | null };
  error: { message: string; status?: number; code?: string } | null;
}>;

const loginExists: GetUserById = async (id) => ({ data: { user: { id } }, error: null });
const loginMissing: GetUserById = async () => ({
  data: { user: null },
  error: { message: "User not found", status: 404, code: "user_not_found" },
});

function fakeSupabase(overrides: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createUser?: (attrs: any) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  listUsersPages?: { users: { id: string; email: string }[] }[];
  getUserById?: GetUserById;
}) {
  let page = 0;
  return {
    auth: {
      admin: {
        getUserById: overrides.getUserById ?? loginExists,
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

describe("orphaned profile — the login was deleted by a failed-send rollback (11 Nov 2026)", () => {
  it("provisioning RECREATES the missing login under the profile's id", async () => {
    currentProfile = { id: "parent-1", role: "APPLICANT" };
    const created: Array<Record<string, unknown>> = [];
    const supabase = fakeSupabase({
      getUserById: loginMissing,
      createUser: async (attrs) => {
        created.push(attrs);
        return { data: { user: { id: "parent-1" } }, error: null };
      },
    });

    const result = await provisionApplicantAuthUser(supabase, "parent@example.com");

    expect(result).toEqual({ ok: true, authUserId: "parent-1", created: false });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: "parent-1",
      email: "parent@example.com",
      email_confirm: true,
      app_metadata: { role: "APPLICANT" },
    });
  });

  it("ensureApplicantLogin leaves an existing login alone", async () => {
    const supabase = fakeSupabase({
      createUser: async () => {
        throw new Error("must not create when the login exists");
      },
    });
    expect(await ensureApplicantLogin(supabase, "u1", "a@example.com")).toEqual({
      ok: true,
      recreated: false,
    });
  });

  it("ensureApplicantLogin restores with the parent's chosen password at registration", async () => {
    let attrs: Record<string, unknown> | undefined;
    const supabase = fakeSupabase({
      getUserById: loginMissing,
      createUser: async (a) => {
        attrs = a;
        return { data: { user: { id: "u1" } }, error: null };
      },
    });
    const result = await ensureApplicantLogin(supabase, "u1", " a@example.com ", "chosen-pw");
    expect(result).toEqual({ ok: true, recreated: true });
    expect(attrs).toMatchObject({ id: "u1", email: "a@example.com", password: "chosen-pw" });
  });

  it("never recreates on a lookup error that is not 'not found'", async () => {
    const supabase = fakeSupabase({
      getUserById: async () => ({
        data: { user: null },
        error: { message: "service unavailable", status: 503 },
      }),
      createUser: async () => {
        throw new Error("must not create on an ambiguous lookup failure");
      },
    });
    expect(await ensureApplicantLogin(supabase, "u1", "a@example.com")).toEqual({
      ok: false,
      error: "service unavailable",
    });
  });
});
