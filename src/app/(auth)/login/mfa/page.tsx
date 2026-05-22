/**
 * /login/mfa — staff MFA (TOTP) enrolment & challenge (B8).
 *
 * Server component. Decides between two flows based on the user's existing
 * factors:
 *  - No verified TOTP factor → SETUP: enroll a TOTP factor and render its
 *    QR code + plaintext secret, then take the first 6-digit code to verify.
 *  - A verified TOTP factor   → CHALLENGE: take a 6-digit code to elevate
 *    the session to aal2.
 *
 * Only staff roles (ADMIN / ASSESSOR / VIEWER) ever land here. An
 * unauthenticated visitor is sent to /login; an APPLICANT (who is never
 * gated on aal2) is sent to the portal home.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { MfaSetupForm } from "./mfa-setup-form";
import { MfaChallengeForm } from "./mfa-challenge-form";

function isStaffRole(role: unknown): boolean {
  return role === "ADMIN" || role === "ASSESSOR" || role === "VIEWER";
}

/** Validate a `next` redirect target (internal paths only). */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/admin";
  }
  return raw;
}

export const metadata = {
  title: "Two-factor authentication",
};

export default async function MfaPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = safeNext(searchParams.next);
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) {
    // APPLICANTs are never required to do MFA — bounce them home.
    redirect("/");
  }

  // Already at aal2? Nothing to do — send them on.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect(nextPath);
  }

  const { data: factorsData, error: factorsError } =
    await supabase.auth.mfa.listFactors();

  if (factorsError) {
    return (
      <div className="space-y-4">
        <h1 className="text-center text-2xl font-semibold text-slate-800">
          Two-factor authentication
        </h1>
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load your authentication factors: {factorsError.message}
        </p>
      </div>
    );
  }

  const totpFactors = factorsData?.totp ?? [];
  const verifiedFactor = totpFactors.find((f) => f.status === "verified");

  // --- CHALLENGE path: a verified TOTP factor already exists. ---
  if (verifiedFactor) {
    return (
      <MfaChallengeForm factorId={verifiedFactor.id} nextPath={nextPath} />
    );
  }

  // --- SETUP path: no verified factor. ---
  // Make enrolment idempotent (B8 rough edge): the first /login/mfa hit can
  // leave a dangling UNVERIFIED factor, and a second enroll() then fails with
  // "A factor with the friendly name … already exists". Clear stale unverified
  // TOTP factors before enrolling a fresh one.
  //
  // IMPORTANT: iterate `factorsData.all`, not `factorsData.totp`. The Supabase
  // JS client only populates `.totp` with *verified* factors (see auth-js
  // _listFactors: it pushes into data[factor_type] only when status ===
  // 'verified'); unverified factors appear solely in `.all`. Iterating `.totp`
  // here would never match an unverified factor, so the cleanup would no-op and
  // the duplicate-factor error would persist.
  const staleUnverified = (factorsData?.all ?? []).filter(
    (f) => f.factor_type === "totp" && f.status !== "verified"
  );
  for (const stale of staleUnverified) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  // Use a unique friendly name per enrol attempt. The staff login redirect can
  // trigger two near-simultaneous server renders of this page (router.push +
  // router.refresh), each calling enroll(). With Supabase's default empty
  // friendly name, the second collides on the name-uniqueness constraint ("A
  // factor with the friendly name … already exists") and the very first hit
  // shows an error until a reload. A unique name lets concurrent enrolments
  // both succeed; the dedup above clears the stale one on the next visit.
  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `staff-totp-${crypto.randomUUID()}`,
  });

  if (enrollError || !enrolled) {
    return (
      <div className="space-y-4">
        <h1 className="text-center text-2xl font-semibold text-slate-800">
          Set up two-factor authentication
        </h1>
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not start MFA enrolment: {enrollError?.message ?? "unknown error"}
        </p>
      </div>
    );
  }

  return (
    <MfaSetupForm
      factorId={enrolled.id}
      qrCode={enrolled.totp.qr_code}
      secret={enrolled.totp.secret}
      nextPath={nextPath}
    />
  );
}
