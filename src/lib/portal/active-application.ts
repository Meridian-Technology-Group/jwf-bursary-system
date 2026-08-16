/**
 * active-application.ts — Epic 14 E2 (CG-04/02, US-E2): the portal's explicit
 * per-application context.
 *
 * One login can lead several children's applications (E1). Every portal read
 * used to resolve "the application" implicitly as the profile's most recently
 * updated row — with two children that silently follows whichever application
 * was touched last (including by an admin), so autosaves and submits could
 * land on the wrong child.
 *
 * The context is an httpOnly cookie holding an application id. It is a
 * PREFERENCE, never an authority: every consumer passes it into a query that
 * still carries the full ownership/status WHERE (leadApplicantId = user.id
 * etc.), so a stale/foreign/tampered cookie simply fails the match and the
 * legacy most-recent resolution takes over. Old links keep working — with no
 * cookie set, behaviour is byte-identical to before E2.
 *
 * Set points: the /apply/open/[applicationId] route (the schedule's CONTINUE
 * buttons), and the create paths (start application / begin re-assessment)
 * so a freshly created application immediately becomes the context.
 */

import { cookies } from "next/headers";

export const ACTIVE_APPLICATION_COOKIE = "jwf-active-application";

/** The cookie'd application-id preference, or null. Server-only. */
export async function getActiveApplicationId(): Promise<string | null> {
  let value: string | undefined;
  try {
    const store = await cookies();
    value = store.get(ACTIVE_APPLICATION_COOKIE)?.value;
  } catch {
    // Outside a request scope (unit tests, background work): no preference —
    // callers fall back to the legacy most-recent resolution.
    return null;
  }
  // Application ids are uuids; anything else is a tampered/corrupt cookie.
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/**
 * Sets the active-application cookie. Callable only where Next allows cookie
 * writes (server actions, route handlers).
 */
export async function setActiveApplicationId(applicationId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_APPLICATION_COOKIE, applicationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Session-length is enough: the context re-establishes on every open.
  });
}
