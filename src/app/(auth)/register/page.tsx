"use client";

/**
 * Invitation-based registration page.
 *
 * Flow:
 * 1. An assessor sends an invitation. The invite email contains a link with
 *    `?token=<invite_token>` appended to this page's URL.
 * 2. This page reads the token from the URL, verifies it via Supabase
 *    verifyOtp (type: "invite"), and then calls createProfile to persist
 *    the Profile row in Postgres.
 *
 * NOTE: useSearchParams() must be inside a component wrapped in <Suspense>
 * to satisfy Next.js 14 static generation requirements.
 */

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { createProfile } from "@/lib/auth/create-profile";

// ---------------------------------------------------------------------------
// Inner content — isolated so useSearchParams() is inside a Suspense boundary.
// ---------------------------------------------------------------------------

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-semibold text-slate-800">
          Invitation required
        </h1>
        <p className="text-sm text-slate-500">
          This registration page is only accessible via an invitation link sent
          by the John Whitgift Foundation. Please check your email for an
          invitation, or contact your assessor for assistance.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();

    // Exchange the invite token for a session.
    // token is guaranteed non-null here because we return early above when !token.
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token as string,
      type: "invite",
    });

    if (verifyError || !data.user) {
      setError(
        verifyError?.message ??
          "Invalid or expired invitation token. Please request a new invitation."
      );
      setLoading(false);
      return;
    }

    // Update the user's password now that they have a session.
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Create the Profile row in Postgres via a server action.
    const result = await createProfile({
      id: data.user.id,
      email: data.user.email!,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      // Role defaults to APPLICANT in createProfile; the assessor flow
      // will set the role explicitly when inviting staff members.
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Registration complete — redirect to the portal home.
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Create your account
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Complete your registration to access the bursary portal.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              First name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Jane"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Smith"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Choose a password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Repeat your password"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense to satisfy Next.js static generation.
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-4 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-blue-100" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
