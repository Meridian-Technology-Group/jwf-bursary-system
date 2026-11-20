import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * getCurrentUser runs in the admin layout AND in every page's requireRole.
 * Wrapped in React `cache`, one render must make ONE auth.getUser() call and
 * ONE profile read, however many times it is asked.
 *
 * Plain react@18 (what vitest loads) has no `cache`, so this stands in a
 * per-request memo with React's semantics: keyed on the function, cleared
 * between requests.
 */
const { requestCache } = vi.hoisted(() => ({ requestCache: new Map<unknown, unknown>() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      if (!requestCache.has(fn)) requestCache.set(fn, fn(...args));
      return requestCache.get(fn);
    },
}));

const getUserMock = vi.fn(async () => ({
  data: { user: { id: "u-1", last_sign_in_at: "2026-11-20T09:00:00.000Z" } },
  error: null,
}));
vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));

const PROFILE = {
  id: "u-1",
  email: "admin@example.test",
  role: "ADMIN",
  firstName: "Ada",
  lastName: "Admin",
  phone: null,
};
const findUniqueMock = vi.fn(async (_args: unknown) => PROFILE);
vi.mock("@/lib/db/prisma", () => ({
  withAdminContext: (fn: (tx: unknown) => unknown) =>
    fn({ profile: { findUnique: findUniqueMock } }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));

import { getCurrentUser, requireRole, Role } from "../roles";

beforeEach(() => {
  vi.clearAllMocks();
  requestCache.clear();
});

describe("getCurrentUser — once per request", () => {
  it("layout + page: two calls make one auth round-trip and one profile read", async () => {
    const first = await getCurrentUser();
    const second = await getCurrentUser();

    expect(first).toEqual({ ...PROFILE, authLastSignInAt: "2026-11-20T09:00:00.000Z" });
    expect(second).toEqual(first);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });

  it("requireRole shares the same lookup", async () => {
    await getCurrentUser();
    const user = await requireRole([Role.ADMIN]);

    expect(user.id).toBe("u-1");
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });

  it("a new request reads again (nothing is held across requests)", async () => {
    await getCurrentUser();
    requestCache.clear();
    await getCurrentUser();

    expect(getUserMock).toHaveBeenCalledTimes(2);
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });
});
