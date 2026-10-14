/**
 * Epic 22 P1 (D-5) — the family's "Last login" on My Bursary Application(s).
 *
 * Supabase keeps only the CURRENT sign-in (`auth.users.last_sign_in_at`), which
 * is useless as "when did I last log in?" — it is always "just now". So the
 * profile remembers two values and shifts them when Supabase reports a newer
 * sign-in:
 *
 *   previous ← last, last ← auth's value
 *
 * The shift runs from the portal layout (every parent page), not from each
 * sign-in form, so every sign-in path (password, register, re-assessment link,
 * password reset) is covered without wiring each one.
 */

import { withAdminContext } from "@/lib/db/prisma";

export interface SignInTimes {
  lastSignInAt: Date | null;
  previousSignInAt: Date | null;
}

/**
 * Pure: the profile's new sign-in times given Supabase's current sign-in, or
 * null when nothing changes (no sign-in known, or not newer than the one
 * already recorded).
 */
export function recordSignIn(
  current: SignInTimes,
  authLastSignInAt: Date | null
): SignInTimes | null {
  if (!authLastSignInAt || Number.isNaN(authLastSignInAt.getTime())) return null;
  if (
    current.lastSignInAt &&
    authLastSignInAt.getTime() <= current.lastSignInAt.getTime()
  ) {
    return null;
  }
  return {
    lastSignInAt: authLastSignInAt,
    previousSignInAt: current.lastSignInAt,
  };
}

/**
 * Copies Supabase's latest sign-in onto the profile when it is new. Usually a
 * single read that changes nothing. The write is guarded on the value it read,
 * so two pages loading at once after a sign-in shift the times only once.
 *
 * Admin context: the read and write are hard-scoped to this profile's id.
 * Never throws: it runs on every parent page, and "Last login" is not worth
 * breaking the portal for.
 */
export async function syncSignInTimes(
  profileId: string,
  authLastSignInAt: string | null | undefined
): Promise<void> {
  if (!authLastSignInAt) return;
  const authLast = new Date(authLastSignInAt);
  await withAdminContext(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      select: { lastSignInAt: true, previousSignInAt: true },
    });
    if (!profile) return;
    const next = recordSignIn(profile, authLast);
    if (!next) return;
    await tx.profile.updateMany({
      where: { id: profileId, lastSignInAt: profile.lastSignInAt },
      data: next,
    });
  }).catch((err) => {
    console.error("[auth] syncSignInTimes failed:", err);
  });
}
