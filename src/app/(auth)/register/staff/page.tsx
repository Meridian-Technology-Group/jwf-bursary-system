/**
 * Staff invitation registration page.
 *
 * Server Component shell — receives the single-use ?token=... from the
 * branded invitation email, validates it server-side, and either renders
 * the client-side StaffRegisterForm or an "invitation invalid / expired"
 * message.
 */

import type { Metadata } from "next";
import { validateStaffInvitationAction } from "./actions";
import { StaffRegisterForm } from "./staff-register-form";

export const metadata: Metadata = {
  title: "Activate your staff account",
};

// Force dynamic rendering: token validation must happen on every request
// (no static caching of an "invitation invalid" page).
export const dynamic = "force-dynamic";

interface StaffRegisterPageProps {
  searchParams: { token?: string | string[] };
}

export default async function StaffRegisterPage({
  searchParams,
}: StaffRegisterPageProps) {
  const rawToken = searchParams.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token) {
    return <InvalidInvitation message="No invitation token was provided." />;
  }

  const validation = await validateStaffInvitationAction(token);

  if (!validation.success) {
    return <InvalidInvitation message={validation.error} />;
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Activate your staff account
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Set a password to finish setting up your {validation.role.toLowerCase()} account.
      </p>

      <StaffRegisterForm
        token={token}
        email={validation.email}
        firstName={validation.firstName ?? ""}
        lastName={validation.lastName ?? ""}
        role={validation.role}
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
