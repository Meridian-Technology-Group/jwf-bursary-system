"use client";

/**
 * Set-new-password page (CI-01 / Epic 15 G1).
 *
 * The reset email's link runs through /auth/callback which exchanges the
 * recovery code for a live session and redirects here. This page:
 *
 * 1. Confirms a session exists — without one (expired/re-used link, direct
 *    visit) it shows a "link expired" state pointing back to /reset-password,
 *    never a silent bounce to /login (that was the CI-01 loop).
 * 2. Validates the new password (12-char minimum + HIBP, same as
 *    registration) and calls supabase.auth.updateUser({ password }).
 * 3. On success offers a single Continue button — the recovery session is a
 *    real session, so the user goes straight to their account.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import {
  postUpdateDestination,
  validateNewPassword,
} from "@/lib/auth/reset-password-helpers";

type PageState = "checking" | "no_session" | "form" | "saving" | "done";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [state, setState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [destination, setDestination] = useState("/");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setState("no_session");
        return;
      }
      setDestination(
        postUpdateDestination(data.user.app_metadata?.role as string | undefined)
      );
      setState("form");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const validation = await validateNewPassword(password, confirmPassword);
    if (!validation.ok) {
      setErrorMessage(validation.reason);
      return;
    }

    setState("saving");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // Session may have expired between mount and submit, or Supabase
      // rejected the password (e.g. same as the old one).
      if (error.status === 401) {
        setErrorMessage("Your reset link has expired. Please request a new one.");
        setState("no_session");
      } else {
        setErrorMessage(error.message);
        setState("form");
      }
      return;
    }

    setState("done");
  }

  if (state === "checking") {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-blue-100" />
      </div>
    );
  }

  if (state === "no_session") {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-xl font-semibold text-slate-800">
          This link has expired
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Password reset links can only be used once and expire after a short
          time. Request a new link and try again.
        </p>
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}
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
