"use client";

/**
 * Set-new-password form.
 *
 * Consumes the `token_hash` from the recovery email. The critical property
 * of this component is WHEN the token is spent: `verifyOtp` runs inside
 * handleSubmit, never on mount.
 *
 * Recovery tokens are single-use, and corporate mail security (Microsoft
 * Defender Safe Links, and other providers' link scanners) fetches every
 * URL in an inbound email on arrival. Anything that verifies on page load —
 * a server route, or a client component with a verify-on-mount effect —
 * has its token burned by the scanner seconds after the email lands, and
 * the recipient gets "link expired" on their first real click. That is the
 * bug Charlotte hit on 2026-08-23: the scanner consumed the token 15s after
 * send, 2m27s before she clicked.
 *
 * Deferring to submit makes the link scanner-proof: a scanner GETs a plain
 * password form, executes no JS and submits nothing, so the token survives
 * for the person who actually received the email. This mirrors the
 * invitation flow in register/token-registration.tsx, which is scanner-safe
 * for the same reason.
 *
 * The token is also the ONLY credential this form trusts. It deliberately
 * does not fall back to an ambient session: the previous implementation
 * showed the form to any signed-in user, so a reset link for account A,
 * opened in a browser signed in as account B, changed B's password and left
 * A still locked out.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import {
  postUpdateDestination,
  validateNewPassword,
} from "@/lib/auth/reset-password-helpers";

type FormState = "form" | "saving" | "expired" | "done";

export function UpdatePasswordForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter();

  const [state, setState] = useState<FormState>("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [destination, setDestination] = useState("/");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    // Validate before spending the token: a rejected password must leave the
    // link usable for another attempt.
    const validation = await validateNewPassword(password, confirmPassword);
    if (!validation.ok) {
      setErrorMessage(validation.reason);
      return;
    }

    setState("saving");
    const supabase = createSupabaseBrowserClient();

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (verifyError || !data.user) {
      setState("expired");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setErrorMessage(updateError.message);
      setState("form");
      return;
    }

    setDestination(
      postUpdateDestination(data.user.app_metadata?.role as string | undefined)
    );
    setState("done");
  }

  if (state === "expired") {
    return <ExpiredLink />;
  }

  if (state === "done") {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-800">
          Password updated
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Your new password has been saved and you are signed in.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push(destination);
            router.refresh();
          }}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Continue to your account
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Choose a new password
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Enter a new password for your account. It must be at least 12
        characters long.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="At least 12 characters"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Repeat your new password"
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "saving"}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Saving..." : "Save new password"}
        </button>
      </form>
    </>
  );
}

/**
 * Shown when the link carries no usable token, or when Supabase rejects the
 * token on submit (already used, or older than the configured lifetime).
 * Never a silent bounce to /login — that was the CI-01 loop.
 */
export function ExpiredLink() {
  return (
    <div className="text-center">
      <h1 className="mb-2 text-xl font-semibold text-slate-800">
        This link has expired
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Password reset links can only be used once and expire after a short
        time. Request a new link and try again.
      </p>
      <Link
        href="/reset-password"
        className="inline-block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        Request a new reset link
      </Link>
      <p className="mt-4 text-sm text-slate-500">
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Return to sign in
        </Link>
      </p>
    </div>
  );
}
