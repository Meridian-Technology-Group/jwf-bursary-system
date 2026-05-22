/**
 * Staff MFA enforcement feature flag (B8 / MSA Schedule 4 §8).
 *
 * Controls whether staff roles {ADMIN, ASSESSOR, VIEWER} are *forced* through
 * the aal2 (TOTP) gate. The /login/mfa enrol + challenge route stays reachable
 * regardless of this flag — only the forced enforcement (middleware redirect +
 * staff login redirect) is gated here.
 *
 * Signal (per b8 "Decision: feature-flag", 2026-05-22):
 *  - `STAFF_MFA_ENFORCED` env var, when set, is authoritative:
 *      "true" / "1"  → enforced
 *      anything else  → NOT enforced (acts as a prod kill-switch)
 *  - When `STAFF_MFA_ENFORCED` is unset, default to enforcing only in the
 *    Vercel **Production** environment (`VERCEL_ENV === "production"`).
 *
 * We deliberately do NOT key off `NODE_ENV`: staging is also a production build
 * (`NODE_ENV=production`) pointed at the nonprod Supabase project, so NODE_ENV
 * cannot distinguish prod from staging. `VERCEL_ENV` can ("production" vs
 * "preview" vs "development").
 *
 * Result:
 *  - Prod:           on by default (can't forget to enable it).
 *  - Staging/local:  off by default (testing isn't blocked); set
 *                    STAFF_MFA_ENFORCED=true to run a real pre-prod smoke test.
 *
 * Reads only `process.env`, so it is safe to call from the Edge middleware as
 * well as server components / actions.
 */
export function isStaffMfaEnforced(): boolean {
  const override = process.env.STAFF_MFA_ENFORCED?.trim().toLowerCase();
  if (override !== undefined && override !== "") {
    return override === "true" || override === "1";
  }
  return process.env.VERCEL_ENV === "production";
}
