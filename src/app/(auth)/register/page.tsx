/**
 * Applicant invitation registration page.
 *
 * Server Component shell. Mirrors `register/staff/page.tsx`.
 *
 * Two parallel registration flows are supported via search params:
 *
 *   1. `?token=<token>` — applicant invitation flow. Token is validated
 *      server-side against the `invitations.token` column, then we render
 *      the client-side `ApplicantRegisterForm` with the email and name
 *      pre-filled.
 *
 *   2. `?token_hash=<hash>` — Supabase magic-link / OTP flow. Delegates to
 *      the existing `TokenRegistration` client component.
 *
 * The legacy `?invitationId=<uuid>` branch was removed when PR2 of the
 * applicant invitation flow shipped. Any in-flight invitation emails
 * holding the old URL will no longer accept registration — bursary office
 * must Resend them from the Invitations admin page.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { validateApplicantInvitationAction } from "./actions";
import { ApplicantRegisterForm } from "./applicant-register-form";
import { ReassessmentSignIn } from "./reassessment-signin";
import { TokenRegistration } from "./token-registration";

export const metadata: Metadata = {
  title: "Activate your account",
};

// Force dynamic rendering: token validation must happen on every request
// (no static caching of an "invitation invalid" page).
export const dynamic = "force-dynamic";

interface RegisterPageProps {
  searchParams: { token?: string | string[]; token_hash?: string | string[] };
}

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const tokenHash = pickString(searchParams.token_hash);
  const token = pickString(searchParams.token);

  // Magic-link branch — delegated to the existing client component.
  if (tokenHash) {
    return <TokenRegistration tokenHash={tokenHash} />;
  }

  if (!token) {
    return <InvalidInvitation message="No invitation token was provided." />;
  }

  const validation = await validateApplicantInvitationAction(token);

  if (!validation.success) {
    return <InvalidInvitation message={validation.error} />;
  }

  // Re-assessment invite → the holder already has an account from year one.
  // Never show the first-year "create account / choose a password" form.
  if (validation.isReassessment) {
    const currentUser = await getCurrentUser();

    // Already signed in as the invited holder → straight into the portal,
    // where the Begin re-assessment card consumes the invite.
    if (
      currentUser &&
      currentUser.email.toLowerCase() === validation.email.toLowerCase()
    ) {
      redirect("/");
    }

    // Otherwise ask them to sign in with last year's credentials.
    return (
      <ReassessmentSignIn
        email={validation.email}
        childName={validation.childName}
        academicYear={validation.academicYear}
      />
    );
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Create your account
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Complete your registration to access the bursary portal.
      </p>

      <ApplicantRegisterForm
        token={token}
        email={validation.email}
        firstName={validation.firstName ?? ""}
        lastName={validation.lastName ?? ""}
      />
    </>
  );
}

function InvalidInvitation({ message }: { message: string }) {
  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-semibold text-slate-800">
        Invitation invalid
      </h1>
      <p className="mb-6 text-sm text-slate-500">{message}</p>
      <a
        href="/login"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        Back to sign in
      </a>
    </div>
  );
}
